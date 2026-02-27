import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface CourseProgressDocument extends Document {
  userId: string;
  lessonId: mongoose.Types.ObjectId;
  completed: boolean;
  watchedSeconds: number;
  lastWatchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CourseProgressSchema = new Schema<CourseProgressDocument>(
  {
    userId: { type: String, required: true, index: true },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: "CourseLesson",
      required: true,
      index: true,
    },
    completed: { type: Boolean, default: false },
    watchedSeconds: { type: Number, default: 0 },
    lastWatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CourseProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

export const CourseProgress: Model<CourseProgressDocument> =
  mongoose.models.CourseProgress ||
  mongoose.model<CourseProgressDocument>("CourseProgress", CourseProgressSchema);
