// src/hooks/useBulkLogger.ts
import { useEffect, useRef, useCallback } from "react";

type DetectionEventPayload = {
  type: string;
  message: string;
  timestamp: number;
  candidateId?: string;
  sessionId?: string;
};

export function useBulkLogger({
  uploadUrl,
  batchSize = 20,
  intervalMs = 5000,
  candidateId,
  sessionId,
}: {
  uploadUrl: string;
  batchSize?: number;
  intervalMs?: number;
  candidateId?: string;
  sessionId?: string;
}) {
  const queueRef = useRef<DetectionEventPayload[]>([]);
  const timerRef = useRef<number | null>(null);
  const isUploadingRef = useRef(false);

  const push = useCallback(
    (evt: DetectionEventPayload) => {
      queueRef.current.push({ ...evt, candidateId, sessionId });
      if (queueRef.current.length >= batchSize) {
        flush();
      }
    },
    [candidateId, sessionId, batchSize]
  );

  const flush = useCallback(async () => {
    if (isUploadingRef.current) return;
    if (queueRef.current.length === 0) return;
    isUploadingRef.current = true;
    const payload = queueRef.current.splice(0, queueRef.current.length);
    try {
      await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: payload }),
      });
    } catch (err) {
      console.error("[BulkLogger] upload failed, re-queueing", err);
      // requeue on failure (simple)
      queueRef.current.unshift(...payload);
    } finally {
      isUploadingRef.current = false;
    }
  }, [uploadUrl]);

  // Auto flush interval
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      flush();
    }, intervalMs);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      flush();
    };
  }, [intervalMs, flush]);

  return { push, flush };
}
