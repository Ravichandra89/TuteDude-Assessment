import React, { useRef, useState, useEffect } from "react";
import useMediaStream from "../hooks/useMediaStream";
import { useWebRTC } from "../hooks/useWebRTC";
import type { Role } from "../hooks/useWebRTC";
import VideoPreview from "../components/VideoPreview";
import DetectionOverlay from "../components/DetectionOverlay";
import LogPanel from "../components/LogPanel";
import type { DetectionEvent } from "../hooks/useDetectWorker";

const InterviewPage: React.FC = () => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const {
    stream: localStream,
    start: startCamera,
    stop: stopCamera,
  } = useMediaStream();

  const { remoteStreams, startConnection, closeConnection, isConnected } =
    useWebRTC();

  const [isActive, setIsActive] = useState(false);
  const [roomId] = useState("interview-room-123");
  const [detectionEvents, setDetectionEvents] = useState<DetectionEvent[]>([]);

  const searchParams = new URLSearchParams(window.location.search);
  const role: Role = (searchParams.get("role") as Role) || "candidate";

  // Attach local video
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream ?? null;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Start interview: camera + WebRTC + detection
  const handleStart = async () => {
    try {
      const stream = await startCamera({ video: true, audio: true });
      await startConnection(roomId, role, stream);
      setIsActive(true);

      // Automatically start detection loop in VideoPreview
      if (localVideoRef.current) {
        localVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("[InterviewPage] start error:", err);
      alert("Cannot access camera. Check permissions.");
    }
  };

  const handleStop = () => {
    closeConnection();
    stopCamera();
    setIsActive(false);
    setDetectionEvents([]);
  };

  return (
    <div className="min-h-screen p-6 flex flex-col items-center bg-gray-100">
      <h1 className="text-2xl font-bold mb-6">
        🎥{" "}
        {role === "candidate"
          ? "Candidate Join Interview Panel"
          : "Interviewer Joined Interview Panel"}
      </h1>

      <div className="mb-4 flex items-center gap-2">
        <span
          className={`w-3 h-3 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="relative col-span-2">
          <VideoPreview videoRef={localVideoRef} />
          <DetectionOverlay videoRef={localVideoRef} events={detectionEvents} />
        </div>
        <div>
          <LogPanel events={detectionEvents} />
        </div>
      </div>

      <div className="w-full max-w-6xl mt-8">
        <h2 className="text-lg font-semibold mb-2">Participants</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(remoteStreams).map(([id, stream]) => (
            <video
              key={id}
              autoPlay
              playsInline
              className="w-full h-40 bg-black object-cover rounded"
              ref={(el) => {
                if (el) el.srcObject = stream ?? null;
              }}
            />
          ))}
          {Object.keys(remoteStreams).length === 0 && (
            <span className="text-gray-500 col-span-full text-center">
              Waiting for participants...
            </span>
          )}
        </div>
      </div>

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
