import { useEffect, useRef, useState } from "react";

export type DetectionEvent = {
  type: "focus" | "no-face" | "multi-face" | "object";
  message: string;
  timestamp: number;
};

export const useFaceAndObjectDetect = (workerUrl: string) => {
  const workerRef = useRef<Worker | null>(null);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Initialize worker
  useEffect(() => {
    workerRef.current = new Worker(workerUrl, { type: "module" });

    workerRef.current.onmessage = (e: MessageEvent) => {
      if (e.data.type === "detection") {
        setEvents((prev) => [...prev, e.data.payload as DetectionEvent]);
      } else if (e.data.type === "error") {
        console.error("[Face/Object Worker] Error:", e.data.error);
      }
    };

    workerRef.current.onerror = (err) => {
      console.error("[Face/Object Worker] Runtime error:", err);
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [workerUrl]);

  // Start detection loop
  const startDetection = (video: HTMLVideoElement) => {
    if (!video || !workerRef.current) return;
    setIsRunning(true);

    const loop = async () => {
      if (!isRunning) return;
      try {
        const frame = await createImageBitmap(video);
        workerRef.current?.postMessage({ type: "analyze-frame", frame });
      } catch (err) {
        console.error("[Face/Object Detection] Frame capture failed:", err);
      }
      requestAnimationFrame(loop);
    };

    loop();
  };

  const stopDetection = () => setIsRunning(false);

  return { events, isRunning, startDetection, stopDetection };
};

export default useFaceAndObjectDetect;
