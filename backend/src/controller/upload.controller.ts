import { Request, Response } from "express";
import s3 from "../config/s3"; // ✅ default import
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import SessionModel from "../models/session.model";
import mongoose from "mongoose";

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

export const getUploadUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { sessionId, fileName, fileType } = req.body;

    if (!sessionId || !fileName || !fileType) {
      res.status(400).json({
        success: false,
        message: "sessionId, fileName, and fileType required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      res.status(400).json({ success: false, message: "Invalid sessionId" });
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
      $push: { recordings: key },
    });

    res.status(200).json({
      success: true,
      uploadUrl: signedUrl,
      fileKey: key,
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error generating upload URL" });
  }
};

export const getDownloadUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { fileKey } = req.params;

    if (!fileKey) {
      res.status(400).json({ success: false, message: "fileKey is required" });
      return;
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });

    res.status(200).json({
      success: true,
      downloadUrl: signedUrl,
    });
  } catch (error) {
    console.error("Error generating download URL:", error);
    res.status(500).json({
      success: false,
      message: "Server error generating download URL",
    });
  }
};
