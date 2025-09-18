import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useMediaStream - hook to manage webcam/microphone stream -
 *  - Accessing user media (camera/mic)
 *  - Starting/stopping the stream
 *  - Capturing frames from a video element
 *  - Creating MediaRecorder for recording
 *  - Handles errors and cleanup
 *
 */

type StartConstraints = MediaStreamConstraints;

export const useMediaStream = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const isStoppingRef = useRef(false);

  // Keep the latest stream in a ref for helpers that need it
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Start camera (and mic if requested)
  const start = useCallback(
    async (
      constraints: StartConstraints = {
        video: { width: 640, height: 480 },
        audio: false,
      }
    ) => {
      try {
        setError(null);
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (isStoppingRef.current) {
          s.getTracks().forEach((t) => t.stop());
          throw new Error("Start aborted due to stop() in progress");
        }
        setStream(s);
        return s;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      }
    },
    []
  );

  // Stop the stream and all tracks
  const stop = useCallback(() => {
    try {
      isStoppingRef.current = true;
      if (!streamRef.current) {
        setStream(null);
        isStoppingRef.current = false;
        return;
      }
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.error("Error stopping track", err);
        }
      });
      setStream(null);
    } finally {
      setTimeout(() => {
        isStoppingRef.current = false;
      }, 100);
    }
  }, []);

  // Create MediaRecorder for the current stream
  const getMediaRecorder = useCallback(
    (options?: MediaRecorderOptions): MediaRecorder => {
      const s = streamRef.current;
      if (!s) throw new Error("No active MediaStream. Call start() first.");
      if (typeof MediaRecorder === "undefined") {
        throw new Error("MediaRecorder is not supported in this browser.");
      }
      return new MediaRecorder(s, options);
    },
    []
  );

  // Capture frame from <video>
  const captureFrame = useCallback(
    (
      videoEl: HTMLVideoElement | null,
      mimeType = "image/jpeg",
      quality = 0.8
    ): Promise<Blob> => {
      return new Promise<Blob>((resolve, reject) => {
        if (!videoEl) return reject(new Error("video element is required"));
        try {
          const width = videoEl.videoWidth || 640;
          const height = videoEl.videoHeight || 480;

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Failed to get canvas context"));

          ctx.drawImage(videoEl, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob)
                return reject(new Error("Failed to capture image blob"));
              resolve(blob);
            },
            mimeType,
            quality
          );
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          reject(e);
        }
      });
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        isStoppingRef.current = true;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              // ignore
            }
          });
        }
      } finally {
        isStoppingRef.current = false;
      }
    };
  }, []);

  return {
    stream,
    isStreaming: !!stream,
    error,
    start,
    stop,
    getMediaRecorder,
    captureFrame,
  };
};

export default useMediaStream;
