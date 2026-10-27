import mongoose from "mongoose";
import { mediaSchema } from "./Media.js";

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" }, // có thể trống nếu tin chỉ có ảnh/GIF
    media: { type: mediaSchema, default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Truy vấn hội thoại luôn lọc theo cặp người gửi/nhận và sắp theo thời gian
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, isRead: 1 });

export default mongoose.model("Message", messageSchema);
