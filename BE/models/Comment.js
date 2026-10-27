import mongoose from "mongoose";
import { mediaSchema } from "./Media.js";

const commentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" }, // có thể trống nếu bình luận chỉ có ảnh/GIF
    media: { type: mediaSchema, default: null },
    edited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);
