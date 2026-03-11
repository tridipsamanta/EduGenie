import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface CourseDocument extends Document {
  userId: string;
  name: string;
  level: string;
  duration: string;
  description: string;
  thumbnail?: string;
  thumbnailPositionX?: number;
  thumbnailPositionY?: number;
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
    thumbnail: { type: String, required: false, default: "" },
    thumbnailPositionX: { type: Number, required: false, default: 50 },
    thumbnailPositionY: { type: Number, required: false, default: 50 },
    curriculum: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

CourseSchema.index({ userId: 1, createdAt: -1 });

export const Course: Model<CourseDocument> =
  mongoose.models.Course || mongoose.model<CourseDocument>("Course", CourseSchema);
