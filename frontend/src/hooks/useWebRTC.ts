// src/hooks/useWebRTC.ts
import { useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

export type Role = "candidate" | "interviewer";
type RemoteStreams = Record<string, MediaStream>;

interface ServerEvents {
  ready: { participants: Array<string | { id: string; role?: string }> };
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

  /** 🔌 Connect signaling socket */
  const connectSocket = () => {
    if (socket.current) return;

    socket.current = io("http://localhost:4000");

    /** 📩 Offer received → candidate side */
    socket.current.on(
      "offer",
      async ({ from, offer }: ServerEvents["offer"]) => {
        console.log("[useWebRTC] Received offer from", from);

        const pc = createPeerConnection(from);

        // ✅ add local tracks before answering
        addLocalTracks(pc);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.current?.emit("answer", { to: from, answer });
        console.log("[useWebRTC] Sent answer to", from);
      }
    );

    /** 📩 Answer received → interviewer side */
    socket.current.on(
      "answer",
      async ({ from, answer }: ServerEvents["answer"]) => {
        const pc = pcs.current[from];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log("[useWebRTC] Set remote description from answer", from);
        } else {
          console.warn("[useWebRTC] Received answer but no pc found for", from);
        }
      }
    );

    /** 📩 ICE candidate received */
    socket.current.on(
      "ice-candidate",
      async ({ from, candidate }: ServerEvents["ice-candidate"]) => {
        const pc = pcs.current[from];
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("[useWebRTC] Added ICE candidate from", from);
          } catch (err) {
            console.error("Error adding ICE candidate", err);
          }
        } else {
          console.warn(
            "[useWebRTC] ICE candidate received but no pc for",
            from
          );
        }
      }
    );

    /** 👋 Peer left */
    socket.current.on(
      "participant-left",
      ({ id }: ServerEvents["participant-left"]) => {
        console.log("[useWebRTC] Peer left:", id);
        if (pcs.current[id]) {
          pcs.current[id].close();
          delete pcs.current[id];
        }
        setRemoteStreams((prev) => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
      }
    );
  };

  /** 🛠️ Create PeerConnection (with STUN) */
  const createPeerConnection = (id: string) => {
    // Add a public STUN server for better NAT traversal (keeps logic intact)
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcs.current[id] = pc;

    pc.ontrack = (event) => {
      console.log("🎥 Remote track received from", id, event.streams[0]);
      setRemoteStreams((prev) => ({ ...prev, [id]: event.streams[0] }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.current?.emit("ice-candidate", {
          to: id,
          candidate: event.candidate,
        });
        console.log("[useWebRTC] Emitted ICE candidate to", id);
      }
    };

    return pc;
  };

  /** ➕ Add all local tracks */
  const addLocalTracks = (pc: RTCPeerConnection) => {
    if (!localStreamRef.current) {
      console.warn("[useWebRTC] No localStreamRef when trying to add tracks");
      return;
    }
    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
      console.log("[useWebRTC] Added local track:", track.kind);
    });
  };

  /** 🚀 Start connection */
  const startConnection = async (
    roomId: string,
    role: Role,
    localStream: MediaStream
  ) => {
    connectSocket();
    localStreamRef.current = localStream;

    socket.current?.emit("join", { roomId, role });

    if (role === "interviewer") {
      // interviewer creates the offer
      socket.current?.once(
        "ready",
        async ({
          participants,
        }: {
          participants: Array<string | { id: string; role?: string }>;
        }) => {
          // Normalize participants to IDs (handle server returning objects or strings)
          const myId = socket.current?.id;
          const ids = participants.map((p) =>
            typeof p === "string" ? p : p.id
          );
          const others = ids.filter((pId) => pId !== myId);
          if (others.length === 0) {
            console.log(
              "[useWebRTC] No other participants found in ready list"
            );
            return;
          }

          const peerId = others[0];
          console.log("[useWebRTC] Interviewer found candidate:", peerId);

          const pc = createPeerConnection(peerId);

          // ✅ add tracks before creating offer
          addLocalTracks(pc);

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          // Ensure 'to' is a plain ID string
          socket.current?.emit("offer", { to: peerId, offer });
          console.log("[useWebRTC] Sent offer to", peerId);
        }
      );
    }

    setIsConnected(true);
  };

  /** ❌ Close everything */
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
