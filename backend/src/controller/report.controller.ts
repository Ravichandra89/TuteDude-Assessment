// src/controller/report.controller.ts
import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { generatePDFReport } from "../services/report.service";
import SessionModel from "../models/session.model";
import CandidateModel from "../models/candidate.model";
import EventModel from "../models/event.model";
import s3 from "../config/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "tutedudeassessmentbucket";

export const generateReport = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId)
      return res
        .status(400)
        .json({ success: false, message: "Missing sessionId" });

    // Fetch session, candidate, events
    const session = await SessionModel.findById(sessionId);
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });

    const candidate = await CandidateModel.findById(session.candidateId);
    const events = await EventModel.find({ sessionId }).sort({ timestamp: 1 });

    // Build report data
    let focusLost = 0,
      absence = 0,
      multiFaces = 0,
      suspicious: string[] = [];

    for (const e of events) {
      switch (e.eventType) {
        case "FOCUS_LOST":
          focusLost++;
          break;
        case "NO_FACE":
          absence++;
          break;
        case "MULTIPLE_FACES":
          multiFaces++;
          break;
        case "PHONE_DETECTED":
        case "NOTES_DETECTED":
        case "DEVICE_DETECTED":
          suspicious.push(e.message);
          break;
      }
    }

    let integrityScore =
      100 -
      (focusLost * 2 + absence * 5 + multiFaces * 10 + suspicious.length * 5);
    integrityScore = Math.max(0, integrityScore);

    const reportData = {
      candidateName: candidate?.name || "Unknown",
      interviewDuration:
        session.startTime && session.endTime
          ? (new Date(session.endTime).getTime() -
              new Date(session.startTime).getTime()) /
            1000
          : null,
      focusLostCount: focusLost,
      absenceCount: absence,
      multipleFacesCount: multiFaces,
      suspiciousItems: suspicious,
      integrityScore,
      events,
    };

    // 1️⃣ Generate PDF locally
    const pdfPath = await generatePDFReport(reportData, sessionId);

    // 2️⃣ Read PDF into buffer
    const pdfBuffer = fs.readFileSync(pdfPath);
    const fileName = path.basename(pdfPath);
    const fileType = "application/pdf";
    const key = `recordings/${sessionId}/${Date.now()}-${fileName}`;

    // 3️⃣ Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: pdfBuffer,
      ContentType: fileType,
    });
    await s3.send(command);

    // 4️⃣ Save S3 key in session
    session.recordingUrl = key;
    await session.save();

    // 5️⃣ Generate a signed URL for download
    const signedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
      { expiresIn: 60 * 60 } // 1 hour expiry
    );

    // 6️⃣ Return report data + signed PDF URL
    res.json({
      success: true,
      message: "Report generated",
      data: { ...reportData, pdfUrl: signedUrl },
    });

    // ✅ Optional: remove local PDF file after upload
    fs.unlink(pdfPath, (err) => {
      if (err) console.warn("Failed to remove local PDF:", err);
    });
  } catch (err) {
    console.error("generateReport error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error generating report" });
  }
};
