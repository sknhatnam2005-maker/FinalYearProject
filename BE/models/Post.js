import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    // "question": bình luận là câu trả lời, người hỏi chọn được 1 câu trả lời hay nhất
    type: { type: String, enum: ["post", "question"], default: "post" },
    acceptedCommentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    // File đính kèm (nội dung nằm trong GridFS bucket "uploads"); bài có đính kèm sẽ xuất hiện ở Thư viện
    attachments: {
      type: [
        {
          fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
          name: { type: String, required: true },
          mimeType: { type: String, required: true },
          size: { type: Number, required: true },
          // "photo": ảnh thường, không đưa vào Thư viện. Bài cũ không có trường này → coi là tài liệu
          kind: { type: String, enum: ["photo", "document"], default: "document" },
        },
      ],
      default: [],
    },
    semester: { type: String, default: "" }, // vd. "Fall 2025"
    // Người đăng đã được cảnh báo nội dung không khớp môn nhưng vẫn chọn đăng
    subjectMismatch: { type: Boolean, default: false },
    // public = mọi người, friends = chỉ bạn bè, private = chỉ mình tôi
    visibility: { type: String, enum: ["public", "friends", "private"], default: "public" },
    lecturer: { type: String, default: "" },
  },
  { timestamps: true }
);

postSchema.index({ "attachments.0": 1, subject: 1, semester: 1, lecturer: 1, createdAt: -1 });

export default mongoose.model("Post", postSchema);
