// src/pages/InterviewPage.tsx
import React, { useRef, useState, useEffect } from "react";
import { useMediaStream } from "../hooks/useMediaStream";
import { useWebRTC } from "../hooks/useWebRTC";
import type { Role } from "../hooks/useWebRTC";
import type { DetectionEvent } from "../hooks/useDetection";
import axios from "axios";

// Components
import InterviewerPage from "./InterviewerPage";
import CandidatePage from "./CandiatePage";

// Detection & logging hooks
import { useDetection } from "../hooks/useDetection";
import { useBulkLogger } from "../hooks/useBulkLogger";

const API_BASE =
  (import.meta.env as any).VITE_APP_BASE_URL || "http://localhost:4000";

const InterviewPage: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const role: Role = (searchParams.get("role") as Role) || "candidate";

  const { start: startCamera, stop: stopCamera } = useMediaStream();
  const { startConnection, closeConnection, isConnected, remoteStreams } =
    useWebRTC();

  const [isActive, setIsActive] = useState(false);
  const [roomId] = useState("interview-room-123");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [detectionEvents, setDetectionEvents] = useState<DetectionEvent[]>([]);
  const [proctoringReport, setProctoringReport] = useState<any | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const flushIntervalRef = useRef<number | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [isStopping, setIsStopping] = useState(false);
  const localEventsRef = useRef<any[]>([]);

  // detection stats
  const detectionStatsRef = useRef({
    focusLost: 0,
    noFace: 0,
    multiFace: 0,
    phone: 0,
    notes: 0,
    device: 0,
  });
  const [, setDetectionCountsTick] = useState(0);

  const bulkLogger = useBulkLogger({
    uploadUrl: `${API_BASE}/api/v1/logs`,
    batchSize: 50,
    intervalMs: 10000,
    candidateId: undefined,
    sessionId: undefined,
  });

  const mapDetectionToBackendEvent = (evt: DetectionEvent) => {
    const base = {
      message: evt.message,
      timestamp: new Date(evt.timestamp).toISOString(),
      candidateId: undefined,
      sessionId: sessionId ?? undefined,
    } as any;

    switch (evt.type) {
      case "focus":
        return { ...base, type: "FOCUS_LOST" };
      case "no-face":
        return { ...base, type: "NO_FACE" };
      case "multi-face":
        return { ...base, type: "MULTIPLE_FACES" };
      case "object": {
        const msg = (evt.message || "").toLowerCase();
        if (msg.includes("phone") || msg.includes("cell"))
          return { ...base, type: "PHONE_DETECTED" };
        if (
          msg.includes("book") ||
          msg.includes("paper") ||
          msg.includes("notes")
        )
          return { ...base, type: "NOTES_DETECTED" };
        return { ...base, type: "DEVICE_DETECTED" };
      }
      default:
        return { ...base, type: "DEVICE_DETECTED" };
    }
  };

  const sendQueuedEventsToServer = async (sid: string) => {
    const queue = localEventsRef.current;
    if (!queue || !queue.length) return;
    try {
      const body = { sessionId: sid, events: queue };
      const resp = await axios.post(`${API_BASE}/api/v1/logs`, body, {
        timeout: 8000,
      });
      console.log(
        `[InterviewPage] Sent ${queue.length} queued events`,
        resp?.data
      );
      localEventsRef.current = [];
    } catch (err: any) {
      console.warn(
        "[InterviewPage] Failed to send queued events:",
        err?.message || err
      );
    }
  };

  // debounced flush
  const flushOnEventTimerRef = useRef<number | null>(null);
  const scheduleFlushOnEvent = (delayMs = 1500) => {
    if (flushOnEventTimerRef.current) {
      clearTimeout(flushOnEventTimerRef.current);
      flushOnEventTimerRef.current = null;
    }
    flushOnEventTimerRef.current = window.setTimeout(async () => {
      try {
        await bulkLogger.flush();
      } catch (e) {
        console.warn("[InterviewPage] flushOnEvent failed", e);
      } finally {
        if (flushOnEventTimerRef.current) {
          clearTimeout(flushOnEventTimerRef.current);
          flushOnEventTimerRef.current = null;
        }
      }
    }, delayMs);
  };

  // handle incoming detection events (called immediately from useDetection)
  const handleIncomingEvent = (evt: DetectionEvent) => {
    // push to UI log
    setDetectionEvents((prev) => [...prev, evt]);

    // map and push to bulk logger
    const payload = mapDetectionToBackendEvent(evt);
    try {
      bulkLogger.push(payload);
    } catch (e) {
      console.warn("[InterviewPage] bulkLogger.push error:", e);
    }

    localEventsRef.current.push(payload);

    // schedule quick flush (debounced)
    scheduleFlushOnEvent(1500);

    // update counters
    switch (payload.type) {
      case "FOCUS_LOST":
        detectionStatsRef.current.focusLost++;
        break;
      case "NO_FACE":
        detectionStatsRef.current.noFace++;
        break;
      case "MULTIPLE_FACES":
        detectionStatsRef.current.multiFace++;
        break;
      case "PHONE_DETECTED":
        detectionStatsRef.current.phone++;
        break;
      case "NOTES_DETECTED":
        detectionStatsRef.current.notes++;
        break;
      default:
        detectionStatsRef.current.device++;
        break;
    }
    setDetectionCountsTick((t) => t + 1);
  };

  // pass our callback into hook so events are emitted immediately
  const {
    startDetection,
    stopDetection,
    startRecording,
    stopRecording,
    events: detectionEventsInternal,
  } = useDetection(localVideoRef, handleIncomingEvent);

  // Keep backing array forwarding in case; not used for immediate processing
  useEffect(() => {
    // detectionEventsInternal is already being forwarded via callback; no-op here
  }, [detectionEventsInternal]);

  /** create session */
  const createSessionOnServer = async () => {
    try {
      const body = {
        candidateId: "66ecb65f7b7e5b78b9b18c11",
        startTime: new Date().toISOString(),
      };
      const resp = await axios.post(`${API_BASE}/api/v1/sessions`, body, {
        timeout: 7000,
      });
      const sid = resp?.data?.session?._id;
      if (sid) setSessionId(sid);
      return sid;
    } catch (err) {
      console.warn("[InterviewPage] createSessionOnServer error:", err);
      return undefined;
    }
  };

  // helper: ensure video play + ready
  const ensureVideoPlayAndReady = async (v?: HTMLVideoElement | null) => {
    if (!v) return;
    try {
      await v.play().catch(() => {});
    } catch {}
    const start = Date.now();
    while (
      v &&
      v.readyState < (v as HTMLMediaElement).HAVE_ENOUGH_DATA &&
      Date.now() - start < 2500
    ) {
      // wait small intervals
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  const handleStart = async () => {
    try {
      const sid = await createSessionOnServer();
      if (!sid) console.warn("[InterviewPage] Proceeding without session id");

      const stream = await startCamera({ video: true, audio: true });
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await ensureVideoPlayAndReady(localVideoRef.current);
      }

      await startConnection(roomId, role, stream);
      setIsActive(true);

      if (role === "candidate") {
        // start detection only after video has started and play/ready checks above
        startDetection({
          fps: 6,
          objectFps: 2,
          lookAwaySeconds: 5,
          noFaceSeconds: 10,
        }).catch((e) => {
          console.warn("[InterviewPage] startDetection error:", e);
        });

        startRecording();

        flushIntervalRef.current = window.setInterval(async () => {
          try {
            await bulkLogger.flush();
          } catch (e) {
            console.warn("[InterviewPage] periodic bulkLogger.flush failed", e);
          }
        }, 10000);
      }
    } catch (err) {
      console.error("[InterviewPage] start error:", err);
      alert("Cannot access camera. Check permissions.");
    }
  };

  const handleStop = async () => {
    if (isStopping) return;
    setIsStopping(true);
    setIsActive(false);

    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }

    // stop detection
    try {
      stopDetection();
    } catch {}

    try {
      await bulkLogger.flush();
    } catch (e) {
      console.warn("[InterviewPage] final bulkLogger.flush failed", e);
    }

    let sid = sessionId;
    if (!sid) sid = await createSessionOnServer();
    if (sid) await sendQueuedEventsToServer(sid);

    // stop recording and upload
    try {
      const recordedBlob = await stopRecording();
      if (recordedBlob && sid) {
        try {
          const form = new FormData();
          form.append("file", recordedBlob, `session-${sid}.webm`);
          form.append("sessionId", sid);
          const upResp = await axios.post(
            `${API_BASE}/api/v1/sessions/${sid}/recording`,
            form,
            {
              headers: { "Content-Type": "multipart/form-data" },
              timeout: 20000,
            }
          );
          console.log("[InterviewPage] Uploaded recording:", upResp?.data);
        } catch (err) {
          console.warn("[InterviewPage] Recording upload failed:", err);
        }
      }
    } catch (err) {
      console.warn("[InterviewPage] stopRecording error:", err);
    }

    if (sid) {
      try {
        await axios.patch(`${API_BASE}/api/v1/sessions/${sid}/end`, {
          endTime: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("[InterviewPage] session end error:", err);
      }

      try {
        const resp = await axios.get(`${API_BASE}/api/v1/reports/${sid}`, {
          timeout: 10000,
        });
        if (resp.data?.success) setProctoringReport(resp.data.data);
      } catch (err) {
        console.error("[InterviewPage] report API error:", err);
      }
    }

    closeConnection();
    stopCamera();

    setDetectionEvents([]);
    setLocalStream(null);
    setRemoteStream(null);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    detectionStatsRef.current = {
      focusLost: 0,
      noFace: 0,
      multiFace: 0,
      phone: 0,
      notes: 0,
      device: 0,
    };
    setDetectionCountsTick((t) => t + 1);

    if (flushOnEventTimerRef.current) {
      clearTimeout(flushOnEventTimerRef.current);
      flushOnEventTimerRef.current = null;
    }

    setIsStopping(false);
  };

  useEffect(() => {
    const arr = Object.values(remoteStreams);
    const first = arr[0] || null;
    setRemoteStream(first);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = first;
  }, [remoteStreams]);

  const interviewerCanEnd = role === "interviewer" && isConnected;

  return (
    <div className="min-h-screen p-6 flex flex-col items-center bg-gray-100">
      <h1 className="text-2xl font-bold mb-6">
        {role === "candidate"
          ? "Candidate Join Interview Panel"
          : "Interviewer Dashboard"}
      </h1>

      <div className="mb-4 flex items-center gap-2">
        <span
          className={`w-3 h-3 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>

      {role === "interviewer" ? (
        <InterviewerPage
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          localStream={localStream}
          remoteStream={remoteStream}
          detectionEvents={detectionEvents}
          setDetectionEvents={setDetectionEvents}
          isActive={isActive}
          report={proctoringReport}
        />
      ) : (
        <CandidatePage
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          localStream={localStream}
          remoteStream={remoteStream}
          detectionEvents={detectionEvents}
          isActive={isActive}
        />
      )}

      <div className="mt-6 flex gap-4">
        {!isActive ? (
          interviewerCanEnd ? (
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50"
            >
              {isStopping ? "Ending..." : "End Interview"}
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Start Interview
            </button>
          )
        ) : (
          <button
            onClick={handleStop}
            disabled={isStopping}
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50"
          >
            {isStopping ? "Ending..." : "End Interview"}
          </button>
        )}
      </div>
    </div>
  );
};

export default InterviewPage;
