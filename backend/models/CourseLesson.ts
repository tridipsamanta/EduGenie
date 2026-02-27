import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface CourseLessonDocument extends Document {
  chapterId: mongoose.Types.ObjectId;
  youtubeVideoId: string;
  title: string;
  duration: string;
  thumbnail: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const CourseLessonSchema = new Schema<CourseLessonDocument>(
  {
    chapterId: {
      type: Schema.Types.ObjectId,
      ref: "CourseChapter",
      required: true,
      index: true,
    },
    youtubeVideoId: { type: String, required: true },
    title: { type: String, required: true },
    duration: { type: String, required: true },
    thumbnail: { type: String, required: true },
    orderIndex: { type: Number, required: true },
  },
  { timestamps: true }
);

CourseLessonSchema.index({ chapterId: 1, orderIndex: 1 }, { unique: true });

export const CourseLesson: Model<CourseLessonDocument> =
  mongoose.models.CourseLesson ||
  mongoose.model<CourseLessonDocument>("CourseLesson", CourseLessonSchema);
