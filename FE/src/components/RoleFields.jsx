import React, { useState, useEffect } from "react";
import { GraduationCap, School, Presentation, Search, X, Loader2, Plus } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import { ROLES, GENDERS, suggestRole, roleAgeError, ageFromBirthDate } from "../roles";
import BirthDateInput from "./BirthDateInput";
import { subjectColor } from "../data";

const font = { fontFamily: "'Inter', sans-serif" };
const ICONS = { hoc_sinh: School, sinh_vien: GraduationCap, giang_vien: Presentation };
const MAX_TEACHING = 10;

// Chọn môn giảng dạy: tìm trong toàn bộ môn (không lọc theo vai trò), chọn nhiều, tối đa 10
function TeachingSubjectsInput({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api
        .getSubjects(query.trim(), 12, { all: true })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = (label) =>
    onChange(value.includes(label) ? value.filter((v) => v !== label) : value.length < MAX_TEACHING ? [...value, label] : value);

  const options = results.filter((s) => !value.includes(s.label));

  return (
    <div className="rounded-xl p-2.5 space-y-2" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
      <div className="text-xs font-semibold" style={{ ...font, color: C.ink2 }}>
        Môn bạn giảng dạy <span style={{ color: C.mute, fontWeight: 400 }}>({value.length}/{MAX_TEACHING})</span>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((label) => (
            <span
              key={label}
              className="flex items-center gap-1 text-xs font-medium pl-2.5 pr-1 py-1 rounded-full"
              style={{ ...font, background: `${subjectColor(label)}1f`, color: subjectColor(label) }}
            >
              {label}
              <button type="button" onClick={() => toggle(label)} className="p-0.5 rounded-full hover:opacity-70">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <Search size={13} color={C.mute} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm môn (vd. co so du lieu)"
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ ...font, color: C.ink }}
        />
        {loading && <Loader2 size={13} className="animate-spin" color={C.mute} />}
      </div>

      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
        {options.map((s) => (
          <button
            type="button"
            key={s._id}
            onClick={() => toggle(s.label)}
            disabled={value.length >= MAX_TEACHING}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full hover:opacity-80 disabled:opacity-40"
            style={{ ...font, background: C.card, color: C.ink2, border: `1px solid ${C.line}` }}
          >
            <Plus size={11} /> {s.label}
          </button>
        ))}
        {!loading && !options.length && (
          <span className="text-xs" style={{ ...font, color: C.mute }}>
            {query ? "Không thấy môn này. Sau khi đăng ký bạn có thể thêm môn mới khi đăng bài." : ""}
          </span>
        )}
      </div>
    </div>
  );
}

const labelCls = "text-xs font-semibold mb-1.5 ml-1";

// Khối thông tin cá nhân: ngày sinh, giới tính, trường, vai trò (+ môn dạy cho giảng viên).
// Dùng chung cho đăng ký, bổ sung hồ sơ, sửa hồ sơ.
// value: { birthDate: "YYYY-MM-DD", gender, school, role, teachingSubjects }
export default function RoleFields({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  // Vai trò tự gợi ý theo tuổi cho tới khi người dùng tự bấm chọn
  const [roleTouched, setRoleTouched] = useState(!!value.role);

  const age = ageFromBirthDate(value.birthDate);
  const onBirthDate = (birthDate) => {
    const a = ageFromBirthDate(birthDate);
    set(roleTouched || a === null ? { birthDate } : { birthDate, role: suggestRole(a) });
  };

  const ageError = roleAgeError(value.role, age);
  const inputStyle = { ...font, border: `1px solid ${C.line}`, color: C.ink, background: "#fff" };

  return (
    <div className="space-y-3">
      <div>
        <div className={labelCls} style={{ ...font, color: C.ink2 }}>
          Ngày sinh {age !== null && <span style={{ color: C.mute, fontWeight: 400 }}>· {age} tuổi</span>}
        </div>
        <BirthDateInput value={value.birthDate} onChange={onBirthDate} invalid={!!ageError} />
        {ageError && <div className="text-[11px] mt-1 ml-1" style={{ ...font, color: C.coral }}>{ageError}</div>}
      </div>

      <div>
        <div className={labelCls} style={{ ...font, color: C.ink2 }}>Giới tính</div>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(GENDERS).map(([key, label]) => {
            const active = value.gender === key;
            return (
              <button
                type="button"
                key={key}
                onClick={() => set({ gender: key })}
                className="py-2 rounded-xl text-sm font-medium"
                style={{ ...font, background: active ? C.ink : C.card, color: active ? C.paper : C.ink2, border: `1px solid ${active ? C.ink : C.line}` }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className={labelCls} style={{ ...font, color: C.ink2 }}>
          Trường <span style={{ color: C.mute, fontWeight: 400 }}>(không bắt buộc)</span>
        </div>
        <input
          value={value.school || ""}
          onChange={(e) => set({ school: e.target.value })}
          maxLength={100}
          placeholder="vd. Đại học FPT, THPT Chu Văn An"
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={inputStyle}
        />
      </div>

      <div>
        <div className={labelCls} style={{ ...font, color: C.ink2 }}>Bạn là</div>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ROLES).map(([key, r]) => {
            const Icon = ICONS[key];
            const active = value.role === key;
            return (
              <button
                type="button"
                key={key}
                onClick={() => {
                  setRoleTouched(true);
                  set({ role: key });
                }}
                className="flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl transition-colors"
                style={{
                  ...font,
                  background: active ? `${r.color}14` : C.card,
                  border: `1.5px solid ${active ? r.color : C.line}`,
                  color: active ? r.color : C.ink2,
                }}
              >
                <Icon size={18} />
                <span className="text-xs font-semibold">{r.label}</span>
                <span className="text-[10px] leading-tight text-center" style={{ color: C.mute }}>{r.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {value.role === "giang_vien" && (
        <TeachingSubjectsInput value={value.teachingSubjects} onChange={(teachingSubjects) => set({ teachingSubjects })} />
      )}
    </div>
  );
}

// Kiểm tra phía FE trước khi gửi (BE vẫn kiểm tra lại)
export function roleFieldsError({ birthDate, gender, role, teachingSubjects }) {
  if (!birthDate) return "Vui lòng chọn đủ ngày, tháng, năm sinh";
  if (!gender) return "Vui lòng chọn giới tính";
  if (!role) return "Vui lòng chọn vai trò";
  const ageErr = roleAgeError(role, ageFromBirthDate(birthDate));
  if (ageErr) return ageErr;
  if (role === "giang_vien" && !teachingSubjects.length) return "Giảng viên cần chọn ít nhất 1 môn giảng dạy";
  return "";
}
