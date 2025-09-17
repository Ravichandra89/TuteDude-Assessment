import { useEffect, useRef, useState } from "react";
import { useEventLogger } from "./useEventLogger";

export type DetectionEvent = {
  type: "focus" | "no-face" | "multi-face" | "object";
  message: string;
  timestamp: number;
};

type WorkerMessage =
  | { type: "detection"; payload: DetectionEvent }
  | { type: "error"; error: string };

export const useDetectWorker = (workerUrl: string) => {
  const workerRef = useRef<Worker | null>(null);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const { logEvent } = useEventLogger(); // Initialize logger

  // Worker initialization
  useEffect(() => {
    try {
      workerRef.current = new Worker(workerUrl, { type: "module" });

      workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const data = event.data;

        if (data.type === "detection") {
          setEvents((prev) => [...prev, data.payload]);

          // Log the event
          logEvent(
            data.payload.type.toUpperCase(), // type as string
            data.payload.message,
            { timestamp: data.payload.timestamp }
          );
        } else if (data.type === "error") {
          console.error("[DetectWorker] Error from worker:", data.error);
        }
      };

      workerRef.current.onerror = (err) => {
        console.error("[DetectWorker] Worker runtime error:", err);
      };
    } catch (err) {
      console.error("[DetectWorker] Failed to init worker:", err);
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [workerUrl, logEvent]);

  const analyzeFrame = (frame: ImageBitmap) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "analyze-frame", frame });
    }
  };

  const startDetection = (video: HTMLVideoElement) => {
    if (!video) return;
    setIsRunning(true);

    const loop = async () => {
      if (!isRunning || !workerRef.current) return;

      try {
        const frame = await createImageBitmap(video);
        analyzeFrame(frame);
      } catch (err) {
        console.error("[DetectWorker] Frame capture error:", err);
      }

      requestAnimationFrame(loop);
    };

    loop();
  };

  const stopDetection = () => {
    setIsRunning(false);
  };

  return {
    events,
    isRunning,
    startDetection,
    stopDetection,
  };
};

export default useDetectWorker;
