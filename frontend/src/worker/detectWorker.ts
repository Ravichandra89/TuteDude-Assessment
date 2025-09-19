/// <reference lib="webworker" />
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import "@tensorflow/tfjs-backend-wasm"; // WASM backend for worker

type WorkerInputMessage = { type: "analyze-frame"; frame: ImageBitmap };
type DetectionPayloadType = "focus" | "no-face" | "multi-face";

interface DetectionPayload {
  type: DetectionPayloadType;
  message: string;
  timestamp: number;
}

let faceModel: faceLandmarksDetection.FaceLandmarksDetector | null = null;

let lastFocusTs = 0;
let lastFaceTs = 0;
let lastMultiFaceTs = 0;

const FOCUS_TIMEOUT = 5000;
const NO_FACE_TIMEOUT = 10000;
const MULTI_FACE_TIMEOUT = 5000;
const FOCUS_THRESHOLD = 0.25;

const violationCounts: Record<DetectionPayloadType, number> = {
  focus: 0,
  "no-face": 0,
  "multi-face": 0,
};

// Initialize the face landmarks detector
const initModels = async () => {
  if (!faceModel) {
    faceModel = await faceLandmarksDetection.createDetector(
      faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
      { runtime: "tfjs", refineLandmarks: true } // tfjs runtime works in worker
    );
  }
};

// Analyze a single ImageBitmap frame
const analyzeFrame = async (frame: ImageBitmap) => {
  try {
    await initModels();
    const now = Date.now();
    const eventsToSend: DetectionPayload[] = [];

    // Face detection
    const faces = faceModel ? await faceModel.estimateFaces(frame) : [];

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

    // Send all detected events to main thread
    eventsToSend.forEach((evt) =>
      postMessage({ type: "detection", payload: evt })
    );

    // Release the ImageBitmap
    frame.close?.();
  } catch (err: unknown) {
    postMessage({
      type: "error",
      error: (err as Error).message || "Unknown error",
    });
  }
};

// Listen to messages from the main thread
self.onmessage = async (
  event: MessageEvent<WorkerInputMessage | { type: "get-report" }>
) => {
  if (event.data.type === "analyze-frame" && "frame" in event.data) {
    analyzeFrame(event.data.frame);
  } else if (event.data.type === "get-report") {
    postMessage({ type: "report", payload: { ...violationCounts } });
  }
};
