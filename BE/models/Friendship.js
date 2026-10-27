import mongoose from "mongoose";

// Một bản ghi cho mỗi cặp người dùng: pending = đang chờ recipient chấp nhận, accepted = đã là bạn
const friendshipSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
  },
  { timestamps: true }
);

friendshipSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });
friendshipSchema.index({ recipientId: 1, status: 1 });

export default mongoose.model("Friendship", friendshipSchema);
