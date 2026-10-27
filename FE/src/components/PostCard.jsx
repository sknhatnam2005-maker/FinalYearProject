import React, { useState } from "react";
import { Heart, MessageSquare, Share2, MoreHorizontal, Pencil, Trash2, Check, X, Link2, Send, HelpCircle, CheckCircle2 } from "lucide-react";
import { C } from "../constants";
import { subjectColor } from "../data";
import { api, timeAgo } from "../api";
import Avatar from "./Avatar";
import SubjectTag from "./SubjectTag";
import CommentSection from "./CommentSection";
import Attachments from "./Attachments";
import { VisibilityIcon, VisibilityOptions } from "./VisibilityPicker";
import RoleBadge from "./RoleBadge";

export function postLink(postId) {
  return `${window.location.origin}${window.location.pathname}?post=${postId}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Trình duyệt không cho dùng Clipboard API (vd. không phải HTTPS) thì dùng cách cũ
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

export default function PostCard({ post, currentUser, onToggleLike, onOpenTopic, onUpdatePost, onDeletePost, onOpenAuthor, onAcceptedChange, defaultShowComments = false }) {
  const s = { color: subjectColor(post.subject) };
  const author = post.authorId || {};
  const isOwner = currentUser && (author._id === currentUser.id || author.id === currentUser.id);
  const canOpenAuthor = !!onOpenAuthor && !!author._id && !isOwner;
  const isQuestion = post.type === "question";
  const [acceptedId, setAcceptedId] = useState(post.acceptedCommentId || null);

  const acceptAnswer = async (commentId) => {
    const { acceptedCommentId } = await api.acceptAnswer(post._id, commentId);
    setAcceptedId(acceptedCommentId);
    onAcceptedChange?.(post._id, acceptedCommentId);
  };
  const openAuthor = () => canOpenAuthor && onOpenAuthor(author);

  const [menuOpen, setMenuOpen] = useState(false);
  const [visibility, setVisibility] = useState(post.visibility || "public");

  const changeVisibility = async (next) => {
    setMenuOpen(false);
    if (next === visibility) return;
    const prev = visibility;
    setVisibility(next);
    try {
      await api.updatePost(post._id, { visibility: next });
    } catch (err) {
      setVisibility(prev);
      alert(err.message);
    }
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    await copyText(postLink(post._id));
    setShareOpen(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    setShareOpen(false);
    try {
      await navigator.share({
        title: `Bài viết của ${author.name || "Góc Học"}`,
        text: post.content.slice(0, 100),
        url: postLink(post._id),
      });
    } catch {
      // Người dùng huỷ chia sẻ
    }
  };

  const startEdit = () => {
    setDraft(post.content);
    setEditing(true);
    setMenuOpen(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(post.content);
  };

  const saveEdit = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onUpdatePost(post._id, draft.trim());
      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setMenuOpen(false);
    if (confirm("Bạn có chắc muốn xóa bài viết này không?")) {
      onDeletePost(post._id);
    }
  };

  return (
    <article
      className="relative rounded-2xl mb-4"
      style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 1px 0 rgba(28,37,65,0.03)" }}
    >
      {/* Lớp trang trí được bo theo góc thẻ; thẻ ngoài không overflow-hidden để menu "..." không bị cắt */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: s.color }} />
        <div
          className="absolute left-0 right-0 top-0 h-2"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, ${C.line} 0 6px, transparent 6px 12px)`,
            backgroundSize: "12px 1px",
            backgroundRepeat: "repeat-x",
            opacity: 0.7,
          }}
        />
      </div>
      <div className="relative px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <button onClick={openAuthor} className="shrink-0" disabled={!canOpenAuthor}>
            <Avatar label={author.name || "?"} color={author.avatarColor || s.color} src={author.avatarUrl} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={openAuthor}
                disabled={!canOpenAuthor}
                style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 600 }}
                className={`text-[15px] ${canOpenAuthor ? "hover:underline" : "cursor-default"}`}
              >
                {author.name || "Người dùng"}
              </button>
              <RoleBadge role={author.role} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.mute }} className="text-xs">
                @{author.handle || "..."} · {timeAgo(post.createdAt)} · <VisibilityIcon value={visibility} />
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <button onClick={() => onOpenTopic(post.subject)}>
                <SubjectTag name={post.subject} />
              </button>
              {post.subjectMismatch && (
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  title="Hệ thống thấy nội dung có vẻ không khớp môn này, người đăng vẫn chọn giữ nguyên"
                  style={{ background: `${C.mustard}24`, color: "#B97A1C", fontFamily: "'Inter', sans-serif" }}
                >
                  ⚠ Có thể sai môn
                </span>
              )}
              {isQuestion && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={
                    acceptedId
                      ? { background: `${C.green}1f`, color: C.green, fontFamily: "'Inter', sans-serif" }
                      : { background: `${C.mustard}24`, color: "#B97A1C", fontFamily: "'Inter', sans-serif" }
                  }
                >
                  {acceptedId ? <><CheckCircle2 size={12} /> Đã giải quyết</> : <><HelpCircle size={12} /> Câu hỏi · chưa giải quyết</>}
                </span>
              )}
            </div>
          </div>

          {isOwner && (
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} style={{ color: C.mute }} className="p-1 hover:opacity-70">
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div
                    className="absolute right-0 top-8 w-60 rounded-xl overflow-hidden z-20 py-1"
                    style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 8px 24px rgba(28,37,65,0.12)" }}
                  >
                    <div className="px-3 pt-1.5 pb-0.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
                      Ai có thể xem
                    </div>
                    <VisibilityOptions value={visibility} onPick={changeVisibility} />
                    <div className="my-1" style={{ borderTop: `1px solid ${C.line}` }} />
                    <button
                      onClick={startEdit}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:opacity-70"
                      style={{ color: C.ink2, fontFamily: "'Inter', sans-serif" }}
                    >
                      <Pencil size={14} /> Chỉnh sửa
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:opacity-70"
                      style={{ color: C.coral, fontFamily: "'Inter', sans-serif" }}
                    >
                      <Trash2 size={14} /> Xóa
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className="w-full resize-none outline-none text-[15px] rounded-xl px-3 py-2"
              style={{ border: `1px solid ${C.line}`, fontFamily: "'Inter', sans-serif", color: C.ink }}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={saveEdit}
                disabled={saving || !draft.trim()}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-40"
                style={{ background: C.ink, color: C.paper, fontFamily: "'Inter', sans-serif" }}
              >
                <Check size={13} /> {saving ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ border: `1px solid ${C.line}`, color: C.mute, fontFamily: "'Inter', sans-serif" }}
              >
                <X size={13} /> Hủy
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", color: C.ink2 }}>
            {post.content}
          </p>
        )}

        <Attachments items={post.attachments} semester={post.semester} lecturer={post.lecturer} />

        <div className="mt-3 flex flex-wrap gap-2">
          {(post.tags || []).map((t) => (
            <span key={t} className="text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.green }}>
              {t}
            </span>
          ))}
        </div>

        <div className="mt-4 pt-3 flex items-center gap-5" style={{ borderTop: `1px dashed ${C.line}` }}>
          <button
            onClick={() => onToggleLike(post._id)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: post.liked ? C.coral : C.mute, fontFamily: "'Inter', sans-serif" }}
          >
            <Heart size={17} fill={post.liked ? C.coral : "none"} />
            {post.likeCount ?? 0}
          </button>
          <button
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-1.5 text-sm hover:opacity-70"
            style={{ color: showComments ? C.green : C.mute, fontFamily: "'Inter', sans-serif" }}
          >
            <MessageSquare size={17} fill={showComments ? `${C.green}33` : "none"} />
            {isQuestion ? `${commentCount} câu trả lời` : commentCount}
          </button>
          <div className="relative">
            <button
              onClick={() => setShareOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm hover:opacity-70"
              style={{ color: copied ? C.green : C.mute, fontFamily: "'Inter', sans-serif" }}
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              {copied ? "Đã sao chép liên kết" : "Chia sẻ"}
            </button>
            {shareOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShareOpen(false)} />
                <div
                  className="absolute left-0 bottom-8 w-52 rounded-xl overflow-hidden z-20 py-1"
                  style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 8px 24px rgba(28,37,65,0.12)" }}
                >
                  <button
                    onClick={copyLink}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:opacity-70"
                    style={{ color: C.ink2, fontFamily: "'Inter', sans-serif" }}
                  >
                    <Link2 size={14} /> Sao chép liên kết
                  </button>
                  {navigator.share && (
                    <button
                      onClick={nativeShare}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:opacity-70"
                      style={{ color: C.ink2, fontFamily: "'Inter', sans-serif" }}
                    >
                      <Send size={14} /> Chia sẻ qua ứng dụng khác
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {showComments && (
          <CommentSection
            postId={post._id}
            postOwnerId={author._id || author.id}
            currentUser={currentUser}
            onCountChange={(delta) => setCommentCount((n) => n + delta)}
            isQuestion={isQuestion}
            acceptedId={acceptedId}
            onAccept={isQuestion && isOwner ? acceptAnswer : null}
            onAcceptedRemoved={() => {
              setAcceptedId(null);
              onAcceptedChange?.(post._id, null);
            }}
          />
        )}
      </div>
    </article>
  );
}
