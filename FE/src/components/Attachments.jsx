import React from "react";
import { FileText, Download, CalendarDays, GraduationCap } from "lucide-react";
import { C } from "../constants";
import { fileUrl, formatSize } from "../api";

const font = { fontFamily: "'Inter', sans-serif" };

export function DocMeta({ semester, lecturer }) {
  if (!semester && !lecturer) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]" style={{ ...font, color: C.ink2 }}>
      {semester && (
        <span className="flex items-center gap-1">
          <CalendarDays size={12} color={C.mute} /> {semester}
        </span>
      )}
      {lecturer && (
        <span className="flex items-center gap-1">
          <GraduationCap size={13} color={C.mute} /> GV. {lecturer}
        </span>
      )}
    </div>
  );
}

// Ảnh hiện dạng lưới (bấm để xem ảnh gốc), PDF hiện dạng thẻ có nút mở/tải
export default function Attachments({ items, semester, lecturer }) {
  if (!items?.length) return null;
  const images = items.filter((a) => a.mimeType.startsWith("image/"));
  const docs = items.filter((a) => !a.mimeType.startsWith("image/"));

  return (
    <div className="mt-3 space-y-2">
      <DocMeta semester={semester} lecturer={lecturer} />

      {images.length > 0 && (
        <div className={`grid gap-1.5 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.map((a) => (
            <a key={a.fileId} href={fileUrl(a.fileId)} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden" style={{ background: C.paper }}>
              <img
                src={fileUrl(a.fileId)}
                alt={a.name}
                loading="lazy"
                className={`w-full object-cover hover:opacity-90 ${images.length === 1 ? "max-h-96" : "h-40"}`}
              />
            </a>
          ))}
        </div>
      )}

      {docs.map((a) => (
        <div key={a.fileId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${C.coral}1a` }}>
            <FileText size={20} color={C.coral} />
          </span>
          <a href={fileUrl(a.fileId)} target="_blank" rel="noreferrer" className="flex-1 min-w-0 hover:underline">
            <div className="text-sm font-medium truncate" style={{ ...font, color: C.ink }}>{a.name}</div>
            <div className="text-[11px]" style={{ ...font, color: C.mute }}>PDF · {formatSize(a.size)}</div>
          </a>
          <a
            href={fileUrl(a.fileId, { download: true })}
            title="Tải về"
            className="p-2 rounded-full hover:opacity-70 shrink-0"
            style={{ color: C.ink2 }}
          >
            <Download size={16} />
          </a>
        </div>
      ))}
    </div>
  );
}
