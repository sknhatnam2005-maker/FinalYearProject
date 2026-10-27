import React, { useState } from "react";
import { Globe, Users, Lock, ChevronDown, Check } from "lucide-react";
import { C } from "../constants";

export const VISIBILITY = {
  public: { label: "Công khai", desc: "Mọi người đều xem được", icon: Globe },
  friends: { label: "Bạn bè", desc: "Chỉ bạn bè của bạn", icon: Users },
  private: { label: "Chỉ mình tôi", desc: "Không ai khác xem được", icon: Lock },
};

const KEY = "gochoc_last_visibility";

export function loadLastVisibility() {
  try {
    const v = localStorage.getItem(KEY);
    return VISIBILITY[v] ? v : "public";
  } catch {
    return "public";
  }
}

function saveLastVisibility(v) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // không lưu được thì lần sau mặc định Công khai
  }
}

// Biểu tượng nhỏ cạnh thời gian đăng (bài cũ không có visibility → công khai)
export function VisibilityIcon({ value, size = 12 }) {
  const v = VISIBILITY[value] || VISIBILITY.public;
  const Icon = v.icon;
  return (
    <span title={v.label} className="inline-flex align-middle">
      <Icon size={size} />
    </span>
  );
}

// Danh sách 3 lựa chọn, dùng trong dropdown của ô đăng bài và menu "..." của bài viết
export function VisibilityOptions({ value, onPick }) {
  return Object.entries(VISIBILITY).map(([key, v]) => {
    const Icon = v.icon;
    return (
      <button
        type="button"
        key={key}
        onClick={() => onPick(key)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:opacity-80"
        style={{ background: value === key ? C.paper : "transparent" }}
      >
        <Icon size={15} color={C.ink2} className="shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium" style={{ color: C.ink, fontFamily: "'Inter', sans-serif" }}>{v.label}</span>
          <span className="block text-[11px]" style={{ color: C.mute, fontFamily: "'Inter', sans-serif" }}>{v.desc}</span>
        </span>
        {value === key && <Check size={14} color={C.green} />}
      </button>
    );
  });
}

// Nút chọn quyền riêng tư (ô đăng bài, form bắt đầu livestream). Nhớ lựa chọn gần nhất.
// compact: chỉ hiện icon (dùng trong hàng nút của ô đăng bài)
export default function VisibilityPicker({ value, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const v = VISIBILITY[value] || VISIBILITY.public;
  const Icon = v.icon;

  return (
    <div className="relative shrink-0">
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={`Ai có thể xem: ${v.label}`}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5"
          style={{ color: value === "public" ? C.ink2 : C.coral }}
        >
          <Icon size={17} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Ai có thể xem?"
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full hover:opacity-80"
          style={{ background: C.paper, color: C.ink2, border: `1px solid ${C.line}`, fontFamily: "'Inter', sans-serif" }}
        >
          <Icon size={12} /> {v.label} <ChevronDown size={12} />
        </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-8 z-40 w-56 rounded-xl overflow-hidden py-1"
            style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 8px 24px rgba(28,37,65,0.15)" }}
          >
            <VisibilityOptions
              value={value}
              onPick={(key) => {
                saveLastVisibility(key);
                onChange(key);
                setOpen(false);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
