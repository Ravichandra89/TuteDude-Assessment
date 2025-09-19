import { Router } from "express";

import {
  startSession,
  endSession,
  createSession,
} from "../controller/session.controller";

const sessionRouter = Router();

sessionRouter.patch("/:sessionId/start", startSession);
sessionRouter.patch("/:sessionId/end", endSession);
sessionRouter.post("/", createSession);

export default sessionRouter;
