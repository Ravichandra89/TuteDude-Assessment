import React, { useEffect } from "react";
import type { DetectionEvent } from "../hooks/useDetectWorker";
import DetectionOverlay from "../components/DetectionOverlay";
import LogPanel from "../components/LogPanel";

interface InterviewerPageProps {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  detectionEvents: DetectionEvent[];
  setDetectionEvents: React.Dispatch<React.SetStateAction<DetectionEvent[]>>;
  isActive: boolean;
}

const InterviewerPage: React.FC<InterviewerPageProps> = ({
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  detectionEvents,
  setDetectionEvents,
  isActive,
}) => {
  // Attach streams passed from parent to the refs
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      console.log(
        "[InterviewerPage] attached localStream:",
        localStream?.id ?? "none"
      );
    }
  }, [localStream, localVideoRef]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      console.log(
        "[InterviewerPage] attached remoteStream:",
        remoteStream?.id ?? "none"
      );
    }
  }, [remoteStream, remoteVideoRef]);

  const handleDetection = (evt: DetectionEvent) => {
    setDetectionEvents((prev) => [...prev, evt]);
  };

  return (
    <div className="interviewer-page flex flex-col p-4 gap-4 w-full max-w-4xl">
      <h2>Interviewer Dashboard</h2>

      <div className="video-section grid grid-cols-2 gap-4">
        <div>
          <h3>Your Camera</h3>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 bg-black rounded object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <div className="text-sm mt-1">
            Local stream id: {localStream?.id ?? "none"}
          </div>
        </div>

        <div>
          <h3>Candidate</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-64 bg-black rounded object-cover"
          />
          <div className="text-sm mt-1">
            Remote stream id: {remoteStream?.id ?? "none"}
          </div>
        </div>
      </div>

      {remoteStream && (
        <DetectionOverlay
          videoRef={remoteVideoRef}
          events={detectionEvents}
          onDetect={handleDetection}
        />
      )}

      <LogPanel events={detectionEvents} />
    </div>
  );
};

export default InterviewerPage;
