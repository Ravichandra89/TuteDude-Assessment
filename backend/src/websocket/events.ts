// Storing WebSocket events

export enum SignalingEvents {
  JOIN = "join",
  LEAVE = "leave",
  OFFER = "offer",
  ANSWER = "answer",
  ICE_CANDIDATE = "ice-candidate",
  READY = "ready",
  PARTICIPANT_LEFT = "participant-left",
  ERROR = "error",
}
