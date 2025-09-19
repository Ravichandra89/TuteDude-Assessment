import React, { useEffect, useRef } from "react";
import type { DetectionEvent as BaseDetectionEvent } from "../hooks/useDetection";

export interface DetectionEvent extends BaseDetectionEvent {
  bbox?: { x: number; y: number; width: number; height: number };
}

interface DetectionOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  events: DetectionEvent[];
  onDetect?: (evt: DetectionEvent) => void;
}

const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  videoRef,
  events,
  onDetect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Call onDetect callback for the latest event
  useEffect(() => {
    if (onDetect && events.length > 0) {
      const latestEvent = events[events.length - 1];
      onDetect(latestEvent);
    }
  }, [events, onDetect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    };
    resizeCanvas();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    events.forEach((evt) => {
      if (evt.type === "object" && evt.bbox) {
        const { x, y, width, height } = evt.bbox;
        ctx.strokeStyle = "red";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = "red";
        ctx.font = "14px Arial";
        ctx.fillText(evt.message, x, y > 10 ? y - 5 : y + 15);
      }
    });
  }, [events, videoRef]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-2 left-1/2 -translate-x-1/2 space-y-2">
        {events.map((evt, idx) => {
          if (["focus", "no-face", "multi-face"].includes(evt.type)) {
            return (
              <div
                key={idx}
                className="bg-red-600 text-white px-3 py-1 rounded shadow text-sm"
              >
                ⚠ {evt.message}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default DetectionOverlay;
