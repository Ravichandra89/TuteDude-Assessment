/// <reference lib="webworker" />
import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

type WorkerInputMessage = {
  type: "analyze-frame";
  frame: ImageBitmap;
};

type DetectionPayloadType = "focus" | "no-face" | "multi-face" | "object";

interface DetectionPayload {
  type: DetectionPayloadType;
  message: string;
  timestamp: number;
}

let faceModel: faceLandmarksDetection.FaceLandmarksDetector | null = null;
let objectModel: cocoSsd.ObjectDetection | null = null;

let lastFocusTs = Date.now();
let lastFaceTs = Date.now();

const FOCUS_TIMEOUT = 5000;
const NO_FACE_TIMEOUT = 10000;

const initModels = async () => {
  if (!faceModel) {
    faceModel = await faceLandmarksDetection.createDetector(
      faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh
    );
  }
  if (!objectModel) {
    objectModel = await cocoSsd.load();
  }
};

self.onmessage = async (event: MessageEvent<WorkerInputMessage>) => {
  try {
    const { type, frame } = event.data;
    if (type === "analyze-frame" && frame) {
      await initModels();

      const canvas = new OffscreenCanvas(frame.width, frame.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");
      ctx.drawImage(frame, 0, 0);

      const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
      const now = Date.now();

      // ---------------- FACE DETECTION ----------------
      const faces = faceModel ? await faceModel.estimateFaces(imageData) : [];

      if (!faces || faces.length === 0) {
        if (now - lastFaceTs > NO_FACE_TIMEOUT) {
          postMessage({
            type: "detection",
            payload: {
              type: "no-face",
              message: "No face detected >10s",
              timestamp: now,
            },
          } as { type: "detection"; payload: DetectionPayload });
          lastFaceTs = now;
        }
      } else {
        lastFaceTs = now;

        if (faces.length > 1) {
          postMessage({
            type: "detection",
            payload: {
              type: "multi-face",
              message: "Multiple faces detected",
              timestamp: now,
            },
          } as { type: "detection"; payload: DetectionPayload });
        }

        const face = faces[0];
        const nose = face.keypoints.find(
          (k: faceLandmarksDetection.Keypoint) => k.name === "noseTip"
        );
        if (nose && nose.x < frame.width * 0.25) {
          if (now - lastFocusTs > FOCUS_TIMEOUT) {
            postMessage({
              type: "detection",
              payload: {
                type: "focus",
                message: "Candidate looking away >5s",
                timestamp: now,
              },
            } as { type: "detection"; payload: DetectionPayload });
            lastFocusTs = now;
          }
        } else {
          lastFocusTs = now;
        }
      }

      // ---------------- OBJECT DETECTION ----------------
      if (objectModel) {
        const predictions = await objectModel.detect(
          canvas as unknown as HTMLCanvasElement
        );

        predictions.forEach((p) => {
          if (["cell phone", "book", "laptop"].includes(p.class)) {
            postMessage({
              type: "detection",
              payload: {
                type: "object",
                message: `${p.class} detected`,
                timestamp: now,
              },
            } as { type: "detection"; payload: DetectionPayload });
          }
        });
      }

      frame.close?.();
    }
  } catch (err: unknown) {
    postMessage({
      type: "error",
      error: (err as Error).message || "Unknown error",
    });
  }
};
