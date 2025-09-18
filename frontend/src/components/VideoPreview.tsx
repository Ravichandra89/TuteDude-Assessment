import React, { useEffect, useRef } from "react";
import { useMediaStream } from "../hooks/useMediaStream";
import { useDetectWorker } from "../hooks/useDetectWorker";
import type { DetectionEvent, DetectionReport } from "../hooks/useDetectWorker";
import { useEventLogger } from "../hooks/useEventLogger";

interface VideoPreviewProps {
  startMonitoring: boolean;
  label?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>; // allow null
  style?: React.CSSProperties; // <-- added style prop
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  startMonitoring,
  label = "Camera",
  videoRef,
  style,
}) => {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const refToUse = videoRef || internalRef;

  const { stream } = useMediaStream();
  const workerUrl = new URL("../worker/detectWorker.ts", import.meta.url).href;
  const { events, startDetection, stopDetection, getReport } =
    useDetectWorker(workerUrl);
  const { logEvent, clearLogs } = useEventLogger();

  const [logs, setLogs] = React.useState<DetectionEvent[]>([]);
  const [report, setReport] = React.useState<DetectionReport | null>(null);

  // Attach webcam stream
  useEffect(() => {
    if (refToUse.current && stream) {
      refToUse.current.srcObject = stream;
      refToUse.current.play().catch(() => {});
    }
  }, [stream, refToUse]);

  // Start detection automatically if enabled
  useEffect(() => {
    if (startMonitoring && refToUse.current && stream) {
      startDetection(refToUse.current);
      logEvent("DETECTION_STARTED", `${label} monitoring started`);
    }
  }, [startMonitoring, refToUse, stream, startDetection, logEvent, label]);

  // Update logs
  useEffect(() => {
    if (events.length > 0) setLogs([...events]);
  }, [events]);

  const handleStop = async () => {
    stopDetection();
    const finalReport = await getReport();
    setReport(finalReport || null);
    logEvent("REPORT_GENERATED", "Final report generated", {
      report: finalReport,
    });
  };

  const handleClearLogs = () => {
    clearLogs();
    setLogs([]);
    setReport(null);
  };

  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-lg font-semibold mb-2">{label} Preview</h2>

      <video
        ref={refToUse}
        autoPlay
        muted
        playsInline
        className="w-full max-w-md border rounded-md"
        style={style} // <-- applied style prop here
      />

      <div className="mt-4">
        <h3 className="text-md font-medium mb-1">Detection Logs</h3>
        <div className="h-40 overflow-y-auto border rounded p-2 bg-gray-50">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm">No events logged yet</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {logs.map((log) => (
                <li key={log.timestamp + log.type} className="border-b pb-1">
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

        {report && (
          <div className="mt-2 p-2 border rounded bg-yellow-50">
            <h4 className="font-semibold">Final Report:</h4>
            <ul>
              {Object.entries(report).map(([type, count]) => (
                <li key={type}>
                  {type}: {count} violation{count > 1 ? "s" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button
            onClick={handleStop}
            className="px-3 py-1 bg-red-600 text-white rounded"
          >
            Stop Detection & Generate Report
          </button>
          <button
            onClick={handleClearLogs}
            className="px-3 py-1 bg-gray-500 text-white rounded"
          >
            Clear Logs
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;
