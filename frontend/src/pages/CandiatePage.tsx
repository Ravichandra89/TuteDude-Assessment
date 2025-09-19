// src/pages/CandidatePage.tsx
import React, { useEffect } from "react";
import type { DetectionEvent } from "../hooks/useDetectWorker";
import { Video, VideoOff, Wifi, WifiOff, Clock, User } from "lucide-react";

interface CandidatePageProps {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  detectionEvents: DetectionEvent[];
  isActive: boolean;
}

const StatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <div
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-sm ${
      isActive ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
    }`}
    role="status"
    aria-live="polite"
  >
    {isActive ? (
      <>
        <Wifi className="w-4 h-4" />
        <span>Connected to Interviewer</span>
      </>
    ) : (
      <>
        <WifiOff className="w-4 h-4" />
        <span>Waiting to Start Interview</span>
      </>
    )}
  </div>
);

const VideoCard: React.FC<{
  title: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isLocal?: boolean;
  icon: React.ReactNode;
}> = ({ title, videoRef, stream, isLocal = false, icon }) => (
  <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl shadow p-3">
    <div className="flex items-center gap-3 mb-3">
      <div className="text-foreground text-lg">{icon}</div>
      <div className="text-sm font-semibold">{title}</div>
    </div>

    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-64 bg-black rounded-lg object-cover border-2 ${
          isLocal ? "scale-x-[-1]" : ""
        }`}
      />
      <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/60 text-white rounded-md text-xs flex items-center gap-2">
        {stream ? (
          <>
            <Video className="w-3 h-3" />
            <span>{stream.id.slice(0, 8)}...</span>
          </>
        ) : (
          <>
            <VideoOff className="w-3 h-3" />
            <span>No stream</span>
          </>
        )}
      </div>
    </div>
  </div>
);

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
                    {new Date(event.timestamp).toLocaleTimeString()}
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

const CandidatePage: React.FC<CandidatePageProps> = ({
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  detectionEvents,
  isActive,
}) => {
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      console.log(
        "[CandidatePage] attached localStream:",
        localStream?.id ?? "none"
      );
    }
  }, [localStream, localVideoRef]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log(
        "[CandidatePage] attached remoteStream:",
        remoteStream?.id ?? "none"
      );
    }
  }, [remoteStream, remoteVideoRef]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              Interview Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Your virtual interview environment
            </p>
          </div>
          <StatusBadge isActive={isActive} />
        </div>

        {/* Videos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <VideoCard
            title="Your Camera"
            videoRef={localVideoRef}
            stream={localStream}
            isLocal
            icon={<User className="w-5 h-5" />}
          />
          <VideoCard
            title="Interviewer"
            videoRef={remoteVideoRef}
            stream={remoteStream}
            icon={<Video className="w-5 h-5" />}
          />
        </div>

        {/* Bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DetectionEventsList events={detectionEvents} />
          </div>

          <div className="space-y-4">
            <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl shadow p-4">
              <h3 className="text-lg font-semibold mb-2">Interview Tips</h3>
              <div className="text-sm text-gray-600">
                <ul className="list-inside space-y-2">
                  <li>• Maintain eye contact with the camera</li>
                  <li>• Ensure good lighting on your face</li>
                  <li>• Keep a professional background</li>
                  <li>• Test your audio and video quality</li>
                </ul>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl shadow p-4">
              <h4 className="text-sm font-medium mb-2">Quick Status</h4>
              <div className="text-sm text-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span>Local stream</span>
                  <strong>
                    {localStream?.id
                      ? localStream.id.slice(0, 8) + "..."
                      : "none"}
                  </strong>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span>Remote stream</span>
                  <strong>
                    {remoteStream?.id
                      ? remoteStream.id.slice(0, 8) + "..."
                      : "none"}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Connected</span>
                  <strong>{isActive ? "Yes" : "No"}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidatePage;
