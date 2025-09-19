import { Request, Response } from "express";
import mongoose from "mongoose";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../config/s3";
import SessionModel from "../models/session.model";

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

/**
 * POST /api/upload-url
 */
export const getUploadUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { sessionId, fileName, fileType } = req.body;

    if (!sessionId || !fileName || !fileType) {
      res
        .status(400)
        .json({
          success: false,
          message: "sessionId, fileName, and fileType required",
        });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      res.status(400).json({ success: false, message: "Invalid session _id" });
      return;
    }

    const key = `recordings/${sessionId}/${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

    await SessionModel.findByIdAndUpdate(sessionId, {
      $set: { recordingUrl: key },
    });

    res.json({ success: true, uploadUrl: signedUrl, fileKey: key });
  } catch (err) {
    console.error("getUploadUrl error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error generating upload URL" });
  }
};

/**
 * GET /api/download-url/:fileKey
 */
export const getDownloadUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { fileKey } = req.params;
    if (!fileKey) {
      res.status(400).json({ success: false, message: "fileKey required" });
      return;
    }

    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

    res.json({ success: true, downloadUrl: signedUrl });
  } catch (err) {
    console.error("getDownloadUrl error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error generating download URL",
      });
  }
};
