import { Request, Response } from "express";
import mongoose from "mongoose";
import EventModel from "../models/event.model";
import SessionModel from "../models/session.model";

/**
 * POST /api/logs
 */
export const saveLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, events } = req.body;

    if (!sessionId || !Array.isArray(events) || events.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "sessionId and events[] required" });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      res.status(400).json({ success: false, message: "Invalid session _id" });
      return;
    }

    const session = await SessionModel.findById(sessionId).lean();
    if (!session) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    const docs = events
      .filter((e) => e?.type && e?.message)
      .map((e) => ({
        sessionId, // still storing reference
        eventType: e.type,
        message: e.message,
        candidateId: e.candidateId || null,
        metadata: e.metadata || {},
        timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      }));

    if (!docs.length) {
      res.status(400).json({ success: false, message: "No valid events" });
      return;
    }

    const inserted = await EventModel.insertMany(docs, { ordered: false });
    res.status(201).json({
      success: true,
      message: "Logs saved",
      insertedCount: inserted.length,
      insertedIds: inserted.map((d) => d._id),
    });
  } catch (err) {
    console.error("saveLogs error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error saving logs" });
  }
};

/**
 * GET /api/logs/:id
 */
export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      res.status(400).json({ success: false, message: "Invalid session _id" });
      return;
    }

    const page = parseInt(String(req.query.page || "1"), 10);
    const limit = Math.min(
      1000,
      parseInt(String(req.query.limit || "100"), 10)
    );
    const skip = (page - 1) * limit;

    const { type, candidateId, from, to, aggregate } = req.query;
    const filter: any = { sessionId };

    if (type) filter.eventType = type;
    if (candidateId) filter.candidateId = candidateId;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(String(from));
      if (to) filter.timestamp.$lte = new Date(String(to));
    }

    if (aggregate === "true" || aggregate === "1") {
      const agg = await EventModel.aggregate([
        { $match: filter },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
      ]);
      res.json({
        success: true,
        sessionId,
        counts: Object.fromEntries(agg.map((x) => [x._id, x.count])),
      });
      return;
    }

    const [total, data] = await Promise.all([
      EventModel.countDocuments(filter),
      EventModel.find(filter)
        .sort({ timestamp: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      sessionId,
      page,
      limit,
      total,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("getLogs error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching logs" });
  }
};
