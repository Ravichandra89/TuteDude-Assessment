import { Router } from "express";
import { saveLogs, getLogs } from "../controller/logs.controller";

const logRouter = Router();

// POST /api/logs  :  Save detection logs
logRouter.post("/", saveLogs);

// GET /api/logs/:sessionId  : Get logs by sessionId
logRouter.get("/:sessionId", getLogs);

export default logRouter;
