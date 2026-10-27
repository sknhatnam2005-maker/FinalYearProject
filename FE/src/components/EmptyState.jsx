import React from "react";
import { C } from "../constants";

export default function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="rounded-2xl p-10 flex flex-col items-center text-center gap-2" style={{ background: C.card, border: `1px dashed ${C.line}` }}>
      <Icon size={28} style={{ color: C.mute }} />
      <div style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 600 }} className="text-lg">{title}</div>
      <div style={{ fontFamily: "'Inter', sans-serif", color: C.mute }} className="text-sm max-w-xs">{body}</div>
    </div>
  );
}
