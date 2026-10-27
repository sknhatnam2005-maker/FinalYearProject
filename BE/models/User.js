import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    handle: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, default: "" }, // rỗng = tài khoản chỉ đăng nhập bằng Google
    googleId: { type: String, unique: true, sparse: true },
    avatarColor: { type: String, default: "#1C2541" },
    bio: { type: String, default: "" },
    // Ảnh lưu dạng data URL (base64), đã được FE thu nhỏ trước khi gửi lên
    avatarUrl: { type: String, default: "" },
    age: { type: Number, default: null }, // tính từ birthDate lúc lưu (tài khoản cũ có thể chỉ có age)
    birthDate: { type: Date, default: null },
    gender: { type: String, enum: ["male", "female", "other", null], default: null },
    school: { type: String, default: "" }, // trường đang học / dạy, không bắt buộc
    // null = tài khoản cũ chưa chọn vai trò, FE sẽ yêu cầu bổ sung
    role: { type: String, enum: ["hoc_sinh", "sinh_vien", "giang_vien", null], default: null },
    teachingSubjects: { type: [String], default: [] }, // chỉ dùng cho giảng viên (label môn)
    coverUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
