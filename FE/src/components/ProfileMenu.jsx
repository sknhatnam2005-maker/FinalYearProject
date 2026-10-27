import React from "react";
import { User, Settings, LogOut } from "lucide-react";
import { C } from "../constants";

export default function ProfileMenu({ onClose, onViewProfile, onLogout }) {
  const items = [
    { icon: User, label: "Trang cá nhân", onClick: onViewProfile },
    { icon: Settings, label: "Cài đặt", onClick: onClose },
    { icon: LogOut, label: "Đăng xuất", onClick: onLogout },
  ];
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-12 w-56 rounded-2xl overflow-hidden z-40 py-1" style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 8px 24px rgba(28,37,65,0.12)" }}>
        {items.map((item) => (
          <button key={item.label} onClick={item.onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:opacity-70" style={{ color: C.ink2, fontFamily: "'Inter', sans-serif" }}>
            <item.icon size={16} />
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
