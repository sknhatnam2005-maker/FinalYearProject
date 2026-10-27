import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import FriendButton from "./FriendButton";

const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const font = { fontFamily: "'Inter', sans-serif" };

// Người dùng ẩn gợi ý nào thì nhớ trong trình duyệt, tách riêng theo từng tài khoản
const dismissedKey = (userId) => `gochoc_dismissed_suggestions_${userId}`;

function loadDismissed(userId) {
  try {
    return JSON.parse(localStorage.getItem(dismissedKey(userId))) || [];
  } catch {
    return [];
  }
}

function saveDismissed(userId, ids) {
  try {
    localStorage.setItem(dismissedKey(userId), JSON.stringify(ids.slice(-100)));
  } catch {
    // trình duyệt chặn localStorage thì chỉ ẩn trong phiên hiện tại
  }
}

function avatarColorOf(user) {
  return user.avatarColor && user.avatarColor !== C.ink ? user.avatarColor : C.mustard;
}

function PersonRow({ user, onViewPerson, onStatusChange, onDismiss }) {
  return (
    <div className="group flex items-center gap-3">
      <button onClick={() => onViewPerson(user)} className="shrink-0">
        <Avatar label={user.name} size={38} color={avatarColorOf(user)} src={user.avatarUrl} />
      </button>
      <button onClick={() => onViewPerson(user)} className="flex-1 min-w-0 text-left">
        <div className="text-[13.5px] font-semibold truncate hover:underline" style={{ ...font, color: C.ink }}>
          {user.name}
        </div>
        <div className="text-[11.5px] truncate" style={{ ...mono, color: C.mute }}>
          @{user.handle}
        </div>
        {user.reason && (
          <div className="text-[11px] truncate" style={{ ...font, color: C.green }}>
            {user.reason}
          </div>
        )}
      </button>
      <FriendButton small userId={user._id} name={user.name} status={user.friendStatus} onChange={(s) => onStatusChange(user._id, s)} />
      {onDismiss && user.friendStatus === "none" && (
        <button
          onClick={() => onDismiss(user._id)}
          title="Ẩn gợi ý này"
          className="shrink-0 -ml-1 p-1 rounded-full hover:opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
          style={{ color: C.mute }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default function RightSidebar({ currentUserId, onViewPerson }) {
  const [requests, setRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(() => loadDismissed(currentUserId));

  useEffect(() => {
    api.getFriendRequests().then(setRequests).catch(() => {});
  }, [currentUserId]);

  useEffect(() => {
    api
      .getFriendSuggestions(dismissed)
      .then(setSuggestions)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [currentUserId, dismissed]);

  const updateIn = (setter) => (id, friendStatus) =>
    setter((list) => list.map((u) => (u._id === id ? { ...u, friendStatus } : u)));

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setSuggestions((list) => list.filter((u) => u._id !== id));
    setDismissed(next);
    saveDismissed(currentUserId, next);
  };

  const pendingCount = requests.filter((u) => u.friendStatus === "incoming").length;

  return (
    <div className="space-y-5">
      {requests.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <SectionLabel>Lời mời kết bạn{pendingCount ? ` (${pendingCount})` : ""}</SectionLabel>
          <div className="space-y-3">
            {requests.map((u) => (
              <PersonRow key={u._id} user={u} onViewPerson={onViewPerson} onStatusChange={updateIn(setRequests)} />
            ))}
          </div>
        </div>
      )}

      {loaded && (
        <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <SectionLabel>Gợi ý kết bạn</SectionLabel>
          {suggestions.length ? (
            <div className="space-y-3.5">
              {suggestions.map((u) => (
                <PersonRow
                  key={u._id}
                  user={u}
                  onViewPerson={onViewPerson}
                  onStatusChange={updateIn(setSuggestions)}
                  onDismiss={dismiss}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs leading-relaxed" style={{ ...font, color: C.mute }}>
              Chưa có gợi ý mới. Tìm bạn bè bằng ô tìm kiếm phía trên, gõ <span style={{ ...mono, color: C.ink2 }}>@username</span>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
