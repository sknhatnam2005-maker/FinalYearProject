import React, { useState, useEffect } from "react";
import { ArrowLeft, MessageCircle, Loader2, UserX, BookOpen, School } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import SubjectTag from "./SubjectTag";
import FriendButton from "./FriendButton";
import EmptyState from "./EmptyState";
import SectionLabel from "./SectionLabel";
import PostCard from "./PostCard";

// person có thể là user thật (có _id) hoặc chỉ có handle (vd. từ link) → tra ra user thật
export default function PersonProfile({ person, currentUser, onBack, onMessage, postProps }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setPosts([]);
    setError("");
    (async () => {
      try {
        const id = person._id || (await api.getUserByHandle(person.handle))._id;
        const [p, ps] = await Promise.all([api.getProfile(id), api.getPostsByAuthor(id)]);
        if (cancelled) return;
        setProfile(p);
        setPosts(ps);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [person._id, person.handle]);

  const backButton = (
    <button
      onClick={onBack}
      className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full hover:opacity-80"
      style={{ color: "#fff", background: "rgba(28,37,65,0.45)", fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <ArrowLeft size={14} /> Quay lại
    </button>
  );

  if (error) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <div className="h-16 relative" style={{ background: C.ink }}>{backButton}</div>
        <div className="p-5">
          <EmptyState icon={UserX} title="Không tìm thấy người dùng" body={error} />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" color={C.mute} size={24} />
      </div>
    );
  }

  const color = profile.avatarColor && profile.avatarColor !== C.ink ? profile.avatarColor : C.mustard;
  const isSelf = profile.friendStatus === "self";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <div
          className="h-32 sm:h-40 relative bg-cover bg-center"
          style={{ backgroundColor: C.ink, backgroundImage: profile.coverUrl ? `url(${profile.coverUrl})` : undefined }}
        >
          {backButton}
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="relative z-10 -mt-12 inline-flex rounded-full" style={{ border: `4px solid ${C.card}`, background: C.card }}>
              <Avatar label={profile.name} size={88} color={color} src={profile.avatarUrl} />
            </div>

            {!isSelf && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => onMessage(profile)}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-80"
                  style={{ background: C.card, color: C.ink, border: `1px solid ${C.ink}` }}
                >
                  <MessageCircle size={15} /> Nhắn tin
                </button>
                <FriendButton
                  userId={profile._id}
                  name={profile.name}
                  status={profile.friendStatus}
                  onChange={(friendStatus) =>
                    setProfile((p) => ({
                      ...p,
                      friendStatus,
                      friendCount: p.friendCount + (friendStatus === "friends" ? 1 : p.friendStatus === "friends" ? -1 : 0),
                    }))
                  }
                />
              </div>
            )}
          </div>

          <div className="mt-3 text-xl flex items-center gap-2 flex-wrap" style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 700 }}>
            {profile.name} <RoleBadge role={profile.role} full />
          </div>
{profile.school && (
            <div className="mt-2 flex items-center gap-1.5 text-sm" style={{ fontFamily: "'Inter', sans-serif", color: C.ink2 }}>
              <School size={14} color={C.mute} /> {profile.school}
            </div>
          )}
          {profile.role === "giang_vien" && profile.teachingSubjects?.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" style={{ fontFamily: "'Inter', sans-serif", color: C.mute }}>
              Giảng dạy: {profile.teachingSubjects.map((s) => <SubjectTag key={s} name={s} />)}
            </div>
          )}
          <div className="text-sm" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
            @{profile.handle}
          </div>
          {profile.bio && (
            <p className="mt-3 text-sm whitespace-pre-line" style={{ color: C.ink2, fontFamily: "'Inter', sans-serif" }}>
              {profile.bio}
            </p>
          )}
          {profile.friendStatus === "incoming" && (
            <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#FBF3E2", color: C.ink2, fontFamily: "'Inter', sans-serif" }}>
              {profile.name} đã gửi cho bạn lời mời kết bạn.
            </div>
          )}

          <div className="flex gap-5 text-sm mt-4" style={{ fontFamily: "'Inter', sans-serif", color: C.ink2 }}>
            <span><b>{profile.postCount}</b> bài viết</span>
            <span><b>{profile.friendCount}</b> bạn bè</span>
          </div>
        </div>
      </div>

      <SectionLabel>Bài viết của {profile.name}</SectionLabel>
      {posts.length ? (
        posts.map((p) => <PostCard key={p._id} post={p} currentUser={currentUser} {...postProps} />)
      ) : (
        <EmptyState icon={BookOpen} title="Chưa có bài viết nào" body={`${profile.name} chưa đăng bài viết nào.`} />
      )}
    </div>
  );
}
