import React, { useState, useEffect } from "react";
import { X, Search, Loader2, Users } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import Avatar from "./Avatar";
import FriendButton from "./FriendButton";

const font = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

const TABS = [
  { key: "friends", label: "Bạn bè", empty: "Bạn chưa có người bạn nào. Hãy tìm bạn bằng ô tìm kiếm (gõ @username)." },
  { key: "incoming", label: "Lời mời nhận được", empty: "Không có lời mời kết bạn nào đang chờ." },
  { key: "outgoing", label: "Đã gửi", empty: "Bạn chưa gửi lời mời nào đang chờ chấp nhận." },
];

export default function FriendsModal({ initialTab = "friends", onClose, onOpenPerson, onFriendCountChange }) {
  const [tab, setTab] = useState(initialTab);
  // Gộp cả 3 danh sách vào một mảng, mỗi người mang friendStatus riêng.
  // Bấm Chấp nhận/Huỷ chỉ đổi status → người đó tự chuyển sang tab đúng.
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([api.getFriends(), api.getFriendRequests(), api.getSentFriendRequests()])
      .then(([friends, incoming, outgoing]) => setPeople([...friends, ...incoming, ...outgoing]))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const friendCount = people.filter((p) => p.friendStatus === "friends").length;
  useEffect(() => {
    if (!loading) onFriendCountChange?.(friendCount);
  }, [friendCount, loading]);

  const setStatus = (id, friendStatus) =>
    setPeople((ps) => ps.map((p) => (p._id === id ? { ...p, friendStatus } : p)));

  const q = query.trim().toLowerCase().replace(/^@/, "");
  const inTab = people.filter((p) => p.friendStatus === tab);
  const shown = q ? inTab.filter((p) => p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)) : inTab;
  const countOf = (key) => people.filter((p) => p.friendStatus === key).length;

  const open = (person) => {
    onClose();
    onOpenPerson(person);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0" style={{ background: "rgba(28,37,65,0.45)" }} onClick={onClose} />

      <div
        className="relative w-full sm:max-w-md flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: C.card, height: "min(560px, 85vh)", boxShadow: "0 16px 48px rgba(28,37,65,0.25)" }}
      >
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>
              Bạn bè
            </span>
            <button onClick={onClose} className="p-1 rounded-full hover:opacity-70" style={{ color: C.mute }}>
              <X size={18} />
            </button>
          </div>

          <div className="flex gap-1 mt-3 overflow-x-auto">
            {TABS.map((t) => {
              const n = countOf(t.key);
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ ...font, background: active ? C.ink : "transparent", color: active ? C.paper : C.ink2 }}
                >
                  {t.label}
                  {!loading && n > 0 && (
                    <span
                      className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center"
                      style={
                        t.key === "incoming"
                          ? { background: C.coral, color: "#fff" }
                          : { background: active ? "rgba(255,255,255,0.2)" : C.paper, color: active ? C.paper : C.ink2 }
                      }
                    >
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {inTab.length > 5 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
              <Search size={14} style={{ color: C.mute }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm trong danh sách..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ ...font, color: C.ink }}
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin" color={C.mute} size={22} />
            </div>
          ) : error ? (
            <div className="px-4 py-10 text-center text-sm" style={{ ...font, color: C.coral }}>{error}</div>
          ) : shown.length ? (
            shown.map((p) => (
              <div key={p._id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
                <button onClick={() => open(p)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <Avatar
                    label={p.name}
                    size={42}
                    color={p.avatarColor && p.avatarColor !== C.ink ? p.avatarColor : C.mustard}
                    src={p.avatarUrl}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate hover:underline" style={{ ...font, color: C.ink }}>{p.name}</div>
                    <div className="text-xs truncate" style={{ ...mono, color: C.mute }}>@{p.handle}</div>
                  </div>
                </button>
                <FriendButton small userId={p._id} name={p.name} status={p.friendStatus} onChange={(s) => setStatus(p._id, s)} />
              </div>
            ))
          ) : (
            <div className="px-6 py-12 flex flex-col items-center gap-2 text-center" style={{ ...font, color: C.mute }}>
              <Users size={28} />
              <span className="text-sm">{q ? `Không có ai khớp "${query}".` : TABS.find((t) => t.key === tab).empty}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
