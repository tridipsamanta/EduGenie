import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface AttemptAnswerDocument extends Document {
  attemptId: mongoose.Types.ObjectId;
  questionId: string;
  selectedOption: string;
  isCorrect: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AttemptAnswerSchema = new Schema<AttemptAnswerDocument>(
  {
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: "Attempt",
      required: true,
      index: true,
    },
    questionId: { type: String, required: true, index: true },
    selectedOption: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
  },
  { timestamps: true }
);

AttemptAnswerSchema.index({ attemptId: 1, questionId: 1 }, { unique: true });

export const AttemptAnswer: Model<AttemptAnswerDocument> =
  mongoose.models.AttemptAnswer ||
  mongoose.model<AttemptAnswerDocument>("AttemptAnswer", AttemptAnswerSchema);
