import http from "http";
import express from "express";
import cors from "cors";
import initSignaling from "./websocket/sinaling";
import logRouter from "./routes/log.route";
import sessionRouter from "./routes/session.route";
import reportRouter from "./routes/report.route";
import connectDB from "./config/db";
import dotenv from "dotenv";
import bodyParser from "body-parser";

dotenv.config();
const app = express();
const server = http.createServer(app);

// middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// routes
app.use("/api/v1/logs", logRouter);
app.use("/api/v1/sessions", sessionRouter);
app.use("/api/v1/reports", reportRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// first connect to DB, then start server
const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server + Socket.IO running on http://localhost:${PORT}`);
  });

  // Initialize signaling AFTER server is up
  initSignaling(server);
});
