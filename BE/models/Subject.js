import mongoose from "mongoose";

// Bỏ dấu tiếng Việt + chữ thường để gõ "lap trinh" vẫn ra "Lập trình"
export function normalizeText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

// Post.subject lưu nguyên tên môn (label), nên bài cũ ("Toán học"...) vẫn khớp
const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    label: { type: String, required: true, unique: true },
    search: { type: String, required: true, unique: true }, // tên đã bỏ dấu, dùng để tìm và chống trùng
    // school = phổ thông (học sinh), university = đại học (sinh viên), both = dùng chung
    level: { type: String, enum: ["school", "university", "both"], default: "both" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

subjectSchema.pre("validate", function () {
  this.label = this.name;
  this.search = normalizeText(this.name);
});

export default mongoose.model("Subject", subjectSchema);
