// src/services/s3Upload.ts
import api from "./api";
import axios, { AxiosError } from "axios";

/**
 * Types
 */
type UploadUrlResponse = {
  success: boolean;
  uploadUrl: string; 
  fileKey: string; 
  expires?: number;
};

type NormalizedError = {
  message: string;
  status?: number;
  details?: unknown;
};


const normalizeError = (err: unknown): NormalizedError => {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError;
    return {
      message: axiosErr.message || "Request failed",
      status: axiosErr.response?.status,
      details: axiosErr.response?.data,
    };
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: "Unknown error occurred" };
};

/**
 * Request a signed upload URL from backend.
 * Backend endpoint expected: POST /upload  { sessionId, fileName, fileType }
 */
export const requestUploadUrl = async (
  sessionId: string,
  fileName: string,
  fileType: string
): Promise<UploadUrlResponse> => {
  try {
    const { data } = await api.post("/upload", {
      sessionId,
      fileName,
      fileType,
    });
    return {
      success: true,
      uploadUrl: data.uploadUrl,
      fileKey: data.fileKey,
      expires: data.expires,
    };
  } catch (err) {
    throw normalizeError(err);
  }
};

/**
 * Upload a Blob/ArrayBuffer to the signed S3 URL using PUT.
 * Uses axios.put to send blob directly to S3.
 */
export const uploadBlobToSignedUrl = async (
  uploadUrl: string,
  blob: Blob
): Promise<void> => {
  try {
    await axios.put(uploadUrl, blob, {
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch (err) {
    throw normalizeError(err);
  }
};

/**
 * Convenience: upload a MediaRecorder Blob (or any blob) for the session.
 * Returns fileKey (S3 key) on success.
 */
export const uploadRecording = async (
  sessionId: string,
  fileName: string,
  blob: Blob
): Promise<{ fileKey: string }> => {
  try {
    const fileType = blob.type || "video/webm";
    const { uploadUrl, fileKey } = await requestUploadUrl(
      sessionId,
      fileName,
      fileType
    );
    await uploadBlobToSignedUrl(uploadUrl, blob);
    return { fileKey };
  } catch (err) {
    throw normalizeError(err);
  }
};
