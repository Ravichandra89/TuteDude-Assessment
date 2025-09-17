import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useWebRTC Hook
 * - Manages peer connection for interviewer <-> candidate
 * - Relies on a WebSocket signaling server
 *
 * Returns:
 *  - localStream: MediaStream | null
 *  - remoteStream: MediaStream | null
 *  - isConnected: boolean
 *  - startConnection(socketUrl: string, constraints?): Promise<void>
 *  - closeConnection(): void
 */

type SignalMessage =
  | { type: "offer"; offer: RTCSessionDescriptionInit }
  | { type: "answer"; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit };

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // --- Setup MediaStream ---
  const initLocalStream = useCallback(
    async (
      constraints: MediaStreamConstraints = { video: true, audio: true }
    ) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
        return stream;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    []
  );

  // --- Setup Connection ---
  const startConnection = useCallback(
    async (socketUrl: string, constraints?: MediaStreamConstraints) => {
      try {
        setError(null);

        // Init WebSocket signaling
        wsRef.current = new WebSocket(socketUrl);

        wsRef.current.onopen = () => {
          console.log("[WebRTC] WebSocket connected for signaling");
        };

        wsRef.current.onerror = (e) => {
          console.error("[WebRTC] WebSocket error", e);
        };

        wsRef.current.onclose = () => {
          console.log("[WebRTC] WebSocket closed");
        };

        // Init peer connection
        peerRef.current = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        // Setup remote stream container
        const remote = new MediaStream();
        setRemoteStream(remote);

        // When remote tracks arrive, push them
        peerRef.current.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            remote.addTrack(track);
          });
        };

        // ICE candidate handling
        peerRef.current.onicecandidate = (event) => {
          if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "ice-candidate",
                candidate: event.candidate,
              })
            );
          }
        };

        // Listen for signaling messages
        wsRef.current.onmessage = async (msg) => {
          try {
            const data: SignalMessage = JSON.parse(msg.data);

            if (data.type === "offer") {
              console.log("[WebRTC] Received offer");
              await peerRef.current?.setRemoteDescription(
                new RTCSessionDescription(data.offer)
              );

              const answer = await peerRef.current?.createAnswer();
              if (answer) {
                await peerRef.current?.setLocalDescription(answer);
                wsRef.current?.send(JSON.stringify({ type: "answer", answer }));
              }
            } else if (data.type === "answer") {
              console.log("[WebRTC] Received answer");
              await peerRef.current?.setRemoteDescription(
                new RTCSessionDescription(data.answer)
              );
            } else if (data.type === "ice-candidate") {
              console.log("[WebRTC] Received ICE candidate");
              try {
                await peerRef.current?.addIceCandidate(
                  new RTCIceCandidate(data.candidate)
                );
              } catch (err) {
                console.error("[WebRTC] Failed to add ICE candidate", err);
              }
            }
          } catch (err) {
            console.error("[WebRTC] Error handling signaling message", err);
          }
        };

        // Attach local stream
        const stream = await initLocalStream(constraints);
        stream.getTracks().forEach((track) => {
          peerRef.current?.addTrack(track, stream);
        });

        // Create offer if initiating
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);

        wsRef.current.send(JSON.stringify({ type: "offer", offer }));

        setIsConnected(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [initLocalStream]
  );

  // --- Close connection ---
  const closeConnection = useCallback(() => {
    try {
      peerRef.current?.close();
      peerRef.current = null;

      wsRef.current?.close();
      wsRef.current = null;

      localStream?.getTracks().forEach((track) => track.stop());
      setLocalStream(null);

      setRemoteStream(null);
      setIsConnected(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, [closeConnection]);

  return {
    localStream,
    remoteStream,
    isConnected,
    error,
    startConnection,
    closeConnection,
  };
};

export default useWebRTC;
