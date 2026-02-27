import mongoose, { Schema, type Document, type Model } from "mongoose";

export type PageStyle = "Ruled" | "Plain" | "Grid";
export type InkColor = "Blue" | "Black" | "Dark Green";
export type WritingTool = "Ball Pen" | "Fountain Pen" | "Pencil";
export type HandwritingStyle = "Neat Student" | "Fast Notes" | "Exam Revision Style";

export interface HandwrittenNoteDocument extends Document {
  userId: string;
  topic: string;
  handwritingStyle: HandwritingStyle;
  content: string;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

const HandwrittenNoteSchema = new Schema<HandwrittenNoteDocument>(
  {
    userId: { type: String, required: true, index: true },
    topic: { type: String, required: true, trim: true },
    handwritingStyle: {
      type: String,
      enum: ["Neat Student", "Fast Notes", "Exam Revision Style"],
      required: true,
    },
    content: { type: String, required: true },
    summary: { type: String, default: "" },
  },
  { timestamps: true, collection: "handwritten_notes" }
);

HandwrittenNoteSchema.index({ userId: 1, createdAt: -1 });

export const HandwrittenNote: Model<HandwrittenNoteDocument> =
  mongoose.models.HandwrittenNote ||
  mongoose.model<HandwrittenNoteDocument>("HandwrittenNote", HandwrittenNoteSchema);
