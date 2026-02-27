import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface CourseDocument extends Document {
  userId: string;
  name: string;
  level: string;
  duration: string;
  description: string;
  curriculum: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<CourseDocument>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    level: { type: String, required: true },
    duration: { type: String, required: true },
    description: { type: String, required: true },
    curriculum: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

CourseSchema.index({ userId: 1, createdAt: -1 });

export const Course: Model<CourseDocument> =
  mongoose.models.Course || mongoose.model<CourseDocument>("Course", CourseSchema);
