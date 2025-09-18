/// <reference lib="webworker" />
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

type WorkerInputMessage = { type: "analyze-frame"; frame: ImageBitmap };
type DetectionPayloadType = "focus" | "no-face" | "multi-face" | "object";

interface DetectionPayload {
  type: DetectionPayloadType;
  message: string;
  timestamp: number;
}

let faceModel: faceLandmarksDetection.FaceLandmarksDetector | null = null;
let objectModel: cocoSsd.ObjectDetection | null = null;

let lastFocusTs = 0;
let lastFaceTs = 0;
let lastMultiFaceTs = 0;
let lastObjectTs = 0;

const FOCUS_TIMEOUT = 5000;
const NO_FACE_TIMEOUT = 10000;
const MULTI_FACE_TIMEOUT = 5000;
const OBJECT_TIMEOUT = 5000;
const FOCUS_THRESHOLD = 0.25;

const violationCounts: Record<DetectionPayloadType, number> = {
  focus: 0,
  "no-face": 0,
  "multi-face": 0,
  object: 0,
};

const initModels = async () => {
  if (!faceModel) {
    faceModel = await faceLandmarksDetection.createDetector(
      faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
      { runtime: "tfjs", refineLandmarks: true }
    );
  }
  if (!objectModel) objectModel = await cocoSsd.load();
};

const analyzeFrame = async (frame: ImageBitmap) => {
  try {
    await initModels();

    const canvas = new OffscreenCanvas(frame.width, frame.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get OffscreenCanvas context");

    ctx.drawImage(frame, 0, 0);
    const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
    const now = Date.now();

    const eventsToSend: DetectionPayload[] = [];

    // --- FACE DETECTION ---
    const faces = faceModel ? await faceModel.estimateFaces(imageData) : [];

    if (!faces || faces.length === 0) {
      if (now - lastFaceTs > NO_FACE_TIMEOUT) {
        eventsToSend.push({
          type: "no-face",
          message: "No face detected >10s",
          timestamp: now,
        });
        lastFaceTs = now;
        violationCounts["no-face"] += 1;
      }
    } else {
      lastFaceTs = now;

      if (faces.length > 1 && now - lastMultiFaceTs > MULTI_FACE_TIMEOUT) {
        eventsToSend.push({
          type: "multi-face",
          message: "Multiple faces detected",
          timestamp: now,
        });
        lastMultiFaceTs = now;
        violationCounts["multi-face"] += 1;
      }

      const nose = faces[0].keypoints.find((k) => k.name === "noseTip");
      if (
        nose &&
        nose.x < frame.width * FOCUS_THRESHOLD &&
        now - lastFocusTs > FOCUS_TIMEOUT
      ) {
        eventsToSend.push({
          type: "focus",
          message: "Candidate looking away >5s",
          timestamp: now,
        });
        lastFocusTs = now;
        violationCounts.focus += 1;
      } else if (nose) lastFocusTs = now;
    }

    // --- OBJECT DETECTION ---
    if (objectModel && now - lastObjectTs > OBJECT_TIMEOUT) {
      const predictions = await objectModel.detect(
        canvas as unknown as HTMLCanvasElement
      );
      const objDetected = predictions.filter((p) =>
        ["cell phone", "book", "laptop"].includes(p.class)
      );
      if (objDetected.length > 0) {
        objDetected.forEach((p) => {
          eventsToSend.push({
            type: "object",
            message: `${p.class} detected`,
            timestamp: now,
          });
          violationCounts.object += 1;
        });
        lastObjectTs = now;
      }
    }

    // Send all events at once
    eventsToSend.forEach((evt) =>
      postMessage({ type: "detection", payload: evt })
    );

    frame.close?.();
  } catch (err: unknown) {
    postMessage({
      type: "error",
      error: (err as Error).message || "Unknown error",
    });
  }
};

self.onmessage = async (
  event: MessageEvent<WorkerInputMessage | { type: "get-report" }>
) => {
  if (event.data.type === "analyze-frame" && "frame" in event.data) {
    analyzeFrame(event.data.frame);
  } else if (event.data.type === "get-report") {
    postMessage({ type: "report", payload: { ...violationCounts } });
  }
};
