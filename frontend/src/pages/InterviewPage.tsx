import React, { useRef, useState, useEffect } from "react";
import { useMediaStream } from "../hooks/useMediaStream";
import { useWebRTC } from "../hooks/useWebRTC";
import type { Role } from "../hooks/useWebRTC";
import type { DetectionEvent } from "../hooks/useDetectWorker";

// Components
import InterviewerPage from "./InterviewerPage";
import CandidatePage from "./CandiatePage";

const InterviewPage: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const role: Role = (searchParams.get("role") as Role) || "candidate";

  const { start: startCamera, stop: stopCamera } = useMediaStream();
  const { startConnection, closeConnection, isConnected, remoteStreams } =
    useWebRTC();

  const [isActive, setIsActive] = useState(false);
  const [roomId] = useState("interview-room-123");
  const [detectionEvents, setDetectionEvents] = useState<DetectionEvent[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  /** Start interview: camera + WebRTC */
  const handleStart = async () => {
    try {
      const stream = await startCamera({ video: true, audio: true });
      console.log("[InterviewPage] got local stream:", stream.id, stream);
      setLocalStream(stream);

      // Attach preview immediately
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Start signaling + WebRTC using the same stream
      await startConnection(roomId, role, stream);
      setIsActive(true);
    } catch (err) {
      console.error("[InterviewPage] start error:", err);
      alert("Cannot access camera. Check permissions.");
    }
  };

  /** Stop interview */
  const handleStop = () => {
    closeConnection();
    stopCamera();
    setIsActive(false);
    setDetectionEvents([]);
    setLocalStream(null);
    setRemoteStream(null);

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  /** Update first remote stream whenever remoteStreams changes */
  useEffect(() => {
    console.log("[InterviewPage] remoteStreams changed:", remoteStreams);
    const streamsArray = Object.values(remoteStreams);
    const first = streamsArray[0] || null;
    setRemoteStream(first);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = first;
      console.log(
        "[InterviewPage] attached remote stream to remoteVideoRef:",
        first ? first.id : null
      );
    }
  }, [remoteStreams]);

  // Helpful debug: print local/remote stream ids
  useEffect(() => {
    console.log("[InterviewPage] localStream id:", localStream?.id ?? "none");
  }, [localStream]);

  useEffect(() => {
    console.log("[InterviewPage] remoteStream id:", remoteStream?.id ?? "none");
  }, [remoteStream]);

  return (
    <div className="min-h-screen p-6 flex flex-col items-center bg-gray-100">
      <h1 className="text-2xl font-bold mb-6">
        🎥{" "}
        {role === "candidate"
          ? "Candidate Join Interview Panel"
          : "Interviewer Dashboard"}
      </h1>

      {/* Connection status */}
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`w-3 h-3 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>

      {/* Role-based pages handle video */}
      {role === "interviewer" ? (
        <InterviewerPage
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          localStream={localStream}
          remoteStream={remoteStream}
          detectionEvents={detectionEvents}
          setDetectionEvents={setDetectionEvents}
          isActive={isActive}
        />
      ) : (
        <CandidatePage
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          localStream={localStream}
          remoteStream={remoteStream}
          detectionEvents={detectionEvents}
          isActive={isActive}
        />
      )}

      {/* Start/Stop buttons */}
      <div className="mt-6 flex gap-4">
        {!isActive ? (
          <button
            onClick={handleStart}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Start Interview
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Stop Interview
          </button>
        )}
      </div>
    </div>
  );
};

export default InterviewPage;
