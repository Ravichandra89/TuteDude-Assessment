import { Request, Response } from "express";
import EventModel from "../models/event.model";
import SessionModel from "../models/session.model";
import CandidateModel from "../models/candidate.model";
import { generatePDFReport } from "../services/report.service";

/**
 * @desc Generate report for a session
 * @route GET /api/reports/:sessionId
 */
export const generateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    // Fetch session
    const session = await SessionModel.findById(sessionId);
    if (!session) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    // Fetch candidate
    const candidate = await CandidateModel.findById(session.candidateId);

    // Fetch events
    const events = await EventModel.find({ sessionId }).sort({ timestamp: 1 });

    // Aggregate stats
    let focusLostCount = 0;
    let absenceCount = 0;
    let multipleFacesCount = 0;
    let suspiciousItems: string[] = [];

    events.forEach((e) => {
      if (e.eventType === "focus_lost") focusLostCount++;
      if (e.eventType === "no_face") absenceCount++;
      if (e.eventType === "multiple_faces") multipleFacesCount++;
      if (e.eventType === "object_detected") suspiciousItems.push(e.message);
    });

    // Integrity score (simple heuristic)
    let integrityScore = 100;
    integrityScore -= focusLostCount * 2;
    integrityScore -= absenceCount * 5;
    integrityScore -= multipleFacesCount * 10;
    integrityScore -= suspiciousItems.length * 5;
    if (integrityScore < 0) integrityScore = 0;

    const reportData = {
      candidateName: candidate?.name || "Unknown Candidate",
      interviewDuration: session.endedAt && session.startedAt
        ? (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
        : null,
      focusLostCount,
      absenceCount,
      multipleFacesCount,
      suspiciousItems,
      integrityScore,
      events,
    };

    const pdfUrl = await generatePDFReport(reportData, sessionId);

    res.status(200).json({
      success: true,
      message: "Report generated",
      data: { ...reportData, pdfUrl },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ success: false, message: "Server error generating report" });
  }
};
