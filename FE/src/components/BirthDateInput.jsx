import React, { useState, useEffect } from "react";
import { C } from "../constants";

const font = { fontFamily: "'Inter', sans-serif" };

function daysInMonth(month, year) {
  if (!month) return 31;
  return new Date(year || 2000, month, 0).getDate(); // năm chưa chọn → lấy năm nhuận để 29/2 vẫn chọn được
}

function parse(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : { y: "", m: "", d: "" };
}

// Chọn ngày sinh bằng 3 ô Ngày / Tháng / Năm. Chỉ báo ra "YYYY-MM-DD" khi đã chọn đủ cả 3, chưa đủ thì "".
export default function BirthDateInput({ value, onChange, invalid = false }) {
  const [parts, setParts] = useState(() => parse(value));

  // Đồng bộ khi giá trị bên ngoài đổi (vd. mở form sửa hồ sơ)
  useEffect(() => {
    if (value) setParts(parse(value));
  }, [value]);

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 95 }, (_, i) => thisYear - 5 - i); // 5 → 100 tuổi
  const maxDay = daysInMonth(parts.m, parts.y);

  const update = (patch) => {
    const next = { ...parts, ...patch };
    if (next.d && next.d > daysInMonth(next.m, next.y)) next.d = ""; // vd. đang 31 mà đổi sang tháng 4
    setParts(next);
    onChange(
      next.d && next.m && next.y
        ? `${next.y}-${String(next.m).padStart(2, "0")}-${String(next.d).padStart(2, "0")}`
        : ""
    );
  };

  const style = {
    ...font,
    background: "#fff",
    border: `1px solid ${invalid ? C.coral : C.line}`,
    color: C.ink,
  };
  const cls = "px-2.5 py-2.5 rounded-xl text-sm outline-none";

  return (
    <div className="grid grid-cols-[1fr_1.3fr_1.2fr] gap-2">
      <select value={parts.d} onChange={(e) => update({ d: +e.target.value || "" })} className={cls} style={style} aria-label="Ngày">
        <option value="">Ngày</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select value={parts.m} onChange={(e) => update({ m: +e.target.value || "" })} className={cls} style={style} aria-label="Tháng">
        <option value="">Tháng</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>Tháng {m}</option>
        ))}
      </select>
      <select value={parts.y} onChange={(e) => update({ y: +e.target.value || "" })} className={cls} style={style} aria-label="Năm">
        <option value="">Năm</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
