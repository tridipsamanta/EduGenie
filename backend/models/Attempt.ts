import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface AttemptDocument extends Document {
  userId?: string;
  quizId: mongoose.Types.ObjectId;
  startedAt: Date;
  completedAt?: Date | null;
  score?: number | null;
  accuracy?: number | null;
  weakTopics: string[];
  totalTimeSec: number;
  createdAt: Date;
  updatedAt: Date;
}

const AttemptSchema = new Schema<AttemptDocument>(
  {
    userId: { type: String, index: true },
    quizId: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    score: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    weakTopics: { type: [String], default: [] },
    totalTimeSec: { type: Number, required: true, min: 10 },
  },
  { timestamps: true }
);

AttemptSchema.index({ userId: 1, createdAt: -1 });
AttemptSchema.index({ userId: 1, score: 1, createdAt: -1 });

export const Attempt: Model<AttemptDocument> =
  mongoose.models.Attempt ||
  mongoose.model<AttemptDocument>("Attempt", AttemptSchema);
