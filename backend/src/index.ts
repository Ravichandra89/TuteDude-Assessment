import http from "http";
import express from "express";
import initSignaling from "./websocket/sinaling";

const app = express();
const server = http.createServer(app);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Initialize signaling
initSignaling(server);

const PORT = 4000;
server.listen(PORT, () =>
  console.log(`🚀 Server + Socket.IO running on http://localhost:${PORT}`)
);
