import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { C } from "../constants";
import { api, timeAgo } from "../api";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import { MediaTools, MediaPreview, MediaView, useMediaAttachment, mediaPayload, insertAtCursor } from "./MediaPicker";

export default function CommentSection({
  postId,
  postOwnerId,
  currentUser,
  onCountChange,
  isQuestion = false,
  acceptedId = null,
  onAccept = null, // chỉ truyền khi người xem là người hỏi
  onAcceptedRemoved,
}) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getComments(postId)
      .then(setComments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [postId]);

  const inputRef = useRef(null);
  const attachment = useMediaAttachment(setError);
  const canSend = (draft.trim() || attachment.media) && !attachment.uploading && !sending;

  const submit = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!canSend) return;
    setSending(true);
    setError("");
    try {
      const comment = await api.addComment(postId, content, mediaPayload(attachment.media));
      setComments((cs) => [...cs, comment]);
      setDraft("");
      attachment.clear();
      onCountChange(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (c) => {
    setEditingId(c._id);
    setEditDraft(c.content);
    setError("");
  };

  const saveEdit = async () => {
    const content = editDraft.trim();
    const hasMedia = comments.find((c) => c._id === editingId)?.media;
    if ((!content && !hasMedia) || savingEdit) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateComment(editingId, content);
      setComments((cs) => cs.map((c) => (c._id === updated._id ? updated : c)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async (id) => {
    if (!confirm(isQuestion ? "Xóa câu trả lời này?" : "Xóa bình luận này?")) return;
    try {
      await api.deleteComment(id);
      setComments((cs) => cs.filter((c) => c._id !== id));
      onCountChange(-1);
      if (id === acceptedId) onAcceptedRemoved?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const [accepting, setAccepting] = useState(false);

  const accept = async (id) => {
    setAccepting(true);
    setError("");
    try {
      await onAccept(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  // Câu trả lời hay nhất luôn được ghim lên đầu, phần còn lại giữ thứ tự thời gian
  const sorted = isQuestion && acceptedId
    ? [...comments.filter((c) => c._id === acceptedId), ...comments.filter((c) => c._id !== acceptedId)]
    : comments;

  return (
    <div className="mt-3 pt-3 space-y-3" style={{ borderTop: `1px dashed ${C.line}` }}>
      {onAccept && !acceptedId && comments.length > 0 && (
        <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5" style={{ background: `${C.green}14`, color: C.greenDeep, fontFamily: "'Inter', sans-serif" }}>
          <CheckCircle2 size={14} /> Câu trả lời nào giúp được bạn? Bấm dấu ✓ bên cạnh để chọn câu trả lời hay nhất.
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="animate-spin" color={C.mute} size={18} />
        </div>
      ) : (
        sorted.map((c) => {
          const author = c.authorId || {};
          const isAuthor = author._id === currentUser.id;
          const canDelete = isAuthor || postOwnerId === currentUser.id;
          const isEditing = editingId === c._id;
          const isAccepted = isQuestion && c._id === acceptedId;
          return (
            <div key={c._id} className="flex items-start gap-2 group">
              {isQuestion && (
                <div className="w-6 shrink-0 flex justify-center pt-1">
                  {onAccept ? (
                    <button
                      onClick={() => accept(c._id)}
                      disabled={accepting}
                      title={isAccepted ? "Bỏ chọn câu trả lời hay nhất" : "Chọn là câu trả lời hay nhất"}
                      className={`hover:scale-110 transition-transform ${isAccepted ? "" : "opacity-40 hover:opacity-100"}`}
                    >
                      <CheckCircle2 size={22} color={isAccepted ? "#fff" : C.green} fill={isAccepted ? C.green : "none"} />
                    </button>
                  ) : (
                    isAccepted && <CheckCircle2 size={22} color="#fff" fill={C.green} />
                  )}
                </div>
              )}
              <Avatar label={author.name || "?"} size={30} color={author.avatarColor || C.mute} src={author.avatarUrl} />
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      maxLength={1000}
                      rows={2}
                      autoFocus
                      className="w-full resize-none outline-none text-sm rounded-xl px-3 py-2"
                      style={{ background: C.paper, border: `1px solid ${C.line}`, color: C.ink, fontFamily: "'Inter', sans-serif" }}
                    />
                    <div className="flex items-center gap-3 text-[11px] ml-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      <button onClick={saveEdit} disabled={(!editDraft.trim() && !c.media) || savingEdit} className="font-semibold hover:opacity-70 disabled:opacity-40" style={{ color: C.green }}>
                        {savingEdit ? "Đang lưu..." : "Lưu"}
                      </button>
                      <button onClick={() => setEditingId(null)} className="hover:opacity-70" style={{ color: C.mute }}>
                        Huỷ
                      </button>
                      <span style={{ color: C.mute }}>Enter để lưu · Esc để huỷ</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="inline-block max-w-full rounded-2xl px-3 py-2"
                    style={isAccepted ? { background: `${C.green}14`, border: `1.5px solid ${C.green}` } : { background: C.paper }}
                  >
                    {isAccepted && (
                      <div className="text-[11px] font-semibold mb-0.5" style={{ color: C.green, fontFamily: "'Inter', sans-serif" }}>
                        ✓ Câu trả lời hay nhất
                      </div>
                    )}
                    <div className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: C.ink, fontFamily: "'Inter', sans-serif" }}>
                      {author.name || "Người dùng"} <RoleBadge role={author.role} />
                    </div>
                    {c.content && (
                      <div className="text-sm whitespace-pre-line break-words" style={{ color: C.ink2, fontFamily: "'Inter', sans-serif" }}>
                        {c.content}
                      </div>
                    )}
                    {c.media && (
                      <div className="mt-1.5 mb-0.5">
                        <MediaView media={c.media} />
                      </div>
                    )}
                  </div>
                )}
                {!isEditing && (
                <div className="flex items-center gap-3 mt-0.5 ml-3 text-[11px]" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {timeAgo(c.createdAt)}
                  {c.edited && <span>· đã chỉnh sửa</span>}
                  {isAuthor && (
                    <button onClick={() => startEdit(c)} className="flex items-center gap-1 hover:opacity-70 sm:opacity-0 sm:group-hover:opacity-100" style={{ color: C.ink2 }}>
                      <Pencil size={11} /> Sửa
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => remove(c._id)} className="flex items-center gap-1 hover:opacity-70 sm:opacity-0 sm:group-hover:opacity-100" style={{ color: C.coral }}>
                      <Trash2 size={11} /> Xóa
                    </button>
                  )}
                </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {error && <div className="text-xs" style={{ color: C.coral, fontFamily: "'Inter', sans-serif" }}>{error}</div>}

      <form onSubmit={submit} className="flex items-start gap-2">
        <Avatar label={currentUser.name} size={30} color={C.ink} src={currentUser.avatarUrl} />
        <div className="flex-1 min-w-0">
        {attachment.media && (
          <div className="mb-1.5 ml-2">
            <MediaPreview media={attachment.media} onRemove={attachment.clear} />
          </div>
        )}
        <div className="flex items-center rounded-full pl-4 pr-1 py-1" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={attachment.onPaste}
            maxLength={1000}
            autoFocus
            placeholder={isQuestion ? "Viết câu trả lời của bạn..." : "Viết bình luận..."}
            className="flex-1 min-w-0 bg-transparent outline-none text-sm"
            style={{ color: C.ink, fontFamily: "'Inter', sans-serif" }}
          />
          <MediaTools
            attachment={attachment}
            align="right"
            size={30}
            onEmoji={(emoji) => insertAtCursor(inputRef.current, emoji, draft, setDraft)}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40"
            style={{ background: C.ink, color: C.paper }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        </div>
      </form>
    </div>
  );
}
