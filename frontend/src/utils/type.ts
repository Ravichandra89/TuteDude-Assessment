export type EventType =
  | "LookingAway"
  | "NoFace"
  | "MultipleFaces"
  | "PhoneDetected"
  | "BookDetected"
  | "DeviceDetected"
  | "FocusLost"
  | "FOCUS_LOST"
  | "NO_FACE";

export interface DetectionEvent {
  type: EventType;
  timestamp?: string;
  start?: string;
  end?: string;
  durationMs?: number;
  confidence?: number;
  meta?: Record<string, unknown>;
}

export interface FaceDetectionResult {
  type: "face";
  bbox?: [number, number, number, number];
  landmarks?: number[] | Array<[number, number]>;
  label?: string;
  confidence?: number;
}

export interface ObjectDetectionResult {
  type: "object";
  label: string;
  bbox: [number, number, number, number];
  confidence: number;
}

export type DetectionResult = FaceDetectionResult | ObjectDetectionResult;

export interface SessionInfo {
  sessionId: string;
  candidateName?: string;
  startedAt?: string;
  endedAt?: string;
  recordingKey?: string;
}

export interface UploadUrlResponse {
  success: boolean;
  uploadUrl: string;
  fileKey: string;
  expires?: number;
}

export interface PostLogsPayload {
  sessionId: string;
  candidateName?: string;
  events: DetectionEvent[];
}

export interface ReportResponse {
  success: boolean;
  data?: {
    candidateName?: string;
    interviewDuration?: number | null;
    focusLostCount?: number;
    absenceCount?: number;
    multipleFacesCount?: number;
    suspiciousItems?: string[];
    integrityScore?: number;
    events?: DetectionEvent[];
    pdfUrl?: string;
  };
  message?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
  original?: unknown;
}

export const nowIso = (): string => new Date().toISOString();

export const formatTime = (iso?: string): string => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString();
  } catch {
    return iso;
  }
};

export const msToSecondsRounded = (ms?: number | null): number | null =>
  typeof ms === "number" ? Math.round(ms / 1000) : null;

export const clamp = (v: number, min = 0, max = 1): number => {
  if (isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
};

export const canonicalizeEventType = (t: EventType): EventType => {
  switch (t) {
    case "LookingAway":
    case "FocusLost":
      return "FOCUS_LOST";
    case "NoFace":
      return "NO_FACE";
    default:
      return t;
  }
};
