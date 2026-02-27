import mongoose, { Schema, type Document, type Model } from "mongoose";

export type MessageRole = "user" | "assistant" | "system";

export interface MessageDocument extends Document {
  conversationId: mongoose.Types.ObjectId;
  role: MessageRole;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<MessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
      index: true,
    },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

MessageSchema.index({ content: "text" });

export const Message: Model<MessageDocument> =
  mongoose.models.Message ||
  mongoose.model<MessageDocument>("Message", MessageSchema);
