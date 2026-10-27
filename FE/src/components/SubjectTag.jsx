import React from "react";
import { Hash } from "lucide-react";
import { subjectColor } from "../data";

export default function SubjectTag({ name }) {
  const color = subjectColor(name);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full max-w-full"
      style={{ background: `${color}1f`, color, fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <Hash size={11} className="shrink-0" /> <span className="truncate">{name}</span>
    </span>
  );
}
