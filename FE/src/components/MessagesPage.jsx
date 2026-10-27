import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Send, Search, ArrowLeft, Loader2, MessageCircle, RotateCw } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import Avatar from "./Avatar";
import EmptyState from "./EmptyState";
import { MediaTools, MediaPreview, MediaView, useMediaAttachment, mediaPayload, insertAtCursor } from "./MediaPicker";

const LIST_POLL_MS = 5000;
const CHAT_POLL_MS = 3000;
const GROUP_GAP_MS = 5 * 60 * 1000; // tin cùng người gửi cách nhau < 5 phút thì gộp nhóm

const font = { fontFamily: "'Inter', sans-serif" };

function formatTime(date) {
  return new Date(date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hôm nay";
  if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return d.toLocaleDateString("vi-VN");
}

function formatListTime(date) {
  const d = new Date(date);
  return d.toDateString() === new Date().toDateString() ? formatTime(d) : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

// Chỉ chạy callback khi tab đang được xem, đỡ tốn request khi người dùng chuyển tab
function usePolling(callback, ms, enabled = true) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") saved.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}

export default function MessagesPage({ currentUser, initialPerson, onUnreadChange }) {
  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [resolveError, setResolveError] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const attachment = useMediaAttachment(setSendError);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);
  const prevScrollHeight = useRef(null);

  // ---------- Danh sách hội thoại ----------

  const loadConversations = () =>
    api
      .getConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setListLoading(false));

  useEffect(() => {
    loadConversations();
  }, []);
  usePolling(loadConversations, LIST_POLL_MS);

  // Mở chat từ trang cá nhân: người trong data mẫu chưa có _id nên tra theo handle
  useEffect(() => {
    if (!initialPerson) return;
    setResolveError("");
    if (initialPerson._id) {
      setSelected(initialPerson);
      return;
    }
    api
      .getUserByHandle(initialPerson.handle)
      .then(setSelected)
      .catch((err) => setResolveError(err.message));
  }, [initialPerson]);

  // Tìm người để nhắn tin mới (debounce 300ms)
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api
        .searchUsers(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const openChat = (user) => {
    setSelected(user);
    setQuery("");
    setResolveError("");
  };

  // ---------- Khung chat ----------

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setMessages([]);
    setHasMore(false);
    setChatLoading(true);
    setSendError("");
    attachment.clear(); // ảnh đang chọn thuộc cuộc trò chuyện trước
    stickToBottom.current = true;
    api
      .getMessages(selected._id)
      .then(({ messages, hasMore }) => {
        if (cancelled) return;
        setMessages(messages);
        setHasMore(hasMore);
        // Server vừa đánh dấu đã đọc → cập nhật badge và danh sách
        setConversations((cs) => cs.map((c) => (c.user._id === selected._id ? { ...c, unread: 0 } : c)));
        onUnreadChange?.();
      })
      .catch(() => {})
      .finally(() => !cancelled && setChatLoading(false));
    inputRef.current?.focus();
    return () => {
      cancelled = true;
    };
  }, [selected?._id]);

  const lastServerTime = () => {
    for (let i = messages.length - 1; i >= 0; i--) if (!messages[i].pending && !messages[i].failed) return messages[i].createdAt;
    return null;
  };

  usePolling(
    async () => {
      const after = lastServerTime();
      if (!after) return;
      try {
        const { messages: fresh } = await api.getMessages(selected._id, { after });
        if (!fresh.length) return;
        setMessages((ms) => {
          const known = new Set(ms.map((m) => m._id));
          return [...ms, ...fresh.filter((m) => !known.has(m._id))];
        });
        onUnreadChange?.();
      } catch {
        // bỏ qua, lần poll sau thử lại
      }
    },
    CHAT_POLL_MS,
    !!selected && !chatLoading
  );

  const loadOlder = async () => {
    if (!hasMore || loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    prevScrollHeight.current = scrollRef.current.scrollHeight;
    try {
      const { messages: older, hasMore: more } = await api.getMessages(selected._id, { before: messages[0].createdAt });
      setMessages((ms) => [...older, ...ms]);
      setHasMore(more);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Giữ vị trí cuộn khi chèn tin cũ lên trên, tự cuộn xuống khi có tin mới nếu đang ở đáy
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevScrollHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevScrollHeight.current;
      prevScrollHeight.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60) loadOlder();
  };

  const deliver = async (tempId, content, media) => {
    try {
      const saved = await api.sendMessage(selected._id, content, mediaPayload(media));
      // Polling có thể đã kéo tin này về trước khi request gửi trả lời → bỏ bản tạm cho khỏi trùng
      setMessages((ms) =>
        ms.some((m) => m._id === saved._id) ? ms.filter((m) => m._id !== tempId) : ms.map((m) => (m._id === tempId ? saved : m))
      );
      setConversations((cs) => {
        const rest = cs.filter((c) => c.user._id !== selected._id);
        return [{ user: selected, lastMessage: content || (media.kind === "gif" ? "[GIF]" : "[Ảnh]"), lastFromMe: true, lastAt: saved.createdAt, unread: 0 }, ...rest];
      });
    } catch {
      setMessages((ms) => ms.map((m) => (m._id === tempId ? { ...m, pending: false, failed: true } : m)));
    }
  };

  const canSend = (draft.trim() || attachment.media) && !attachment.uploading;

  const send = () => {
    const content = draft.trim();
    const media = attachment.media;
    if (!canSend || !selected) return;
    const tempId = `temp-${Date.now()}`;
    stickToBottom.current = true;
    setMessages((ms) => [
      ...ms,
      { _id: tempId, senderId: currentUser.id, content, media, createdAt: new Date().toISOString(), pending: true },
    ]);
    setDraft("");
    setSendError("");
    attachment.clear();
    deliver(tempId, content, media);
  };

  const retry = (m) => {
    setMessages((ms) => ms.map((x) => (x._id === m._id ? { ...x, pending: true, failed: false } : x)));
    deliver(m._id, m.content, m.media);
  };

  // Textarea tự giãn theo nội dung, tối đa ~5 dòng
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  // ---------- Render ----------

  const listItems = query.trim()
    ? results.map((u) => ({ user: u }))
    : conversations;

  return (
    <div
      className="rounded-2xl overflow-hidden flex"
      style={{ background: C.card, border: `1px solid ${C.line}`, height: "max(480px, calc(100vh - 130px))" }}
    >
      {/* Danh sách hội thoại — trên mobile ẩn khi đang mở chat */}
      <div
        className={`${selected ? "hidden sm:flex" : "flex"} w-full sm:w-72 lg:w-80 shrink-0 flex-col`}
        style={{ borderRight: `1px solid ${C.line}` }}
      >
        <div className="px-4 pt-3 pb-3 space-y-2" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-base font-semibold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>
            Tin nhắn
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
            <Search size={14} style={{ color: C.mute }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm người để nhắn tin..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ ...font, color: C.ink }}
            />
            {searching && <Loader2 size={14} className="animate-spin" color={C.mute} />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listLoading && !query ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin" color={C.mute} size={20} />
            </div>
          ) : listItems.length ? (
            listItems.map(({ user, lastMessage, lastFromMe, lastAt, unread }) => {
              const isActive = selected?._id === user._id;
              return (
                <button
                  key={user._id}
                  onClick={() => openChat(user)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:brightness-95"
                  style={{ background: isActive ? "#FBF3E2" : C.card }}
                >
                  <Avatar label={user.name} size={42} color={user.avatarColor || C.mustard} src={user.avatarUrl} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`text-sm truncate ${unread ? "font-bold" : "font-semibold"}`} style={{ ...font, color: C.ink }}>
                        {user.name}
                      </span>
                      {lastAt && (
                        <span className="text-[11px] shrink-0" style={{ color: unread ? C.coral : C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {formatListTime(lastAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs truncate flex-1 ${unread ? "font-semibold" : ""}`} style={{ ...font, color: unread ? C.ink2 : C.mute }}>
                        {lastMessage !== undefined ? `${lastFromMe ? "Bạn: " : ""}${lastMessage}` : `@${user.handle}`}
                      </span>
                      {unread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center" style={{ background: C.coral, color: "#fff" }}>
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm" style={{ ...font, color: C.mute }}>
              {query.trim()
                ? searching ? "Đang tìm..." : "Không tìm thấy người dùng nào."
                : "Chưa có cuộc trò chuyện nào. Tìm một người ở ô phía trên để bắt đầu."}
            </div>
          )}
        </div>
      </div>

      {/* Khung chat */}
      <div className={`${selected ? "flex" : "hidden sm:flex"} flex-1 flex-col min-w-0`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              icon={MessageCircle}
              title={resolveError ? "Không mở được cuộc trò chuyện" : "Chọn một cuộc trò chuyện"}
              body={resolveError || "Chọn một người ở danh sách bên trái hoặc tìm người mới để bắt đầu nhắn tin."}
            />
          </div>
        ) : (
          <>
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${C.line}` }}>
              <button onClick={() => setSelected(null)} className="sm:hidden p-1 -ml-1 hover:opacity-70" style={{ color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <Avatar label={selected.name} size={36} color={selected.avatarColor || C.mustard} src={selected.avatarUrl} />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ ...font, color: C.ink }}>
                  {selected.name}
                </div>
                <div className="text-xs truncate" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
                  @{selected.handle}
                </div>
              </div>
            </div>

            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-3">
              {chatLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin" color={C.mute} size={20} />
                </div>
              ) : messages.length ? (
                <>
                  {loadingOlder && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="animate-spin" color={C.mute} size={16} />
                    </div>
                  )}
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const next = messages[i + 1];
                    const mine = m.senderId === currentUser.id;
                    const newDay = !prev || formatDay(prev.createdAt) !== formatDay(m.createdAt);
                    const sameAsPrev = prev && !newDay && prev.senderId === m.senderId && new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_GAP_MS;
                    const lastInGroup =
                      !next || next.senderId !== m.senderId || new Date(next.createdAt) - new Date(m.createdAt) >= GROUP_GAP_MS || formatDay(next.createdAt) !== formatDay(m.createdAt);

                    return (
                      <React.Fragment key={m._id}>
                        {newDay && (
                          <div className="text-center text-[11px] my-3" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
                            {formatDay(m.createdAt)}
                          </div>
                        )}
                        <div className={`flex ${mine ? "justify-end" : "justify-start"} ${sameAsPrev ? "mt-0.5" : "mt-3"}`}>
                          <div className={`max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                            {m.media && (
                              <div className={m.content ? "mb-0.5" : ""} style={{ opacity: m.pending ? 0.6 : 1, outline: m.failed && !m.content ? `1px solid ${C.coral}` : "none", borderRadius: 12 }}>
                                <MediaView media={m.media} maxWidth={300} maxHeight={320} />
                              </div>
                            )}
                            {m.content && (
                              <div
                                className="px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                                style={{
                                  ...font,
                                  ...(mine ? { background: C.ink, color: C.paper } : { background: C.paper, color: C.ink2 }),
                                  opacity: m.pending ? 0.6 : 1,
                                  outline: m.failed ? `1px solid ${C.coral}` : "none",
                                }}
                              >
                                {m.content}
                              </div>
                            )}
                            {m.failed ? (
                              <button onClick={() => retry(m)} className="flex items-center gap-1 text-[11px] mt-0.5 hover:opacity-70" style={{ ...font, color: C.coral }}>
                                <RotateCw size={11} /> Gửi lỗi · Thử lại
                              </button>
                            ) : (
                              lastInGroup && (
                                <span className="text-[10.5px] mt-0.5 px-1" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
                                  {m.pending ? "Đang gửi..." : formatTime(m.createdAt)}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </>
              ) : (
                <div className="text-center text-xs mt-6" style={{ ...font, color: C.mute }}>
                  Hãy gửi lời chào đầu tiên tới {selected.name}!
                </div>
              )}
            </div>

            {(attachment.media || sendError) && (
              <div className="px-4 pt-3 flex items-end gap-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <MediaPreview media={attachment.media} onRemove={attachment.clear} />
                {sendError && <span className="text-xs pb-1" style={{ ...font, color: C.coral }}>{sendError}</span>}
              </div>
            )}
            <div className="px-3 py-3 flex items-end gap-1.5" style={{ borderTop: attachment.media || sendError ? "none" : `1px solid ${C.line}` }}>
              <div className="pb-0.5">
                <MediaTools attachment={attachment} onEmoji={(emoji) => insertAtCursor(inputRef.current, emoji, draft, setDraft)} />
              </div>
              <textarea
                ref={inputRef}
                value={draft}
                rows={1}
                maxLength={2000}
                onChange={(e) => setDraft(e.target.value)}
                onPaste={attachment.onPaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Nhập tin nhắn..."
                title="Enter để gửi · Shift+Enter để xuống dòng · Ctrl+V để dán ảnh"
                className="flex-1 min-w-0 px-4 py-2 rounded-2xl text-sm outline-none resize-none"
                style={{ ...font, background: C.paper, color: C.ink }}
              />
              <button
                onClick={send}
                disabled={!canSend}
                className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center disabled:opacity-40"
                style={{ background: C.ink, color: C.paper }}
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
