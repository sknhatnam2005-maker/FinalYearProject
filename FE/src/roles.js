import { C } from "./constants";

// Khớp với BE/roles.js
export const ROLES = {
  hoc_sinh: { label: "Học sinh", short: "HS", color: "#6C8EBF", minAge: 6, maxAge: 19, desc: "Môn phổ thông" },
  sinh_vien: { label: "Sinh viên", short: "SV", color: C.green, minAge: 16, maxAge: 60, desc: "Môn đại học" },
  giang_vien: { label: "Giảng viên", short: "GV", color: C.coral, minAge: 22, maxAge: 80, desc: "Chọn môn mình dạy" },
};

export const GENDERS = { male: "Nam", female: "Nữ", other: "Khác" };

// Tuổi tròn tính đến hôm nay từ "YYYY-MM-DD" (giống BE/roles.js)
export function ageFromBirthDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age;
}

// Dưới 18 tuổi thường là học sinh, từ 18 là sinh viên. Giảng viên phải tự chọn.
export function suggestRole(age) {
  const n = Number(age);
  if (!n) return "";
  return n < 18 ? "hoc_sinh" : "sinh_vien";
}

export function roleAgeError(role, age) {
  const r = ROLES[role];
  const n = Number(age);
  if (!r || !n) return "";
  if (n < r.minAge || n > r.maxAge) return `${r.label} cần từ ${r.minAge} đến ${r.maxAge} tuổi`;
  return "";
}
