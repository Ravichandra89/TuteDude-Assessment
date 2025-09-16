import mongoose, { Document, Schema } from "mongoose";

export interface Session extends Document {
  candidateId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  recordingUrl?: string; // S3 link if stored
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema: Schema<Session> = new Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    recordingUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const SessionModel =
  mongoose.models.Session || mongoose.model<Session>("Session", SessionSchema);

export default SessionModel;
