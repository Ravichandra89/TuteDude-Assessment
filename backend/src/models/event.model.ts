import mongoose, { Document, Schema } from "mongoose";

export interface Event extends Document {
  sessionId: mongoose.Types.ObjectId;
  type:
    | "FOCUS_LOST"
    | "NO_FACE"
    | "MULTIPLE_FACES"
    | "PHONE_DETECTED"
    | "NOTES_DETECTED"
    | "DEVICE_DETECTED";
  timestamp: Date;
  details?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema: Schema<Event> = new Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "FOCUS_LOST",
        "NO_FACE",
        "MULTIPLE_FACES",
        "PHONE_DETECTED",
        "NOTES_DETECTED",
        "DEVICE_DETECTED",
      ],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const EventModel =
  mongoose.models.Event || mongoose.model<Event>("Event", EventSchema);

export default EventModel;
