import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { SignalingEvents } from "./events";
import logger from "../utils/logger";

/**
 * Initialize Socket.IO signaling server.
 * - Allows clients to join a room (roomId can be sessionId).
 * - Relays offer/answer/ice-candidate messages to other participants in the room.
 * - Emits READY when someone joins so client can know when to createOffer.
 *
 * Usage:
 *   const io = initSignaling(httpServer);
 *
 * Notes:
 *  - This is a simple relay-style signaling server. Media does not traverse this server.
 *  - Room semantics: multiple participants allowed but for 1:1 interviews typically two participants join.
 */
export const initSignaling = (server: HttpServer) => {
  const io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 30000,
  });

  io.on("connection", (socket: Socket) => {
    logger.info("Signaling: socket connected", socket.id);

    // Handler: join room
    socket.on(
      SignalingEvents.JOIN,
      (payload: { roomId?: string; role?: string }) => {
        try {
          const roomId = payload?.roomId;
          if (!roomId) {
            socket.emit(SignalingEvents.ERROR, {
              message: "roomId required to join",
            });
            return;
          }

          socket.join(roomId);
          socket.data.roomId = roomId;
          socket.data.role = payload.role || "participant";
          logger.info(
            `Socket ${socket.id} joined room ${roomId} as ${socket.data.role}`
          );

          // Notify other participants in the room that someone joined (so they might start negotiation)
          socket
            .to(roomId)
            .emit(SignalingEvents.READY, {
              socketId: socket.id,
              role: socket.data.role,
            });
        } catch (err) {
          logger.error("Signaling JOIN error", err);
          socket.emit(SignalingEvents.ERROR, { message: "Join failed" });
        }
      }
    );

    // Handler: leave room
    socket.on(SignalingEvents.LEAVE, (payload: { roomId?: string }) => {
      try {
        const roomId = payload?.roomId || socket.data.roomId;
        if (roomId) {
          socket.leave(roomId);
          logger.info(`Socket ${socket.id} left room ${roomId}`);
          socket
            .to(roomId)
            .emit(SignalingEvents.PARTICIPANT_LEFT, { socketId: socket.id });
        }
      } catch (err) {
        logger.error("Signaling LEAVE error", err);
      }
    });

    // Handler: offer
    socket.on(
      SignalingEvents.OFFER,
      (payload: { roomId?: string; description?: any }) => {
        try {
          const roomId = payload?.roomId || socket.data.roomId;
          if (!roomId || !payload?.description) {
            socket.emit(SignalingEvents.ERROR, {
              message: "offer requires roomId and description",
            });
            return;
          }
          // Relay offer to others in the room
          socket
            .to(roomId)
            .emit(SignalingEvents.OFFER, {
              description: payload.description,
              from: socket.id,
            });
          logger.info(`Relayed OFFER from ${socket.id} to room ${roomId}`);
        } catch (err) {
          logger.error("Signaling OFFER error", err);
          socket.emit(SignalingEvents.ERROR, { message: "Offer relay failed" });
        }
      }
    );

    // Handler: answer
    socket.on(
      SignalingEvents.ANSWER,
      (payload: { roomId?: string; description?: any }) => {
        try {
          const roomId = payload?.roomId || socket.data.roomId;
          if (!roomId || !payload?.description) {
            socket.emit(SignalingEvents.ERROR, {
              message: "answer requires roomId and description",
            });
            return;
          }
          socket
            .to(roomId)
            .emit(SignalingEvents.ANSWER, {
              description: payload.description,
              from: socket.id,
            });
          logger.info(`Relayed ANSWER from ${socket.id} to room ${roomId}`);
        } catch (err) {
          logger.error("Signaling ANSWER error", err);
          socket.emit(SignalingEvents.ERROR, {
            message: "Answer relay failed",
          });
        }
      }
    );

    // Handler: ice-candidate
    socket.on(
      SignalingEvents.ICE_CANDIDATE,
      (payload: { roomId?: string; candidate?: any }) => {
        try {
          const roomId = payload?.roomId || socket.data.roomId;
          if (!roomId || !payload?.candidate) {
            socket.emit(SignalingEvents.ERROR, {
              message: "ice-candidate requires roomId and candidate",
            });
            return;
          }
          socket
            .to(roomId)
            .emit(SignalingEvents.ICE_CANDIDATE, {
              candidate: payload.candidate,
              from: socket.id,
            });
          // ICE candidates are frequent: avoid excessive logging in high-volume scenarios
        } catch (err) {
          logger.error("Signaling ICE_CANDIDATE error", err);
          socket.emit(SignalingEvents.ERROR, {
            message: "ICE candidate relay failed",
          });
        }
      }
    );

    // When client disconnects, inform room participants
    socket.on("disconnect", (reason) => {
      try {
        const roomId = socket.data.roomId;
        logger.info(`Socket disconnected ${socket.id} reason=${reason}`);
        if (roomId) {
          socket
            .to(roomId)
            .emit(SignalingEvents.PARTICIPANT_LEFT, { socketId: socket.id });
        }
      } catch (err) {
        logger.error("Signaling disconnect error", err);
      }
    });
  });

  return io;
};

export default initSignaling;
