import { useEffect, useRef, useState, useCallback } from "react";
import { useEventLogger } from "./useEventLogger";

export type DetectionEvent = {
  type: "focus" | "no-face" | "multi-face" | "object";
  message: string;
  timestamp: number;
};

export type DetectionReport = Record<DetectionEvent["type"], number>;

type WorkerMessage =
  | { type: "detection"; payload: DetectionEvent }
  | { type: "error"; error: string }
  | { type: "report"; payload: DetectionReport };

export const useDetectWorker = (workerUrl: string) => {
  const workerRef = useRef<Worker | null>(null);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const { logEvent } = useEventLogger();

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(workerUrl, { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;

      if (data.type === "detection") {
        setEvents((prev) => [...prev, data.payload]);
        logEvent(data.payload.type.toUpperCase(), data.payload.message, {
          timestamp: data.payload.timestamp,
        });
      } else if (data.type === "error") {
        console.error("[DetectWorker] Error:", data.error);
      }
    };

    worker.onerror = (err) => {
      console.error("[DetectWorker] Worker runtime error:", err);
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [workerUrl, logEvent]);

  // Send a video frame to worker for analysis
  const analyzeFrame = useCallback((frame: ImageBitmap) => {
    workerRef.current?.postMessage({ type: "analyze-frame", frame });
  }, []);

  // Detection loop
  const startDetection = useCallback(
    (video: HTMLVideoElement) => {
      if (!video) return;
      setIsRunning(true);

      const loop = async () => {
        if (!isRunning) return;

        const worker = workerRef.current; // copy reference
        if (!worker) return;

        try {
          const frame = await createImageBitmap(video);
          analyzeFrame(frame);
        } catch (err) {
          console.error("[DetectWorker] Frame capture error:", err);
        }

        if (isRunning) requestAnimationFrame(loop);
      };

      loop();
    },
    [analyzeFrame, isRunning]
  );

  // Stop detection
  const stopDetection = useCallback(() => {
    setIsRunning(false);
  }, []);

  // Get cumulative report from worker
  const getReport = useCallback(async (): Promise<DetectionReport | null> => {
    const worker = workerRef.current;
    if (!worker) return null;

    return new Promise((resolve) => {
      const handler = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === "report") {
          resolve(event.data.payload);
          worker.removeEventListener("message", handler);
        }
      };
      worker.addEventListener("message", handler);
      worker.postMessage({ type: "get-report" });
    });
  }, []);

  return {
    events,
    isRunning,
    startDetection,
    stopDetection,
    getReport,
  };
};

export default useDetectWorker;
