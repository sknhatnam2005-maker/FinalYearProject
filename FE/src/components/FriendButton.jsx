import React, { useState } from "react";
import { UserPlus, UserCheck, Clock, Loader2, Check, X } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";

const outline = { background: "transparent", color: C.ink, border: `1px solid ${C.ink}` };
const solid = { background: C.ink, color: C.paper, border: `1px solid ${C.ink}` };

// status: "none" | "outgoing" | "incoming" | "friends" | "self"
export default function FriendButton({ userId, name, status, onChange, small = false }) {
  const [busy, setBusy] = useState(false);

  const run = async (call, confirmText) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    try {
      const { friendStatus } = await call();
      onChange(friendStatus);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (status === "self") return null;

  const cls = `flex items-center gap-1.5 font-semibold rounded-full shrink-0 transition-opacity hover:opacity-80 disabled:opacity-50 ${
    small ? "text-xs px-3 py-1" : "text-sm px-4 py-1.5"
  }`;
  const iconSize = small ? 13 : 15;
  const spinner = <Loader2 size={iconSize} className="animate-spin" />;

  if (status === "incoming") {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button disabled={busy} onClick={() => run(() => api.acceptFriendRequest(userId))} className={cls} style={solid}>
          {busy ? spinner : <Check size={iconSize} />} Chấp nhận
        </button>
        <button
          disabled={busy}
          title="Từ chối"
          onClick={() => run(() => api.removeFriend(userId))}
          className={`${cls} ${small ? "!px-2" : "!px-2.5"}`}
          style={outline}
        >
          <X size={iconSize} />
        </button>
      </div>
    );
  }

  if (status === "friends") {
    return (
      <button
        disabled={busy}
        onClick={() => run(() => api.removeFriend(userId), `Huỷ kết bạn với ${name}?`)}
        className={cls}
        style={outline}
        title="Bấm để huỷ kết bạn"
      >
        {busy ? spinner : <UserCheck size={iconSize} />} Bạn bè
      </button>
    );
  }

  if (status === "outgoing") {
    return (
      <button
        disabled={busy}
        onClick={() => run(() => api.removeFriend(userId), "Huỷ lời mời kết bạn?")}
        className={cls}
        style={{ ...outline, color: C.mute, borderColor: C.line }}
        title="Bấm để huỷ lời mời"
      >
        {busy ? spinner : <Clock size={iconSize} />} Đã gửi lời mời
      </button>
    );
  }

  return (
    <button disabled={busy} onClick={() => run(() => api.sendFriendRequest(userId))} className={cls} style={solid}>
      {busy ? spinner : <UserPlus size={iconSize} />} Kết bạn
    </button>
  );
}
