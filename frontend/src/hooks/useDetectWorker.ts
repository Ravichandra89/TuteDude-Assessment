import { useEffect, useRef, useState, useCallback } from "react";
import { useEventLogger } from "./useEventLogger";

export type DetectionEvent = {
  type: "focus" | "no-face" | "multi-face" | "object";
  message: string;
  timestamp: number;
};

export const useDetectWorker = (
  workerUrl: string,
  onEvent?: (evt: DetectionEvent) => void
) => {
  const workerRef = useRef<Worker | null>(null);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const isRunningRef = useRef(false);
  const { logEvent } = useEventLogger();

  useEffect(() => {
    const worker = new Worker(workerUrl, { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<any>) => {
      const data = event.data;
      if (data.type === "detection") {
        setEvents((prev) => [...prev, data.payload]);
        logEvent(data.payload.type.toUpperCase(), data.payload.message, {
          timestamp: data.payload.timestamp,
        });
        if (onEvent) onEvent(data.payload);
      } else if (data.type === "error") {
        console.error("[DetectWorker] Error:", data.error);
      }
    };

    worker.onerror = (err) =>
      console.error("[DetectWorker] Worker runtime error:", err);

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [workerUrl, logEvent, onEvent]);

  const analyzeFrame = useCallback((frame: ImageBitmap) => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({ type: "analyze-frame", frame }, [frame]);
  }, []);

  const startDetection = useCallback(
    (video: HTMLVideoElement | null, fps = 6) => {
      if (!video || !workerRef.current) return;
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      const intervalMs = Math.round(1000 / fps);
      let lastTime = 0;

      const loop = async (now?: number) => {
        if (!isRunningRef.current) return;

        if (!now || now - lastTime >= intervalMs) {
          lastTime = now ?? Date.now();
          try {
            const frame = await createImageBitmap(video);
            analyzeFrame(frame);
          } catch (err) {
            console.error("[DetectWorker] Frame capture error:", err);
          }
        }

        requestAnimationFrame(loop);
      };

      requestAnimationFrame(loop);
    },
    [analyzeFrame]
  );

  const stopDetection = useCallback(() => {
    isRunningRef.current = false;
  }, []);

  const getReport = useCallback(async (): Promise<Record<
    string,
    number
  > | null> => {
    const worker = workerRef.current;
    if (!worker) return null;
    return new Promise((resolve) => {
      const handler = (event: MessageEvent<any>) => {
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
    isRunning: () => isRunningRef.current,
    startDetection,
    stopDetection,
    getReport,
    _worker: workerRef.current,
  };
};
