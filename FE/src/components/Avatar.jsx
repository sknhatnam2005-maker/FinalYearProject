import React from "react";
import { C } from "../constants";

export default function Avatar({ label, size = 40, color, src }) {
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: color || C.ink,
        color: C.card,
        fontFamily: "'Fraunces', serif",
        fontSize: size * 0.42,
      }}
    >
      {label.charAt(0).toUpperCase()}
    </div>
  );
}
