import React, { useEffect } from "react";
import type { DetectionEvent } from "../hooks/useDetectWorker";

interface CandidatePageProps {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  detectionEvents: DetectionEvent[];
  isActive: boolean;
}

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
    <div className="candidate-page flex flex-col p-4 gap-4 w-full max-w-4xl">
      <h2>Candidate Dashboard</h2>

      <div className="flex gap-4">
        <div className="w-1/2">
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

        <div className="w-1/2">
          <h3>Interviewer</h3>
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

      {isActive ? (
        <p>✅ You're connected to the interviewer.</p>
      ) : (
        <p>❌ Waiting to start interview…</p>
      )}
    </div>
  );
};

export default CandidatePage;
