import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface NoteDocument extends Document {
  userId: string;
  title: string;
  content: string; // markdown
  sourceType: "manual" | "ai" | "url" | "youtube" | "handwritten";
  summary?: string;
  sourceLink?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<NoteDocument>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    sourceType: {
      type: String,
      enum: ["manual", "ai", "url", "youtube", "handwritten"],
      default: "manual",
    },
    summary: { type: String, default: "" },
    sourceLink: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Text index for search
NoteSchema.index({ title: "text", content: "text" });

// Query index
NoteSchema.index({ userId: 1, createdAt: -1 });

export const Note: Model<NoteDocument> =
  mongoose.models.Note || mongoose.model<NoteDocument>("Note", NoteSchema);
