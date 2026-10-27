import React, { useState } from "react";
import { Heart, MessageSquare, UserPlus, UserCheck, Bell, CheckCheck, CheckCircle2, Radio } from "lucide-react";
import { C } from "../constants";

const TYPE_STYLE = {
  like: { icon: Heart, color: C.coral },
  comment: { icon: MessageSquare, color: C.green },
  follow: { icon: UserPlus, color: C.mustard },
  friend_request: { icon: UserPlus, color: C.green },
  friend_accept: { icon: UserCheck, color: C.green },
  answer_accepted: { icon: CheckCircle2, color: C.green },
  live: { icon: Radio, color: C.coral },
};

export default function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead, onOpenLive }) {
  const [tab, setTab] = useState("all");
  const unreadCount = notifications.filter((n) => !n.read).length;
  const shown = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-12 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden z-40" style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 8px 24px rgba(28,37,65,0.12)" }}>
        <div className="px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>
              Thông báo
            </span>
            <button
              onClick={onMarkAllRead}
              disabled={!unreadCount}
              className="flex items-center gap-1 text-xs font-medium hover:opacity-70 disabled:opacity-40 disabled:cursor-default"
              style={{ color: C.green, fontFamily: "'Inter', sans-serif" }}
            >
              <CheckCheck size={14} />
              Đánh dấu tất cả đã đọc
            </button>
          </div>
          <div className="flex gap-1 mt-2">
            {[
              { key: "all", label: "Tất cả" },
              { key: "unread", label: `Chưa đọc${unreadCount ? ` (${unreadCount})` : ""}` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  background: tab === t.key ? C.ink : "transparent",
                  color: tab === t.key ? C.paper : C.ink2,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {shown.length ? (
            shown.map((n) => {
              const { icon: Icon, color } = TYPE_STYLE[n.type] || { icon: Bell, color: C.ink2 };
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) onMarkRead(n.id);
                    if (n.type === "live" && n.liveId) onOpenLive?.(n.liveId);
                  }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:brightness-95"
                  style={{ borderBottom: `1px solid ${C.line}`, background: n.read ? C.card : "#FBF3E2" }}
                >
                  <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}1f` }}>
                    <Icon size={16} color={color} fill={n.type === "like" ? color : "none"} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-snug" style={{ color: C.ink2, fontFamily: "'Inter', sans-serif" }}>
                      {n.actor && <span className="font-semibold" style={{ color: C.ink }}>{n.actor} </span>}
                      {n.text}
                    </div>
                    <div className="text-xs mt-1" style={{ color: n.read ? C.mute : C.coral, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {n.time}
                    </div>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: C.coral }} />}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-10 flex flex-col items-center gap-2 text-center" style={{ color: C.mute, fontFamily: "'Inter', sans-serif" }}>
              <Bell size={28} />
              <span className="text-sm">
                {tab === "unread" ? "Bạn đã đọc hết thông báo." : "Chưa có thông báo nào."}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
