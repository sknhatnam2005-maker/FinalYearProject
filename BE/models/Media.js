import mongoose from "mongoose";

// Ảnh/GIF kèm theo: ảnh tự tải lên (GridFS, fileId) hoặc GIF lấy từ GIPHY (url)
export const mediaSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["image", "gif"], required: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    url: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false }
);
