import { Router } from "express";
import { generateReport } from "../controller/report.controller";

const reportRouter = Router();

// GET /api/reports/:sessionId : Generate and get report for a session
reportRouter.get("/:sessionId", generateReport);

export default reportRouter;
