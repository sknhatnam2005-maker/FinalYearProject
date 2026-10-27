import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    role: { type: String, default: null },
    text: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const livestreamSchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    subject: { type: String, default: "" },
    visibility: { type: String, enum: ["public", "friends", "private"], default: "public" },
    status: { type: String, enum: ["live", "ended"], default: "live" },
    hostLastSeen: { type: Date, default: Date.now }, // host ngừng poll quá lâu → coi như đã tắt
    endedAt: { type: Date, default: null },
    viewers: { type: [{ userId: mongoose.Schema.Types.ObjectId, lastSeen: Date }], default: [] },
    peakViewers: { type: Number, default: 0 },
    chat: { type: [chatSchema], default: [] }, // chỉ giữ 300 tin gần nhất
  },
  { timestamps: true }
);

livestreamSchema.index({ status: 1, hostLastSeen: -1 });

export default mongoose.model("Livestream", livestreamSchema);
