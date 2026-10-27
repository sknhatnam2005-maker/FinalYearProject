import React, { useState, useEffect } from "react";
import { Search, Loader2, AtSign } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import FriendButton from "./FriendButton";

const font = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

// Ô tìm kiếm trên thanh header: gợi ý người dùng thật trong DB, đồng thời vẫn lọc bài viết như cũ
export default function UserSearch({ query, onQueryChange, onOpenPerson }) {
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const q = query.trim();
  const byHandle = q.startsWith("@");

  useEffect(() => {
    if (!q || q === "@") {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api
        .searchUsers(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const open = (user) => {
    setFocused(false);
    onQueryChange("");
    onOpenPerson(user);
  };

  const setStatus = (id, friendStatus) =>
    setResults((rs) => rs.map((u) => (u._id === id ? { ...u, friendStatus } : u)));

  const showDropdown = focused && q;

  return (
    <div className="relative flex-1 max-w-md">
      <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        {byHandle ? <AtSign size={16} style={{ color: C.green }} /> : <Search size={16} style={{ color: C.mute }} />}
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setFocused(false);
            if (e.key === "Enter" && results[0]) open(results[0]);
          }}
          placeholder="Tìm bạn bè (@username), bài viết..."
          className="bg-transparent outline-none text-sm flex-1 placeholder:opacity-60"
          style={{ ...font, color: C.ink }}
        />
        {loading && <Loader2 size={14} className="animate-spin" color={C.mute} />}
      </div>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setFocused(false)} />
          <div
            className="absolute left-0 right-0 top-12 rounded-2xl overflow-hidden z-40"
            style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 8px 24px rgba(28,37,65,0.12)" }}
          >
            <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ ...mono, color: C.mute }}>
              {byHandle ? "Tìm theo username" : "Mọi người"}
            </div>

            {q === "@" ? (
              <div className="px-4 pb-3 pt-1 text-sm" style={{ ...font, color: C.mute }}>
                Gõ username sau dấu @, ví dụ <span style={{ ...mono, color: C.ink2 }}>@nhatnam</span>
              </div>
            ) : results.length ? (
              <div className="max-h-80 overflow-y-auto pb-1">
                {results.map((u) => (
                  <div key={u._id} className="flex items-center gap-3 px-4 py-2 hover:brightness-95" style={{ background: C.card }}>
                    <button onClick={() => open(u)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <Avatar label={u.name} size={36} color={u.avatarColor || C.mustard} src={u.avatarUrl} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ ...font, color: C.ink }}>{u.name} <RoleBadge role={u.role} /></div>
                        <div className="text-xs truncate" style={{ ...mono, color: C.mute }}>@{u.handle}</div>
                      </div>
                    </button>
                    <FriendButton small userId={u._id} name={u.name} status={u.friendStatus} onChange={(s) => setStatus(u._id, s)} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 pb-3 pt-1 text-sm" style={{ ...font, color: C.mute }}>
                {loading ? "Đang tìm..." : `Không tìm thấy người dùng "${q}".`}
              </div>
            )}

            {!byHandle && (
              <div className="px-4 py-2 text-[11px]" style={{ ...font, color: C.mute, borderTop: `1px solid ${C.line}` }}>
                Bài viết khớp với "{q}" đang được lọc ở bảng tin. Mẹo: gõ <b>@</b> trước để chỉ tìm username.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
