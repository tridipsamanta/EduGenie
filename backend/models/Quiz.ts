import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface QuizQuestion {
  _id: mongoose.Types.ObjectId;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  topic?: string;
}

export interface QuizDocument extends Document {
  userId?: string;
  title: string;
  description?: string;
  totalQuestions: number;
  timePerQuestionSec: number;
  questions: QuizQuestion[];
  isGenerated?: boolean;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<QuizQuestion>(
  {
    question: { type: String, required: true, trim: true },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length === 4,
        message: "Each question must have exactly 4 options.",
      },
    },
    correctAnswer: { type: String, required: true, trim: true },
    explanation: { type: String, default: "" },
    topic: { type: String, default: "" },
  },
  { _id: true }
);

const QuizSchema = new Schema<QuizDocument>(
  {
    userId: { type: String, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    totalQuestions: { type: Number, required: true, min: 1 },
    timePerQuestionSec: { type: Number, default: 30, min: 5 },
    questions: { type: [QuizQuestionSchema], default: [] },
    isGenerated: { type: Boolean, default: false },
    source: { type: String, default: "" },
  },
  { timestamps: true }
);

QuizSchema.index({ userId: 1, createdAt: -1 });
QuizSchema.index({ userId: 1, isGenerated: 1, createdAt: -1 });

export const Quiz: Model<QuizDocument> =
  mongoose.models.Quiz || mongoose.model<QuizDocument>("Quiz", QuizSchema);
