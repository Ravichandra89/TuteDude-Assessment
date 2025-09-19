// src/hooks/useDetection.ts
import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as blazeface from "@tensorflow-models/blazeface";

export type DetectionEventType = "object" | "focus" | "no-face" | "multi-face";

export interface DetectionEvent {
  type: DetectionEventType;
  message: string;
  timestamp: number;
}

interface DetectionOptions {
  fps?: number;
  objectFps?: number;
  lookAwaySeconds?: number;
  noFaceSeconds?: number;
  maxEvents?: number;
}

interface UseDetectionResult {
  startDetection: (opts?: Partial<DetectionOptions>) => Promise<void>;
  stopDetection: () => void;
  startRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
  events: DetectionEvent[];
  clearEvents: () => void;
}

export const useDetection = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onEvent?: (evt: DetectionEvent) => void
): UseDetectionResult => {
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const faceRafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const faceModelRef = useRef<blazeface.BlazeFaceModel | null>(null);

  // timers & flags
  const noFaceStartRef = useRef<number | null>(null);
  const lookAwayStartRef = useRef<number | null>(null);
  const lastEventTimestamps = useRef<Record<string, number>>({});

  // recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedBlobsRef = useRef<Blob[]>([]);

  const defaultOptions: DetectionOptions = {
    fps: 5,
    objectFps: 2,
    lookAwaySeconds: 5,
    noFaceSeconds: 10,
    maxEvents: 500,
  };

  // helper push + call callback
  const pushEvent = (evt: DetectionEvent, cooldownMs = 5000) => {
    const key = `${evt.type}:${evt.message}`;
    const now = Date.now();
    const last = lastEventTimestamps.current[key] || 0;
    if (now - last < cooldownMs) return;
    lastEventTimestamps.current[key] = now;

    // update local state
    setEvents((prev) => {
      const arr = [...prev, evt];
      if (arr.length > (defaultOptions.maxEvents || 500)) arr.shift();
      return arr;
    });

    // immediate callback for parent
    try {
      onEvent?.(evt);
    } catch (e) {
      // ignore callback errors
      // (parent should be robust)
    }

    console.log("[useDetection] event:", evt);
  };

  // typesafe helpers for blazeface outputs
  const isTensor = (v: any): v is tf.Tensor =>
    !!v && typeof v.arraySync === "function";

  const toPoint = (p: any): [number, number] => {
    if (!p) return [0, 0];
    try {
      if (Array.isArray(p)) return [Number(p[0]) || 0, Number(p[1]) || 0];
      if (isTensor(p)) {
        const arr = (p as tf.Tensor).arraySync() as number[];
        return [Number(arr[0]) || 0, Number(arr[1]) || 0];
      }
    } catch (e) {
      console.warn("[useDetection] toPoint failed:", e);
    }
    return [0, 0];
  };

  const toLandmarks = (lm: any): number[][] => {
    if (!lm) return [];
    try {
      if (Array.isArray(lm)) return lm as number[][];
      if (isTensor(lm)) return (lm as tf.Tensor).arraySync() as number[][];
    } catch (e) {
      console.warn("[useDetection] toLandmarks failed:", e);
    }
    return [];
  };

  // load models once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await tf.setBackend("webgl").catch(() => {});
      } catch {}
      try {
        const [cocoModel, faceModel] = await Promise.all([
          cocoSsd.load({ base: "lite_mobilenet_v2" }),
          blazeface.load(),
        ]);
        if (!mounted) return;
        modelRef.current = cocoModel;
        faceModelRef.current = faceModel as any;
        console.log("[useDetection] models loaded: coco-ssd + blazeface");
      } catch (err) {
        console.error("[useDetection] model load error:", err);
      }
    })();
    return () => {
      mounted = false;
      modelRef.current = null;
      faceModelRef.current = null;
    };
  }, []);

  // object detection (throttled by timestamp)
  const runObjectDetectionOnce = async () => {
    const video = videoRef.current;
    const model = modelRef.current;
    if (!video || !model) return;
    try {
      const preds = await model.detect(video);
      if (preds && preds.length) {
        console.debug(
          "[useDetection] object preds:",
          preds.map((p) => p.class)
        );
      }
      const suspicious = [
        "cell phone",
        "phone",
        "mobile phone",
        "book",
        "notebook",
        "laptop",
        "keyboard",
        "mouse",
        "tablet",
        "remote",
        "headphones",
        "headset",
      ];
      preds.forEach((p) => {
        const cls = (p.class || "").toString().toLowerCase();
        if (suspicious.some((s) => cls.includes(s))) {
          pushEvent(
            {
              type: "object",
              message: `Detected suspicious object: ${p.class}`,
              timestamp: Date.now(),
            },
            7000
          );
        }
      });
    } catch (err) {
      console.error("[useDetection] object detection error:", err);
    }
  };

  // main face detection frame (called by RAF)
  const faceLoop = async (
    conf: DetectionOptions,
    state: { lastObjRunAt: number; msPerFrame: number }
  ) => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const faceModel = faceModelRef.current;
    if (!video || !faceModel) {
      faceRafRef.current = requestAnimationFrame(() => faceLoop(conf, state));
      return;
    }

    // require enough data
    if (video.readyState < (video as HTMLMediaElement).HAVE_ENOUGH_DATA) {
      faceRafRef.current = requestAnimationFrame(() => faceLoop(conf, state));
      return;
    }

    const now = performance.now();

    try {
      const faces = await faceModel.estimateFaces(video, false);
      // debug
      // console.debug("[useDetection] frame faceCount:", faces?.length ?? 0);

      // NO FACE
      if (!faces || faces.length === 0) {
        if (!noFaceStartRef.current) noFaceStartRef.current = Date.now();
        const elapsed = Date.now() - (noFaceStartRef.current || 0); // ms
        if (
          elapsed >=
          (conf.noFaceSeconds || defaultOptions.noFaceSeconds!) * 1000
        ) {
          pushEvent(
            {
              type: "no-face",
              message: `No face detected for > ${
                conf.noFaceSeconds || defaultOptions.noFaceSeconds
              } s`,
              timestamp: Date.now(),
            },
            15000
          );
          noFaceStartRef.current = Date.now(); // reset
        }
        lookAwayStartRef.current = null;
      } else {
        // face present
        noFaceStartRef.current = null;

        // multi-face
        if (faces.length > 1) {
          pushEvent(
            {
              type: "multi-face",
              message: `Multiple faces detected: ${faces.length}`,
              timestamp: Date.now(),
            },
            15000
          );
        }

        // pick primary (largest box)
        const primary = faces.reduce((a, b) => {
          const aTL = toPoint(a.topLeft as any);
          const aBR = toPoint(a.bottomRight as any);
          const bTL = toPoint(b.topLeft as any);
          const bBR = toPoint(b.bottomRight as any);
          const areaA =
            Math.max(0, aBR[0] - aTL[0]) * Math.max(0, aBR[1] - aTL[1]);
          const areaB =
            Math.max(0, bBR[0] - bTL[0]) * Math.max(0, bBR[1] - bTL[1]);
          return areaA > areaB ? a : b;
        }, faces[0]);

        const vw = video.videoWidth || video.clientWidth || 1;
        const vh = video.videoHeight || video.clientHeight || 1;

        const tl = toPoint(primary.topLeft as any);
        const br = toPoint(primary.bottomRight as any);
        const cx = (tl[0] + br[0]) / 2 / (vw || 1);
        const cy = (tl[1] + br[1]) / 2 / (vh || 1);

        const centerThreshold = 0.22;
        let lookingAway = false;
        if (
          Math.abs(cx - 0.5) > centerThreshold ||
          Math.abs(cy - 0.5) > centerThreshold
        ) {
          lookingAway = true;
        }

        // landmarks heuristic
        const landmarksArr = toLandmarks(primary.landmarks as any);
        if (landmarksArr && landmarksArr.length >= 3) {
          const cp = landmarksArr.slice().sort((a, b) => a[1] - b[1]); // top-most first
          const leftEye = cp[0];
          const rightEye = cp[1] || cp[0];
          const nose = cp[Math.min(2, cp.length - 1)];
          const eyesMidX = (leftEye[0] + rightEye[0]) / 2;
          const noseX = nose[0];
          const dx = (noseX - eyesMidX) / (vw || 1);
          if (Math.abs(dx) > 0.12) lookingAway = true;
        }

        if (lookingAway) {
          if (!lookAwayStartRef.current) lookAwayStartRef.current = Date.now();
          const elapsed = Date.now() - (lookAwayStartRef.current || 0);
          if (
            elapsed >=
            (conf.lookAwaySeconds || defaultOptions.lookAwaySeconds!) * 1000
          ) {
            pushEvent(
              {
                type: "focus",
                message: `User looking away for > ${
                  conf.lookAwaySeconds || defaultOptions.lookAwaySeconds
                } s`,
                timestamp: Date.now(),
              },
              10000
            );
            lookAwayStartRef.current = Date.now();
          }
        } else {
          lookAwayStartRef.current = null;
        }
      }

      // object detection throttle
      if (modelRef.current) {
        const sinceObj = now - state.lastObjRunAt;
        const objInterval =
          1000 / (conf.objectFps || defaultOptions.objectFps!);
        if (sinceObj >= objInterval) {
          state.lastObjRunAt = now;
          // run but don't block the frame loop (fire & forget)
          runObjectDetectionOnce().catch(() => {});
        }
      }
    } catch (err) {
      console.error("[useDetection] face detection error:", err);
    }

    // throttle by msPerFrame: if enough time passed call next, else schedule with RAF anyway
    faceRafRef.current = requestAnimationFrame(() => {
      setTimeout(() => {
        faceLoop(conf, state);
      }, state.msPerFrame);
    });
  };

  // startDetection ensures models + video readiness
  const waitForModelsAndVideo = async (timeoutMs = 5000) => {
    const start = Date.now();
    while (true) {
      const now = Date.now();
      if (modelRef.current && faceModelRef.current && videoRef.current) return;
      if (now - start > timeoutMs) return;
      // small pause
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  const startDetection = async (opts?: Partial<DetectionOptions>) => {
    const conf: DetectionOptions = { ...defaultOptions, ...(opts || {}) };
    if (runningRef.current) {
      console.log("[useDetection] already running");
      return;
    }
    runningRef.current = true;

    // wait for models and video to be present (short timeout)
    await waitForModelsAndVideo(7000);

    // ensure video has enough data
    const video = videoRef.current;
    if (!video) {
      console.warn("[useDetection] startDetection: videoRef not available");
    } else {
      // try to wait a little for HAVE_ENOUGH_DATA
      const start = Date.now();
      while (
        video.readyState < (video as HTMLMediaElement).HAVE_ENOUGH_DATA &&
        Date.now() - start < 2500
      ) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    const msPerFrame = Math.max(
      0,
      Math.round(1000 / (conf.fps || defaultOptions.fps!)) - 0
    );
    const state = { lastObjRunAt: 0, msPerFrame };

    // Kick off RAF loop
    faceRafRef.current = requestAnimationFrame(() => faceLoop(conf, state));
    console.log("[useDetection] detection started", conf);
  };

  const stopDetection = () => {
    runningRef.current = false;
    if (faceRafRef.current) {
      cancelAnimationFrame(faceRafRef.current);
      faceRafRef.current = null;
    }
    // reset timers
    noFaceStartRef.current = null;
    lookAwayStartRef.current = null;
    console.trace("[useDetection] detection stopped");
  };

  // recording helpers (unchanged)
  const startRecording = () => {
    if (!videoRef.current) return;
    const stream = videoRef.current.srcObject as MediaStream | null;
    if (!stream) {
      console.warn(
        "[useDetection] cannot record: video element has no srcObject"
      );
      return;
    }
    recordedBlobsRef.current = [];
    try {
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedBlobsRef.current.push(e.data);
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      console.log("[useDetection] recording started");
    } catch (err) {
      console.error("[useDetection] startRecording error:", err);
    }
  };

  const stopRecording = async (): Promise<Blob | null> => {
    const mr = mediaRecorderRef.current;
    if (!mr) return null;
    return new Promise((resolve) => {
      mr.onstop = () => {
        const blob = new Blob(recordedBlobsRef.current, {
          type: recordedBlobsRef.current[0]?.type || "video/webm",
        });
        recordedBlobsRef.current = [];
        mediaRecorderRef.current = null;
        resolve(blob);
      };
      try {
        mr.stop();
      } catch (err) {
        console.error("[useDetection] stopRecording error:", err);
        resolve(null);
      }
    });
  };

  const clearEvents = () => setEvents([]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    startDetection,
    stopDetection,
    startRecording,
    stopRecording,
    events,
    clearEvents,
  };
};
