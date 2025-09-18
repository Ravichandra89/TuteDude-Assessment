import { useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

export type Role = "candidate" | "interviewer";
type RemoteStreams = Record<string, MediaStream>;

interface ServerEvents {
  offer: { from: string; offer: RTCSessionDescriptionInit };
  answer: { from: string; answer: RTCSessionDescriptionInit };
  "ice-candidate": { from: string; candidate: RTCIceCandidateInit };
  "participant-left": { id: string };
}

export const useWebRTC = () => {
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreams>({});
  const [isConnected, setIsConnected] = useState(false);

  const pcs = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const socket = useRef<Socket | null>(null);

  const connectSocket = () => {
    if (!socket.current) {
      socket.current = io("http://localhost:4000");

      // Offer received (candidate)
      socket.current.on(
        "offer",
        async ({ from, offer }: ServerEvents["offer"]) => {
          console.log("[useWebRTC] Received offer from", from);

          const pc = createPeerConnection(from);
          await pc.setRemoteDescription(offer);
          addLocalTracks(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.current?.emit("answer", { to: from, answer });
        }
      );

      // Answer received (interviewer)
      socket.current.on(
        "answer",
        async ({ from, answer }: ServerEvents["answer"]) => {
          const pc = pcs.current[from];
          if (pc) {
            await pc.setRemoteDescription(answer);
          }
        }
      );

      // ICE candidate received
      socket.current.on(
        "ice-candidate",
        async ({ from, candidate }: ServerEvents["ice-candidate"]) => {
          const pc = pcs.current[from];
          if (pc && candidate) {
            await pc.addIceCandidate(candidate);
          }
        }
      );

      // Participant left
      socket.current.on(
        "participant-left",
        ({ id }: ServerEvents["participant-left"]) => {
          delete pcs.current[id];
          setRemoteStreams((prev) => {
            const newStreams = { ...prev };
            delete newStreams[id];
            return newStreams;
          });
        }
      );
    }
  };

  const createPeerConnection = (id: string) => {
    const pc = new RTCPeerConnection();
    pcs.current[id] = pc;

    pc.ontrack = (event) => {
      console.log("🔊 Remote track received from", id, event.streams[0]);
      setRemoteStreams((prev) => ({ ...prev, [id]: event.streams[0] }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current?.emit("ice-candidate", {
          to: id,
          candidate: event.candidate,
        });
      }
    };

    return pc;
  };

  const addLocalTracks = (pc: RTCPeerConnection) => {
    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStreamRef.current!));
    }
  };

  const startConnection = async (
    roomId: string,
    role: Role,
    localStream: MediaStream
  ) => {
    connectSocket();
    localStreamRef.current = localStream;

    socket.current?.emit("join", { roomId, role });

    // Wait a short time for the other participant to join
    await new Promise((res) => setTimeout(res, 500));

    if (role === "interviewer") {
      const otherId = "candidate"; // simple one-to-one mapping
      const pc = createPeerConnection(otherId);
      addLocalTracks(pc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.current?.emit("offer", { to: otherId, offer });
    }

    setIsConnected(true);
  };

  const closeConnection = () => {
    Object.values(pcs.current).forEach((pc) => pc.close());
    pcs.current = {};
    localStreamRef.current = null;
    setRemoteStreams({});
    setIsConnected(false);
    socket.current?.disconnect();
    socket.current = null;
  };

  return { remoteStreams, startConnection, closeConnection, isConnected };
};
