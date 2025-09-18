import React, { useEffect, useRef, useState } from "react";
import { useMediaStream } from "../hooks/useMediaStream";
import { useDetectWorker } from "../hooks/useDetectWorker";
import type { DetectionEvent } from "../hooks/useDetectWorker";
import { useEventLogger } from "../hooks/useEventLogger";

interface VideoPreviewProps {
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoRef: externalRef,
}) => {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalRef ?? internalRef;

  const { stream } = useMediaStream();
  const workerUrl = new URL("../worker/detectWorker.ts", import.meta.url).href;
  const { events, startDetection, stopDetection } = useDetectWorker(workerUrl);
  const { logEvent, clearLogs } = useEventLogger();
  const [logs, setLogs] = useState<DetectionEvent[]>([]);

  // Automatically start detection when video is ready
  useEffect(() => {
    if (!videoRef.current || !stream) return;

    const handleLoadedMetadata = () => {
      startDetection(videoRef.current!);
      logEvent("DETECTION_STARTED", "Candidate monitoring started");
    };

    videoRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      videoRef.current?.removeEventListener(
        "loadedmetadata",
        handleLoadedMetadata
      );
      stopDetection(); // stop detection on unmount
      logEvent("DETECTION_STOPPED", "Candidate monitoring stopped");
    };
  }, [videoRef, stream, startDetection, stopDetection, logEvent]);

  // Sync detection events to logs
  useEffect(() => {
    if (events.length > 0) {
      events.forEach((evt) =>
        logEvent(evt.type, evt.message, { timestamp: evt.timestamp })
      );
      setLogs([...events]);
    }
  }, [events, logEvent]);

  const handleClearLogs = () => {
    clearLogs();
    setLogs([]);
  };

  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-lg font-semibold mb-2">Candidate Video Preview</h2>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full max-w-md border rounded-md"
      />

      <div className="mt-4">
        <h3 className="text-md font-medium mb-1">Detection Logs</h3>
        <div className="h-40 overflow-y-auto border rounded p-2 bg-gray-50">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm">No events logged yet</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {logs.map((log, i) => (
                <li key={i} className="border-b pb-1">
                  <span className="font-semibold">{log.type}</span>:{" "}
                  {log.message} <br />
                  <span className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={handleClearLogs}
          className="mt-2 px-3 py-1 bg-gray-500 text-white rounded"
        >
          Clear Logs
        </button>
      </div>
    </div>
  );
};

export default VideoPreview;
