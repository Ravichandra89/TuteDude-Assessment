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

type Role = "interviewer" | "candidate";

type RoomUser = {
  id: string;
  role: Role;
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
    socket.on(
      SignalingEvents.JOIN,
      ({ roomId, role }: { roomId?: string; role?: Role }) => {
        try {
          if (!roomId || !role) {
            socket.emit(SignalingEvents.ERROR, {
              message: "roomId & role required",
            });
            return;
          }

          if (!rooms[roomId]) rooms[roomId] = [];

          // prevent >1 candidate or >1 interviewer
          if (
            rooms[roomId].some((u) => u.role === role) &&
            role === "candidate"
          ) {
            socket.emit(SignalingEvents.ERROR, {
              message: "Candidate already present in room",
            });
            return;
          }
          if (
            rooms[roomId].some((u) => u.role === role) &&
            role === "interviewer"
          ) {
            socket.emit(SignalingEvents.ERROR, {
              message: "Interviewer already present in room",
            });
            return;
          }

          socket.join(roomId);
          socket.data.roomId = roomId;
          socket.data.role = role;

          rooms[roomId].push({ id: socket.id, role });

          logger.info(
            `Socket ${
              socket.id
            } joined room ${roomId} as **${role.toUpperCase()}**`
          );

          // notify other peer
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
          id: socket.id,
        });
        logger.info(`Socket ${socket.id} left room ${roomId}`);
      }
    });

    // --- OFFER ---
    socket.on(SignalingEvents.OFFER, ({ to, offer }) => {
      if (!to || !offer) {
        socket.emit(SignalingEvents.ERROR, {
          message: "Offer requires to & offer",
        });
        return;
      }
      io.to(to).emit(SignalingEvents.OFFER, { from: socket.id, offer });
      logger.info(`Relayed OFFER from ${socket.id} → ${to}`);
    });

    // --- ANSWER ---
    socket.on(SignalingEvents.ANSWER, ({ to, answer }) => {
      if (!to || !answer) {
        socket.emit(SignalingEvents.ERROR, {
          message: "Answer requires to & answer",
        });
        return;
      }
      io.to(to).emit(SignalingEvents.ANSWER, { from: socket.id, answer });
      logger.info(`Relayed ANSWER from ${socket.id} → ${to}`);
    });

    // --- ICE CANDIDATE ---
    socket.on(SignalingEvents.ICE_CANDIDATE, ({ to, candidate }) => {
      if (!to || !candidate) {
        socket.emit(SignalingEvents.ERROR, {
          message: "ICE candidate requires to & candidate",
        });
        return;
      }
      io.to(to).emit(SignalingEvents.ICE_CANDIDATE, {
        from: socket.id,
        candidate,
      });
      logger.info(`Relayed ICE candidate from ${socket.id} → ${to}`);
    });

    // --- DISCONNECT ---
    socket.on("disconnect", (reason) => {
      const roomId = socket.data.roomId;
      logger.info(`Socket disconnected ${socket.id}, reason=${reason}`);

      if (roomId) {
        rooms[roomId] = (rooms[roomId] || []).filter((u) => u.id !== socket.id);

        socket.to(roomId).emit(SignalingEvents.PARTICIPANT_LEFT, {
          id: socket.id,
        });
      }
    });
  });

  return io;
};

export default initSignaling;
