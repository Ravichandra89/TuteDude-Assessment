/**
 * Centeral Place of managing Error handling in express app
 */
import { Request, Response, NextFunction } from "express";
import logger from "./utils/logger";

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(
    statusCode = 500,
    message = "Internal Server Error",
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    // maintain proper stack trace (only on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Normalize error
    const isHttpError = err instanceof HttpError;
    let status = isHttpError ? err.statusCode : err?.statusCode || 500;
    let message = err?.message || "Internal Server Error";
    let details: unknown = undefined;

    // Mongoose validation error handling
    if (err?.name === "ValidationError" && err.errors) {
      status = 400;
      message = "Validation error";
      details = Object.keys(err.errors).map((key) => ({
        field: key,
        message: err.errors[key].message,
      }));
    }

    // Mongoose cast error (invalid ObjectId)
    if (err?.name === "CastError") {
      status = 400;
      message = `Invalid ${err.path}: ${err.value}`;
      details = { path: err.path, value: err.value };
    }

    // If controller provided extra details in a custom field
    if (isHttpError && (err as HttpError).details) {
      details = (err as HttpError).details;
    }

    // Log full error server-side for debugging / observability
    logger.error("Unhandled error", {
      method: req.method,
      url: req.originalUrl,
      status,
      message,
      stack: err?.stack,
      details,
    });

    // Build client-facing payload
    const payload: any = {
      success: false,
      message,
    };

    if (details) payload.details = details;

    if (process.env.NODE_ENV !== "production") {
      payload.stack = err?.stack;
    }

    if (!res.headersSent) {
      res.status(status).json(payload);
    } else {
      next(err);
    }
  } catch (handlerErr) {
    // If the error handler itself throws, log and send minimal response
    logger.error("Error in errorHandler", { error: handlerErr });
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Fatal server error" });
    } else {
      next(handlerErr);
    }
  }
};

export default errorHandler;
