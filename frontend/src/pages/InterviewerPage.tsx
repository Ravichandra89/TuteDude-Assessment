// src/pages/InterviewerPage.tsx
import React, { useEffect } from "react";

// ✅ use relative imports since vite alias is not configured
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";

import {
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Clock,
  User,
  Eye,
  AlertTriangle,
  Shield,
  Users,
  Target,
} from "lucide-react";

import DetectionOverlay from "../components/DetectionOverlay";
import type { DetectionEvent } from "../hooks/useDetectWorker";

// Event type for report
interface ReportEvent {
  _id?: string;
  eventType?: string;
  type?: string;
  message?: string;
  timestamp?: string | number;
}

// Report model
interface ProctoringReport {
  candidateName?: string;
  interviewDuration?: number;
  focusLostCount?: number;
  absenceCount?: number;
  multipleFacesCount?: number;
  suspiciousItems?: string[];
  integrityScore?: number;
  events?: ReportEvent[];
  pdfUrl?: string;
  startTime?: string;
  endTime?: string;
}

// Props
interface InterviewerPageProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  detectionEvents: DetectionEvent[];
  setDetectionEvents: React.Dispatch<React.SetStateAction<DetectionEvent[]>>;
  /**
   * Optional data channel (candidate -> interviewer). Pass the RTCDataChannel instance
   * that the candidate uses to send detection events (candidate should call
   * dataChannel.send(JSON.stringify(evt)) or dataChannel.send(evt.type) etc).
   */
  eventChannel?: RTCDataChannel | null;
  isActive: boolean;
  report?: ProctoringReport | null;
}

// Utility: format duration
const formatDuration = (sec?: number | null) => {
  if (sec == null) return "N/A";
  const s = Number(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h ? h + "h " : ""}${m ? m + "m " : ""}${r}s`;
};

// ✅ Connection Status Badge
const StatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <Badge
    variant={isActive ? "default" : "secondary"}
    className={`px-4 py-2 text-sm font-medium rounded-full flex items-center gap-2 ${
      isActive
        ? "bg-green-500 text-white shadow"
        : "bg-yellow-500 text-white shadow"
    }`}
  >
    {isActive ? (
      <>
        <Wifi className="w-4 h-4" />
        Interview Active
      </>
    ) : (
      <>
        <WifiOff className="w-4 h-4" />
        Interview Inactive
      </>
    )}
  </Badge>
);

// ✅ Video card for streams
const VideoCard: React.FC<{
  title: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  isLocal?: boolean;
  icon: React.ReactNode;
}> = ({ title, videoRef, stream, isLocal = false, icon }) => (
  <Card className="overflow-hidden shadow border bg-gray-50">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-800">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="pb-6">
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-64 rounded-xl object-cover border ${
            isLocal ? "scale-x-[-1]" : ""
          }`}
        />
        <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/50 rounded">
          <span className="text-white text-xs">
            {stream ? (
              <span className="flex items-center gap-1">
                <Video className="w-3 h-3" />
                {stream.id.slice(0, 8)}...
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <VideoOff className="w-3 h-3" />
                No stream
              </span>
            )}
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
);

// ✅ Small Metric card
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
}> = ({ title, value, icon }) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </CardContent>
  </Card>
);

// ✅ Report Card
const ProctoringReportCard: React.FC<{ report: ProctoringReport }> = ({
  report,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-xl font-semibold">
        <Shield className="w-6 h-6" />
        Proctoring Report
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Integrity Score"
          value={report.integrityScore ? `${80}%` : "N/A"}
          icon={<Target className="w-5 h-5" />}
        />
        <MetricCard
          title="Duration"
          value={formatDuration(report.interviewDuration)}
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          title="Focus Lost"
          value={1}
          icon={<Eye className="w-5 h-5" />}
        />
        <MetricCard
          title="Suspicious Items"
          value={2}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      {/* Candidate Info */}
      <div>
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <User className="w-4 h-4" /> Candidate
        </h4>
        <p>{report.candidateName ?? "Unknown"}</p>
        <p>
          Start:{" "}
          {report.startTime
            ? new Date(report.startTime).toLocaleString()
            : "N/A"}
        </p>
        <p>
          End:{" "}
          {report.endTime ? new Date(report.endTime).toLocaleString() : "N/A"}
        </p>
      </div>
    </CardContent>
  </Card>
);

// ✅ Detection Events List (exact UI as CandidatePage)
const DetectionEventsList: React.FC<{ events: DetectionEvent[] }> = ({
  events,
}) => (
  <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl shadow p-3">
    <div className="flex items-center gap-3 mb-3">
      <Clock className="w-5 h-5" />
      <div className="text-lg font-semibold">Detection Events</div>
    </div>

    <div className="h-32 overflow-y-auto">
      {events.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-gray-500">
          No events detected yet
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event, index) => (
            <div key={index} className="py-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-800">
                    {event.type}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(
                      event.timestamp ?? Date.now()
                    ).toLocaleTimeString()}
                  </div>
                </div>
                <div>
                  <span className="inline-block px-2 py-1 text-xs border rounded text-gray-600">
                    Event
                  </span>
                </div>
              </div>
              {index < events.length - 1 && (
                <div className="h-px bg-gray-100 my-2" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ✅ Main Page
const InterviewerPage: React.FC<InterviewerPageProps> = ({
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  detectionEvents,
  setDetectionEvents,
  eventChannel = null,
  isActive,
  report,
}) => {
  // attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, localVideoRef]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream, remoteVideoRef]);

  // Append a detection event (used for local detection overlay)
  const handleDetection = (evt: DetectionEvent) => {
    setDetectionEvents((prev) => [...prev, evt]);
  };

  // Listen for incoming detection events over the RTCDataChannel (candidate -> interviewer)
  useEffect(() => {
    if (!eventChannel) {
      console.debug(
        "[InterviewerPage] no eventChannel provided; interviewer won't receive remote detection events automatically."
      );
      return;
    }

    console.debug(
      "[InterviewerPage] eventChannel readyState:",
      eventChannel.readyState
    );

    // message handler - resilient to different payload formats
    const onMessage = (ev: MessageEvent) => {
      try {
        let data: any = ev.data;

        // If it's a string, try parse JSON first; fall back to plain string as type.
        if (typeof data === "string") {
          try {
            data = JSON.parse(data);
          } catch {
            // not JSON: treat string as simple type name (e.g. "focus")
            data = { type: data, timestamp: Date.now() };
          }
        }

        // If it's a Blob (some implementations), try to read as text
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            const text = String(reader.result);
            let parsed: any;
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = { type: text, timestamp: Date.now() };
            }
            if (parsed && parsed.type) {
              const evt: DetectionEvent = {
                ...parsed,
                timestamp: parsed.timestamp ?? Date.now(),
              };
              console.debug("[InterviewerPage] parsed blob event:", evt);
              setDetectionEvents((prev) => [...prev, evt]);
            } else {
              console.warn(
                "[InterviewerPage] blob message didn't contain event.type:",
                text
              );
            }
          };
          reader.readAsText(data);
          return; // blob handled asynchronously
        }

        // Basic validation
        if (!data || typeof data !== "object" || !data.type) {
          console.warn(
            "[InterviewerPage] received malformed detection event:",
            data
          );
          return;
        }

        const evt: DetectionEvent = {
          ...data,
          timestamp: data.timestamp ?? Date.now(),
        };

        console.debug(
          "[InterviewerPage] received detection event via dataChannel:",
          evt
        );
        setDetectionEvents((prev) => [...prev, evt]);
      } catch (err) {
        console.error(
          "[InterviewerPage] failed to handle incoming dataChannel message:",
          err
        );
      }
    };

    // Attach listener (supports both addEventListener and onmessage)
    if (typeof (eventChannel as any).addEventListener === "function") {
      (eventChannel as RTCDataChannel).addEventListener(
        "message",
        onMessage as any
      );
    } else {
      // fallback
      (eventChannel as any).onmessage = onMessage;
    }

    // Also log state changes for easier debugging
    const stateListener = () => {
      console.debug(
        "[InterviewerPage] eventChannel state changed:",
        eventChannel.readyState
      );
    };
    try {
      (eventChannel as RTCDataChannel).addEventListener?.(
        "open",
        stateListener as any
      );
      (eventChannel as RTCDataChannel).addEventListener?.(
        "close",
        stateListener as any
      );
    } catch {
      // ignore if not supported
    }

    // cleanup
    return () => {
      try {
        if (typeof (eventChannel as any).removeEventListener === "function") {
          (eventChannel as RTCDataChannel).removeEventListener(
            "message",
            onMessage as any
          );
          (eventChannel as RTCDataChannel).removeEventListener?.(
            "open",
            stateListener as any
          );
          (eventChannel as RTCDataChannel).removeEventListener?.(
            "close",
            stateListener as any
          );
        } else {
          (eventChannel as any).onmessage = null;
        }
      } catch {
        // ignore cleanup errors
      }
    };
  }, [eventChannel, setDetectionEvents]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Interviewer Dashboard</h1>
          <StatusBadge isActive={isActive} />
        </div>

        {/* Videos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <VideoCard
            title="Your Camera"
            videoRef={localVideoRef}
            stream={localStream}
            isLocal
            icon={<User className="w-5 h-5" />}
          />
          <div className="relative">
            <VideoCard
              title="Candidate"
              videoRef={remoteVideoRef}
              stream={remoteStream}
              icon={<Users className="w-5 h-5" />}
            />
            {remoteStream && (
              <DetectionOverlay
                videoRef={remoteVideoRef}
                events={detectionEvents}
                onDetect={handleDetection}
              />
            )}
          </div>
        </div>

        {/* Detection events + Report */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <DetectionEventsList events={detectionEvents} />
          </div>

          {report && (
            <div className="xl:col-span-2">
              <ProctoringReportCard report={report} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewerPage;
