import React from "react";
import { ArrowLeft, Hash } from "lucide-react";
import { C } from "../constants";
import { subjectColor } from "../data";
import PostCard from "./PostCard";
import EmptyState from "./EmptyState";

export default function TopicPage({ subjectName, posts, currentUser, onBack, onToggleLike, onOpenTopic, onUpdatePost, onDeletePost }) {
  const s = { color: subjectColor(subjectName) };
  const topicPosts = posts.filter((p) => p.subject === subjectName);

  return (
    <div>
      <div className="rounded-2xl p-5 mb-4 relative overflow-hidden" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: s.color }} />
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium mb-3 hover:opacity-70" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
          <ArrowLeft size={14} /> Quay lại
        </button>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.color}1f` }}>
            <Hash size={18} color={s.color} />
          </span>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 700 }} className="text-xl">{subjectName}</div>
            <div className="text-xs" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
              {topicPosts.length} bài viết trong chủ đề này
            </div>
          </div>
        </div>
      </div>

      {topicPosts.length ? (
        topicPosts.map((p) => (
          <PostCard
            key={p._id}
            post={p}
            currentUser={currentUser}
            onToggleLike={onToggleLike}
            onOpenTopic={onOpenTopic}
            onUpdatePost={onUpdatePost}
            onDeletePost={onDeletePost}
          />
        ))
      ) : (
        <EmptyState icon={Hash} title="Chưa có bài viết nào" body={`Hãy là người đầu tiên đăng bài trong chủ đề ${subjectName}.`} />
      )}
    </div>
  );
}
