import { C } from "./constants";

export const subjects = [
  { name: "Toán học", color: C.mustard },
  { name: "Lập trình", color: C.green },
  { name: "Tiếng Anh", color: C.coral },
  { name: "Vật lý", color: "#6C8EBF" },
  { name: "Kinh tế", color: "#9C6ADE" },
];

const SUBJECT_PALETTE = [C.mustard, C.green, C.coral, "#6C8EBF", "#9C6ADE", "#2A9D8F", "#C0587E", "#B5793A"];

// Môn mặc định giữ màu cũ; môn khác lấy màu cố định theo tên (cùng tên → luôn cùng màu)
export function subjectColor(name) {
  const known = subjects.find((s) => s.name === name);
  if (known) return known.color;
  let h = 0;
  for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECT_PALETTE[h % SUBJECT_PALETTE.length];
}

// Học kỳ theo kiểu FPT (Spring/Summer/Fall), từ kỳ hiện tại lùi về 3 năm
export function semesterOptions(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const terms = ["Spring", "Summer", "Fall"];
  const current = month <= 4 ? 0 : month <= 8 ? 1 : 2;
  const list = [];
  for (let y = year, t = current; list.length < 10; t--) {
    if (t < 0) {
      t = 2;
      y--;
    }
    list.push(`${terms[t]} ${y}`);
  }
  return list;
}

export const people = [
  { name: "Minh Anh", handle: "@minhanh.study", subject: "Toán học" },
  { name: "Đức Huy", handle: "@huy.code", subject: "Lập trình" },
  { name: "Thảo Vy", handle: "@vy.english", subject: "Tiếng Anh" },
];

export const notifications = [
  { id: 1, type: "like", actor: "Đức Huy", text: "đã thích bài viết của bạn", time: "5 phút trước", read: false },
  { id: 2, type: "comment", actor: "Minh Anh", text: "đã bình luận: \"Cảm ơn bạn đã chia sẻ!\"", time: "20 phút trước", read: false },
  { id: 3, type: "follow", actor: "Thảo Vy", text: "bắt đầu theo dõi bạn", time: "1 giờ trước", read: true },
];
