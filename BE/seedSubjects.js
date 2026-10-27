import Subject, { normalizeText } from "./models/Subject.js";
import Post from "./models/Post.js";

// Danh sách môn có sẵn, chia theo cấp học để học sinh/sinh viên chỉ thấy môn hợp với mình.
// Người dùng tự thêm môn khác ngay trong ô chọn môn khi đăng bài.
const SCHOOL = ["Toán học", "Ngữ văn", "Vật lý", "Hoá học", "Sinh học", "Lịch sử", "Địa lý", "Tin học", "Giáo dục công dân"];
const BOTH = ["Tiếng Anh", "Lập trình", "Tiếng Nhật", "Kỹ năng mềm"];
const UNIVERSITY = [
  "Kinh tế",
  "Toán cao cấp",
  "Toán rời rạc",
  "Xác suất thống kê",
  "Nhập môn lập trình",
  "Lập trình hướng đối tượng",
  "Cấu trúc dữ liệu và giải thuật",
  "Cơ sở dữ liệu",
  "Kiến trúc máy tính",
  "Hệ điều hành",
  "Mạng máy tính",
  "Thiết kế web",
  "Lập trình web",
  "Lập trình di động",
  "Công nghệ phần mềm",
  "Phân tích yêu cầu phần mềm",
  "Kiểm thử phần mềm",
  "Kiến trúc và thiết kế phần mềm",
  "Trí tuệ nhân tạo",
  "Học máy",
  "Internet vạn vật (IoT)",
  "An toàn thông tin",
  "Khởi nghiệp",
  "Triết học Mác – Lênin",
  "Kinh tế chính trị Mác – Lênin",
  "Chủ nghĩa xã hội khoa học",
  "Tư tưởng Hồ Chí Minh",
  "Lịch sử Đảng Cộng sản Việt Nam",
  "Đồ án tốt nghiệp",
];
const DEFAULT_SUBJECTS = [
  ...SCHOOL.map((name) => [name, "school"]),
  ...BOTH.map((name) => [name, "both"]),
  ...UNIVERSITY.map((name) => [name, "university"]),
];

// Bản trước lưu môn kèm mã (vd. "PRF192 · Programming Fundamentals").
// Môn có mã mà chưa bài nào dùng thì xoá; đã có bài dùng thì đổi về chỉ còn tên và cập nhật bài viết.
async function dropSubjectCodes() {
  const coll = Subject.collection;
  const coded = await coll.find({ code: { $nin: ["", null] } }).toArray();
  for (const s of coded) {
    if (await Post.exists({ subject: s.label })) {
      const taken = await coll.findOne({ search: normalizeText(s.name), _id: { $ne: s._id } });
      const newLabel = taken ? taken.label : s.name;
      await Post.updateMany({ subject: s.label }, { subject: newLabel });
      if (taken) await coll.deleteOne({ _id: s._id });
      else await coll.updateOne({ _id: s._id }, { $set: { label: s.name, search: normalizeText(s.name) }, $unset: { code: "" } });
    } else {
      await coll.deleteOne({ _id: s._id });
    }
  }
  await coll.updateMany({ code: { $exists: true } }, { $unset: { code: "" } });
  if (coded.length) console.log(`Đã bỏ mã của ${coded.length} môn học`);
}

export async function seedSubjects() {
  await dropSubjectCodes();
  let added = 0;
  for (const [name, level] of DEFAULT_SUBJECTS) {
    // Môn đã có thì chỉ cập nhật cấp học (môn tạo từ bản cũ chưa có trường level)
    const updated = await Subject.updateOne({ search: normalizeText(name) }, { $set: { level } });
    if (updated.matchedCount) continue;
    await Subject.create({ name, level }).then(() => added++).catch(() => {});
  }
  // Môn người dùng tự thêm từ trước khi có cấp học → dùng chung
  await Subject.updateMany({ level: { $exists: false } }, { $set: { level: "both" } });
  if (added) console.log(`Đã thêm ${added} môn học mặc định`);
}
