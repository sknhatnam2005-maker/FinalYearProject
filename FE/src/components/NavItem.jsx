import React from "react";
import { C } from "../constants";

export default function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left relative"
      style={{ background: active ? C.ink : "transparent", color: active ? C.paper : C.ink }}
    >
      <Icon size={19} strokeWidth={active ? 2.4 : 2} />
      <span className="text-[15px]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: active ? 600 : 500 }}>
        {label}
      </span>
      {badge ? (
        <span
          className="ml-auto text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center"
          style={{ background: C.coral, color: "#fff" }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
