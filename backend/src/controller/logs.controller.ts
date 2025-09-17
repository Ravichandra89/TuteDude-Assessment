import { Request, Response } from "express";
import EventModel from "../models/event.model";
import SessionModel from "../models/session.model";

/**
 * @desc Save detection logs (batch insert)
 * @route POST /api/logs
 */
export const saveLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, events } = req.body;

    if (!sessionId || !Array.isArray(events)) {
      res.status(400).json({ success: false, message: "sessionId and events[] required" });
      return;
    }

    // Validate that session exists
    const session = await SessionModel.findById(sessionId);
    if (!session) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    // Insert logs
    const newEvents = events.map((event: any) => ({
      sessionId,
      eventType: event.eventType,
      message: event.message,
      timestamp: event.timestamp || new Date(),
    }));

    await EventModel.insertMany(newEvents);

    res.status(201).json({
      success: true,
      message: "Logs saved successfully",
      count: newEvents.length,
    });
  } catch (error) {
    console.error("Error saving logs:", error);
    res.status(500).json({ success: false, message: "Server error saving logs" });
  }
};

/**
 * @desc Get logs by sessionId
 * @route GET /api/logs/:sessionId
 */
export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const logs = await EventModel.find({ sessionId }).sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ success: false, message: "Server error fetching logs" });
  }
};
