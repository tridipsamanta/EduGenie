import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ConversationDocument extends Document {
  userId?: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<ConversationDocument>(
  {
    userId: { type: String, index: true },
    title: { type: String, required: true, default: "New Chat" },
  },
  { timestamps: true }
);

ConversationSchema.index({ title: "text" });

export const Conversation: Model<ConversationDocument> =
  mongoose.models.Conversation ||
  mongoose.model<ConversationDocument>("Conversation", ConversationSchema);
