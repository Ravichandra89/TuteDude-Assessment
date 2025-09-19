import React, { useEffect, useState } from "react";
import type { DetectionEvent } from "../hooks/useDetectWorker";

interface LogPanelProps {
  events: DetectionEvent[];
}

const LogPanel: React.FC<LogPanelProps> = ({ events }) => {
  const [latestEvent, setLatestEvent] = useState<DetectionEvent | null>(null);

  // Watch for new events
  useEffect(() => {
    if (events.length > 0) {
      const last = events[events.length - 1];
      setLatestEvent(last);

      // Auto-hide alert after 4s
      const timer = setTimeout(() => setLatestEvent(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [events]);

  const getClassName = (type: DetectionEvent["type"]) => {
    switch (type) {
      case "object":
        return "bg-red-100 text-red-700 border border-red-400";
      case "focus":
        return "bg-yellow-100 text-yellow-700 border border-yellow-400";
      case "multi-face":
        return "bg-orange-100 text-orange-700 border border-orange-400";
      case "no-face":
        return "bg-gray-200 text-gray-700 border border-gray-400";
      default:
        return "bg-green-100 text-green-700 border border-green-400";
    }
  };

  return (
    <div className="w-full max-w-md mt-4 relative">
      {/* Floating live alert */}
      {latestEvent && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg animate-bounce ${getClassName(
            latestEvent.type
          )}`}
        >
          <p className="font-semibold">⚠ Detection Alert</p>
          <p className="text-sm">{latestEvent.message}</p>
        </div>
      )}

      {/* Event Log */}
      <div className="bg-gray-100 rounded-lg shadow p-3 h-48 overflow-y-auto text-sm">
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
    </div>
  );
};

export default LogPanel;
