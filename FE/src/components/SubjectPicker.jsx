import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, Plus, Loader2, Check, Hash } from "lucide-react";
import { C } from "../constants";
import { subjectColor } from "../data";
import { api } from "../api";

const font = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const RECENT_KEY = "gochoc_recent_subjects";

export function loadRecentSubjects() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

export function rememberSubject(label) {
  try {
    const next = [label, ...loadRecentSubjects().filter((l) => l !== label)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // không lưu được thì thôi, chỉ mất phần "Gần đây"
  }
}

function Row({ label, sub, active, selected, onPick, onHover }) {
  const color = subjectColor(label);
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onPick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left"
      style={{ background: active ? C.paper : "transparent" }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="flex-1 min-w-0 text-sm truncate" style={{ ...font, color: C.ink }}>{label}</span>
      {sub && <span className="text-[11px] shrink-0" style={{ ...mono, color: C.mute }}>{sub}</span>}
      {selected && <Check size={14} color={C.green} className="shrink-0" />}
    </button>
  );
}

// Ô chọn môn có tìm kiếm: gõ tên, không cần dấu (lap trinh), không thấy thì thêm môn mới.
// Mặc định chỉ hiện môn hợp với vai trò (BE lọc). all = true: mọi môn (vd. bộ lọc Thư viện).
// popularLabel: tên nhóm khi chưa gõ gì (giảng viên: "Môn bạn dạy").
export default function SubjectPicker({ value, onChange, placeholder = "Chọn môn học", all = false, popularLabel = "Phổ biến" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [popular, setPopular] = useState([]); // toàn bộ môn được phép (tối đa 50), xếp theo số bài
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const q = query.trim();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCreating(false);
    setError("");
    setActive(0);
    // Tải lại mỗi lần mở để cập nhật nếu vai trò / môn dạy vừa thay đổi
    api.getSubjects("", 50, { all }).then(setPopular).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api
        .getSubjects(q, 15, { all })
        .then((r) => {
          setResults(r);
          setActive(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // "Gần đây" chỉ giữ môn vẫn còn hợp với vai trò hiện tại
  const allowed = new Set(popular.map((s) => s.label));
  const recent = loadRecentSubjects().filter((l) => allowed.has(l));
  const items = q
    ? results.map((s) => ({ label: s.label, sub: s.postCount ? `${s.postCount} bài` : "" }))
    : [
        ...recent.map((label) => ({ label, group: "Gần đây" })),
        ...popular
          .filter((s) => !recent.includes(s.label))
          .slice(0, popularLabel === "Phổ biến" ? 8 : 10)
          .map((s) => ({ label: s.label, sub: s.postCount ? `${s.postCount} bài` : "", group: popularLabel })),
      ];
  const exact = results.some((s) => s.label.toLowerCase() === q.toLowerCase());

  const pick = (label) => {
    onChange(label);
    rememberSubject(label);
    setOpen(false);
  };

  // Thêm luôn môn với tên vừa gõ; BE tự trả về môn có sẵn nếu trùng tên (kể cả khác dấu/hoa thường)
  const createSubject = async () => {
    if (q.length < 2 || creating) return;
    setCreating(true);
    setError("");
    try {
      const s = await api.createSubject({ name: q });
      pick(s.label);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const onKeyDown = (e) => {
    const total = items.length + (q && !exact ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < items.length) pick(items[active].label);
      else if (q) createSubject();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const color = value ? subjectColor(value) : C.mute;
  const inputStyle = { ...font, background: C.paper, border: `1px solid ${C.line}`, color: C.ink };

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={value || placeholder}
        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full max-w-full"
        style={{ ...mono, background: value ? `${color}1f` : C.paper, color, border: value ? "none" : `1px dashed ${C.line}` }}
      >
        <Hash size={11} className="shrink-0" />
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={13} className="shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-9 z-40 w-[min(320px,calc(100vw-48px))] rounded-xl overflow-hidden"
            style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 8px 24px rgba(28,37,65,0.15)" }}
          >
              <>
                <div className="p-2" style={{ borderBottom: `1px solid ${C.line}` }}>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={inputStyle}>
                    <Search size={14} color={C.mute} />
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder="Tìm môn học (vd. lap trinh, co so du lieu)"
                      className="flex-1 bg-transparent outline-none text-sm"
                      style={font}
                    />
                    {loading && <Loader2 size={13} className="animate-spin" color={C.mute} />}
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto py-1">
                  {items.map((it, i) => (
                    <React.Fragment key={`${it.group}-${it.label}`}>
                      {!q && it.group && it.group !== items[i - 1]?.group && (
                        <div className="px-3 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide" style={{ ...mono, color: C.mute }}>
                          {it.group}
                        </div>
                      )}
                      <Row
                        label={it.label}
                        sub={it.sub}
                        active={i === active}
                        selected={it.label === value}
                        onHover={() => setActive(i)}
                        onPick={() => pick(it.label)}
                      />
                    </React.Fragment>
                  ))}

                  {q && !loading && !results.length && (
                    <div className="px-3 py-2 text-xs" style={{ ...font, color: C.mute }}>Chưa có môn nào khớp "{q}".</div>
                  )}

                  {q && !exact && (
                    <button
                      type="button"
                      onMouseEnter={() => setActive(items.length)}
                      onClick={createSubject}
                      disabled={creating || q.length < 2}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium disabled:opacity-50"
                      style={{ ...font, color: C.green, background: active === items.length ? C.paper : "transparent", borderTop: items.length ? `1px solid ${C.line}` : "none" }}
                    >
                      {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Thêm môn mới "{q}"
                    </button>
                  )}

                  {error && <div className="px-3 py-2 text-xs" style={{ ...font, color: C.coral }}>{error}</div>}
                </div>
              </>
          </div>
        </>
      )}
    </div>
  );
}
