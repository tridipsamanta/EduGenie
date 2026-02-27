import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface NoteChunkDocument extends Document {
  noteId: mongoose.Types.ObjectId;
  userId: string;
  chunkText: string;
  chunkIndex: number;
  embeddingVector?: number[];
  createdAt: Date;
}

const NoteChunkSchema = new Schema<NoteChunkDocument>(
  {
    noteId: {
      type: Schema.Types.ObjectId,
      ref: "Note",
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    chunkText: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    embeddingVector: { type: [Number], default: [] },
  },
  { timestamps: true }
);

// Index for searching by note and user
NoteChunkSchema.index({ noteId: 1, userId: 1 });
NoteChunkSchema.index({ chunkText: "text" });

export const NoteChunk: Model<NoteChunkDocument> =
  mongoose.models.NoteChunk || mongoose.model<NoteChunkDocument>("NoteChunk", NoteChunkSchema);
