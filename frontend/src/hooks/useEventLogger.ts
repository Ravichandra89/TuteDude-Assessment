import { useCallback, useRef } from "react";

export type EventLog = {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export function useEventLogger() {
  const logsRef = useRef<EventLog[]>([]);

  // Generate a new log entry
  const logEvent = useCallback(
    (
      type: string,
      message: string,
      metadata?: Record<string, unknown>
    ): EventLog => {
      const log: EventLog = {
        id:
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        type,
        message,
        timestamp: new Date().toISOString(),
        metadata,
      };

      logsRef.current.push(log);

      // Debugging in dev
      console.log("[EventLogger] New Event:", log);

      return log;
    },
    []
  );

  // Get all logs
  const getLogs = useCallback(() => {
    return [...logsRef.current];
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    logsRef.current = [];
    console.log("[EventLogger] Logs cleared");
  }, []);

  return {
    logEvent,
    getLogs,
    clearLogs,
  };
}
