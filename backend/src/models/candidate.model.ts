import mongoose, { Document, Schema } from "mongoose";

export interface Candidate extends Document {
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateSchema: Schema<Candidate> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const CandidateModel =
  mongoose.models.Candidate ||
  mongoose.model<Candidate>("Candidate", CandidateSchema);

export default CandidateModel;
