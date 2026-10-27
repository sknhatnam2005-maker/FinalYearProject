import React from "react";
import { C } from "../constants";

export default function SectionLabel({ children }) {
  return (
    <div className="text-xs font-semibold tracking-wide uppercase mb-3" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
      {children}
    </div>
  );
}
