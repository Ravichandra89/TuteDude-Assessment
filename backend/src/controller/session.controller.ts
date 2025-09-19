import { Request, Response } from "express";
import mongoose from "mongoose";
import SessionModel from "../models/session.model";

/**
 * PATCH /api/sessions/:id/start
 */
/**
 * POST /api/sessions
 */
export const createSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { candidateId, startTime } = req.body;

    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      res.status(400).json({ success: false, message: "Invalid candidateId" });
      return;
    }

    const session = new SessionModel({
      candidateId,
      startTime: startTime ? new Date(startTime) : new Date(),
    });

    await session.save();

    res.status(201).json({ success: true, session });
  } catch (err: any) {
    console.error("createSession error:", err.message, err.stack);
    res.status(500).json({
      success: false,
      message: err.message || "Server error creating session",
    });
  }
};

/**
 * PATCH /api/v1/sessions/:id/start
 */
export const startSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { sessionId } = req.params; // ✅ match router

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      res.status(400).json({ success: false, message: "Invalid session _id" });
      return;
    }

    const session = await SessionModel.findByIdAndUpdate(
      sessionId,
      {
        startTime: req.body.startTime
          ? new Date(req.body.startTime)
          : new Date(),
      },
      { new: true }
    );

    if (!session) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    res.json({ success: true, session });
  } catch (err) {
    console.error("startSession error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error starting session" });
  }
};

/**
 * PATCH /api/v1/sessions/:id/end
 */
export const endSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await SessionModel.findOneAndUpdate(
      { _id: sessionId },
      {
        endTime: req.body.endTime ? new Date(req.body.endTime) : new Date(),
      },
      { new: true }
    );

    if (!session) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    res.json({ success: true, session });
  } catch (err) {
    console.error("endSession error:", err);
    res.status(500).json({
      success: false,
      message: "Server error ending session",
    });
  }
};
