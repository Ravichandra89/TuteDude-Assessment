// src/index.ts
import express, { Application, Request, Response } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import logger, { stream as loggerStream } from "./utils/logger";
import logRouter from "./routes/log.route";
import reportRouter from "./routes/report.route";
import uploadRoute from "./routes/upload.route";
import errorHandler from "./error.middleware";
import connectDB from "./config/db";
import {initSignaling} from "./websocket/sinaling";
import morgan from "morgan";

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";

const createServer = async (): Promise<http.Server> => {
  const app: Application = express();
  const server = http.createServer(app);

  try {
    // Middlewares
    app.use(cors());
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // HTTP request logging via morgan -> winston stream
    app.use(morgan("combined", { stream: loggerStream }));

    // Basic health endpoint
    app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok", ts: Date.now() }));

    // Mount API routes
    app.use("/api/v1/logs", logRouter);
    app.use("/api/v1/reports", reportRouter);
    app.use("/api/v1/upload", uploadRoute);

    // Error handler (must be after routes)
    app.use(errorHandler);

    // connect to MongoDB
    await connectDB();

    // Init WebRTC signaling (Socket.IO) - returns io instance if needed
    initSignaling(server);

    // Start listening
    await new Promise<void>((resolve) => {
      server.listen(PORT, HOST, () => {
        logger.info(`Server listening on http://${HOST}:${PORT}`);
        resolve();
      });
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      try {
        logger.info(`Received ${signal}. Shutting down gracefully...`);
        server.close(() => {
          logger.info("HTTP server closed");
        });
        // Optionally close DB connection
        // mongoose.connection.close(false, () => logger.info('Mongo connection closed.'));
        // Give a short delay then exit
        setTimeout(() => {
          logger.info("Process exiting");
          process.exit(0);
        }, 1000).unref();
      } catch (err) {
        logger.error("Error during shutdown", err);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    return server;
  } catch (err) {
    logger.error("Failed to start server", err);
    // ensure the process exits on failure to start
    process.exit(1);
  }
};

// Start the server
createServer().catch((err) => {
  logger.error("Unhandled startup error", err);
  process.exit(1);
});
