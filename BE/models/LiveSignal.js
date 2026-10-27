import mongoose from "mongoose";

// Tin nhắn "bắt tay" WebRTC giữa người phát và từng người xem (join/offer/answer/ice/leave).
// Chỉ cần sống vài phút cho tới khi hai bên kết nối xong → TTL tự xoá sau 5 phút.
const liveSignalSchema = new mongoose.Schema({
  streamId: { type: mongoose.Schema.Types.ObjectId, ref: "Livestream", required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["join", "leave", "offer", "answer", "ice"], required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now, expires: 300 },
});

liveSignalSchema.index({ streamId: 1, to: 1, _id: 1 });

export default mongoose.model("LiveSignal", liveSignalSchema);
