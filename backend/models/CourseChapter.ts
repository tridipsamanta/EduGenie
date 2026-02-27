import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface CourseChapterDocument extends Document {
  courseId: mongoose.Types.ObjectId;
  title: string;
  summary: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const CourseChapterSchema = new Schema<CourseChapterDocument>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    orderIndex: { type: Number, required: true },
  },
  { timestamps: true }
);

CourseChapterSchema.index({ courseId: 1, orderIndex: 1 }, { unique: true });

export const CourseChapter: Model<CourseChapterDocument> =
  mongoose.models.CourseChapter ||
  mongoose.model<CourseChapterDocument>("CourseChapter", CourseChapterSchema);
