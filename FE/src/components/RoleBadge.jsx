import React from "react";
import { ROLES } from "../roles";

// Nhãn nhỏ cạnh tên: GV / SV / HS. full = hiện cả chữ ("Giảng viên")
export default function RoleBadge({ role, full = false }) {
  const r = ROLES[role];
  if (!r) return null;
  return (
    <span
      title={r.label}
      className="inline-flex items-center text-[10px] font-bold px-1.5 py-[1px] rounded-md shrink-0 align-middle"
      style={{ background: `${r.color}1f`, color: r.color, fontFamily: "'Inter', sans-serif", letterSpacing: "0.02em" }}
    >
      {full ? r.label : r.short}
    </span>
  );
}
