import Subject from "./models/Subject.js";

// Vai trò người dùng: khoảng tuổi hợp lệ và cấp học của các môn được thấy/đăng bài.
// Giảng viên không theo cấp học mà theo danh sách môn mình dạy (teachingSubjects).
export const ROLES = {
  hoc_sinh: { label: "Học sinh", minAge: 6, maxAge: 19, levels: ["school", "both"] },
  sinh_vien: { label: "Sinh viên", minAge: 16, maxAge: 60, levels: ["university", "both"] },
  giang_vien: { label: "Giảng viên", minAge: 22, maxAge: 80 },
};

const MAX_TEACHING_SUBJECTS = 10;

// Tuổi tròn tính đến hôm nay từ ngày sinh "YYYY-MM-DD". Trả về null nếu ngày không hợp lệ.
export function ageFromBirthDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Chặn ngày không tồn tại (vd. 31/02) và ngày trong tương lai
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const now = new Date();
  if (date > now) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age;
}

// Kiểm tra bộ (ngày sinh, vai trò, môn giảng dạy). Trả về { error } hoặc { value } đã chuẩn hoá.
// Tài khoản cũ chưa có ngày sinh vẫn gửi được "age".
export async function validateRole({ birthDate, age, role, teachingSubjects }) {
  const r = ROLES[role];
  if (!r) return { error: "Vui lòng chọn vai trò: học sinh, sinh viên hoặc giảng viên" };

  const n = birthDate ? ageFromBirthDate(birthDate) : Number(age);
  if (birthDate && n === null) return { error: "Ngày sinh không hợp lệ" };
  if (!Number.isInteger(n) || n < 6 || n > 100) return { error: "Tuổi không hợp lệ (cần từ 6 đến 100 tuổi)" };
  if (n < r.minAge || n > r.maxAge) {
    return { error: `${r.label} cần từ ${r.minAge} đến ${r.maxAge} tuổi` };
  }

  let subjects = [];
  if (role === "giang_vien") {
    const wanted = [...new Set((teachingSubjects || []).filter((s) => typeof s === "string"))];
    if (!wanted.length) return { error: "Giảng viên cần chọn ít nhất 1 môn giảng dạy" };
    if (wanted.length > MAX_TEACHING_SUBJECTS) return { error: `Chọn tối đa ${MAX_TEACHING_SUBJECTS} môn giảng dạy` };
    const found = await Subject.find({ label: { $in: wanted } }).select("label");
    if (found.length !== wanted.length) return { error: "Có môn giảng dạy không tồn tại" };
    subjects = wanted;
  }
  return {
    value: { age: n, role, teachingSubjects: subjects, ...(birthDate && { birthDate: new Date(`${birthDate}T00:00:00Z`) }) },
  };
}

// Giới tính và trường: không bắt buộc. Trả về { error } hoặc { value } chỉ gồm các trường có gửi lên.
export function validatePersonal({ gender, school }) {
  const value = {};
  if (gender !== undefined) {
    if (![null, "", "male", "female", "other"].includes(gender)) return { error: "Giới tính không hợp lệ" };
    value.gender = gender || null;
  }
  if (school !== undefined) value.school = String(school).trim().replace(/\s+/g, " ").slice(0, 100);
  return { value };
}

// Bộ lọc Subject cho những môn người dùng được thấy / đăng bài. Chưa có vai trò → không giới hạn.
export function subjectFilterFor(user) {
  if (!user?.role) return {};
  if (user.role === "giang_vien") return { label: { $in: user.teachingSubjects } };
  return { level: { $in: ROLES[user.role].levels } };
}

export async function canPostInSubject(user, label) {
  // Dùng $and: bộ lọc của giảng viên cũng là điều kiện trên "label", gộp object sẽ bị ghi đè mất
  return !!(await Subject.exists({ $and: [subjectFilterFor(user), { label }] }));
}

// Môn người dùng tự thêm nhận cấp học theo vai trò của người tạo
export function levelForNewSubject(user) {
  if (user?.role === "hoc_sinh") return "school";
  if (user?.role === "sinh_vien") return "university";
  return "both";
}
