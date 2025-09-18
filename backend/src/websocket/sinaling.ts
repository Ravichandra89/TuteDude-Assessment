import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import logger from "../utils/logger";

export const SignalingEvents = {
  JOIN: "join",
  LEAVE: "leave",
  READY: "ready",
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  PARTICIPANT_LEFT: "participant-left",
  ERROR: "error",
};

type RoomUser = {
  id: string;
  role: "interviewer" | "candidate";
};

const rooms: Record<string, RoomUser[]> = {};

export const initSignaling = (server: HttpServer) => {
  const io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 30000,
  });

  io.on("connection", (socket: Socket) => {
    logger.info("Signaling: socket connected " + socket.id);

    // --- JOIN ROOM ---
    // --- JOIN ROOM ---
    socket.on(
      SignalingEvents.JOIN,
      ({
        roomId,
        role,
      }: {
        roomId?: string;
        role?: "interviewer" | "candidate";
      }) => {
        try {
          if (!roomId || !role) {
            socket.emit(SignalingEvents.ERROR, {
              message: "roomId & role required",
            });
            return;
          }

          socket.join(roomId);
          socket.data.roomId = roomId;
          socket.data.role = role;

          if (!rooms[roomId]) rooms[roomId] = [];
          rooms[roomId].push({ id: socket.id, role });

          logger.info(
            `Socket ${
              socket.id
            } joined room ${roomId} as **${role.toUpperCase()}**`
          );

          // Notify others in room about new participant
          socket.to(roomId).emit("participant-joined", {
            id: socket.id,
            role,
          });

          // If both interviewer and candidate are present → notify READY
          const hasInterviewer = rooms[roomId].some(
            (u) => u.role === "interviewer"
          );
          const hasCandidate = rooms[roomId].some(
            (u) => u.role === "candidate"
          );

          if (hasInterviewer && hasCandidate) {
            io.to(roomId).emit(SignalingEvents.READY, {
              roomId,
              participants: rooms[roomId],
            });
            logger.info(
              `[READY] Room ${roomId} has interviewer + candidate. Starting handshake.`
            );
          }
        } catch (err) {
          logger.error("JOIN error", err);
          socket.emit(SignalingEvents.ERROR, { message: "Join failed" });
        }
      }
    );

    // --- LEAVE ROOM ---
    socket.on(SignalingEvents.LEAVE, () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        socket.leave(roomId);
        rooms[roomId] = (rooms[roomId] || []).filter((u) => u.id !== socket.id);

        socket.to(roomId).emit(SignalingEvents.PARTICIPANT_LEFT, {
          socketId: socket.id,
        });
        logger.info(`Socket ${socket.id} left room ${roomId}`);
      }
    });

    // --- OFFER ---
    socket.on(SignalingEvents.OFFER, ({ roomId, description }) => {
      if (!roomId || !description) {
        socket.emit(SignalingEvents.ERROR, {
          message: "Offer requires roomId & description",
        });
        return;
      }
      socket
        .to(roomId)
        .emit(SignalingEvents.OFFER, { description, from: socket.id });
      logger.info(`Relayed OFFER from ${socket.id} to room ${roomId}`);
    });

    // --- ANSWER ---
    socket.on(SignalingEvents.ANSWER, ({ roomId, description }) => {
      if (!roomId || !description) {
        socket.emit(SignalingEvents.ERROR, {
          message: "Answer requires roomId & description",
        });
        return;
      }
      socket
        .to(roomId)
        .emit(SignalingEvents.ANSWER, { description, from: socket.id });
      logger.info(`Relayed ANSWER from ${socket.id} to room ${roomId}`);
    });

    // --- ICE CANDIDATE ---
    socket.on(SignalingEvents.ICE_CANDIDATE, ({ roomId, candidate }) => {
      if (!roomId || !candidate) {
        socket.emit(SignalingEvents.ERROR, {
          message: "ICE candidate requires roomId & candidate",
        });
        return;
      }
      socket
        .to(roomId)
        .emit(SignalingEvents.ICE_CANDIDATE, { candidate, from: socket.id });
    });

    // --- DISCONNECT ---
    socket.on("disconnect", (reason) => {
      const roomId = socket.data.roomId;
      logger.info(`Socket disconnected ${socket.id}, reason=${reason}`);

      if (roomId) {
        rooms[roomId] = (rooms[roomId] || []).filter((u) => u.id !== socket.id);

        socket.to(roomId).emit(SignalingEvents.PARTICIPANT_LEFT, {
          socketId: socket.id,
        });
      }
    });
  });

  return io;
};

export default initSignaling;
