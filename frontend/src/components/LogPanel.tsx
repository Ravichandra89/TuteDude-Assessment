import React from "react";
import type { DetectionEvent } from "../hooks/useDetectWorker";

interface LogPanelProps {
  events: DetectionEvent[];
}

const LogPanel: React.FC<LogPanelProps> = ({ events }) => {
  const getClassName = (type: DetectionEvent["type"]) => {
    switch (type) {
      case "object":
        return "bg-red-100 text-red-700";
      case "focus":
        return "bg-yellow-100 text-yellow-700";
      case "multi-face":
        return "bg-orange-100 text-orange-700";
      case "no-face":
        return "bg-gray-200 text-gray-700";
      default:
        return "bg-green-100 text-green-700";
    }
  };

  return (
    <div className="w-full max-w-md mt-4 bg-gray-100 rounded-lg shadow p-3 h-48 overflow-y-auto text-sm">
      <h3 className="font-semibold mb-2 text-gray-700">📋 Detection Logs</h3>

      {events.length === 0 ? (
        <p className="text-gray-500">No events logged yet...</p>
      ) : (
        <ul className="space-y-1">
          {events.map((evt, idx) => (
            <li key={idx} className={`p-2 rounded ${getClassName(evt.type)}`}>
              <span className="font-mono text-xs">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </span>{" "}
              — {evt.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LogPanel;
