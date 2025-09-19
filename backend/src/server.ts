// server.ts
import { Server as IOServer, Socket } from "socket.io";
import http from "http";

export const startSignalingServer = (server: http.Server) => {
  const io = new IOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  const rooms: Record<string, Set<string>> = {};

  io.on("connection", (socket: Socket) => {
    console.log("✅ Socket connected:", socket.id);

    socket.on("join", ({ roomId }: { roomId: string }) => {
      socket.join(roomId);
      if (!rooms[roomId]) rooms[roomId] = new Set();
      rooms[roomId].add(socket.id);

      console.log(`Socket ${socket.id} joined room ${roomId}`);
      socket.to(roomId).emit("peer-joined", { id: socket.id });
    });

    socket.on(
      "offer",
      ({
        offer,
        roomId,
      }: {
        offer: RTCSessionDescriptionInit;
        roomId: string;
      }) => {
        socket.to(roomId).emit("offer", { offer });
      }
    );

    socket.on(
      "answer",
      ({
        answer,
        roomId,
      }: {
        answer: RTCSessionDescriptionInit;
        roomId: string;
      }) => {
        socket.to(roomId).emit("answer", { answer });
      }
    );

    socket.on(
      "ice-candidate",
      ({
        candidate,
        roomId,
      }: {
        candidate: RTCIceCandidateInit;
        roomId: string;
      }) => {
        socket.to(roomId).emit("ice-candidate", { candidate });
      }
    );

    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id}, reason: ${reason}`);
      for (const roomId in rooms) {
        rooms[roomId].delete(socket.id);
        if (rooms[roomId].size === 0) delete rooms[roomId];
      }
    });
  });
};
