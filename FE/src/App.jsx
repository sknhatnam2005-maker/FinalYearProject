import React, { useState, useEffect } from "react";
import {
  Home,
  Compass,
  Users,
  MessageCircle,
  Bell,
  Search,
  BookOpen,
  Loader2,
  Library as LibraryIcon,
  Radio,
} from "lucide-react";
import LibraryPage from "./components/LibraryPage";
import LivePage from "./components/LivePage";

import { C, FONTS } from "./constants";
import { subjectColor, notifications as fallbackNotifications } from "./data";
import { loadRecentSubjects } from "./components/SubjectPicker";
import { api, clearToken, timeAgo } from "./api";

import Avatar from "./components/Avatar";
import NavItem from "./components/NavItem";
import Composer from "./components/Composer";
import PostCard from "./components/PostCard";
import SectionLabel from "./components/SectionLabel";
import RightSidebar from "./components/RightSidebar";
import EmptyState from "./components/EmptyState";
import TopicPage from "./components/TopicPage";
import NotificationPanel from "./components/NotificationPanel";
import ProfileMenu from "./components/ProfileMenu";
import LoginPage from "./components/LoginPage";
import PersonProfile from "./components/PersonProfile";
import MyProfile from "./components/MyProfile";
import MessagesPage from "./components/MessagesPage";
import UserSearch from "./components/UserSearch";
import CompleteProfileModal from "./components/CompleteProfileModal";

export default function GocHoc() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState("");

  const [view, setView] = useState("feed");
  const [query, setQuery] = useState("");
  const [feedFilter, setFeedFilter] = useState("all");
  const [activeTopic, setActiveTopic] = useState(null);
  const [activePerson, setActivePerson] = useState(null);
  const [chatWithPerson, setChatWithPerson] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState(fallbackNotifications);
  // Bài viết mở từ link chia sẻ (?post=<id>)
  const [sharedPostId, setSharedPostId] = useState(() => new URLSearchParams(window.location.search).get("post"));
  const [sharedPost, setSharedPost] = useState(null);
  const [sharedPostError, setSharedPostError] = useState("");

  useEffect(() => {
    if (!currentUser || !sharedPostId) return;
    setSharedPost(null);
    setSharedPostError("");
    api
      .getPost(sharedPostId)
      .then(setSharedPost)
      .catch((err) => setSharedPostError(err.message));
  }, [currentUser, sharedPostId]);

  const closeSharedPost = () => {
    setSharedPostId(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  // Các buổi đang phát trực tiếp (cho banner bảng tin + badge menu), cập nhật mỗi 20 giây
  const [liveStreams, setLiveStreams] = useState([]);
  const [openLiveId, setOpenLiveId] = useState(null);
  useEffect(() => {
    if (!currentUser) return;
    const load = () => api.getLiveStreams().then(setLiveStreams).catch(() => {});
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 20_000);
    return () => clearInterval(t);
  }, [currentUser]);

  const openLive = (id) => {
    setOpenLiveId(id);
    setView("live");
  };

  // Mở một bài viết ở đầu trang (dùng lại khung "bài viết được chia sẻ"), vd. từ Thư viện
  const openPost = (postId) => {
    setSharedPostId(postId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    api
      .me()
      .then((user) => setCurrentUser({ ...user, id: user.id || user._id }))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadPosts();
    loadNotifications();
  }, [currentUser]);

  async function loadNotifications() {
    try {
      const data = await api.getNotifications();
      setNotifs(
        data.map((n) => ({
          id: n._id,
          type: n.type,
          actor: n.actorId?.name || "Ai đó",
          text: n.text,
          time: timeAgo(n.createdAt),
          read: n.isRead,
          liveId: n.liveId,
        }))
      );
    } catch {
      setNotifs(fallbackNotifications);
    }
  }

  async function loadPosts(subject) {
    setLoadingPosts(true);
    setPostsError("");
    try {
      const data = await api.getPosts(subject);
      setPosts(data);
    } catch (err) {
      setPostsError(err.message);
    } finally {
      setLoadingPosts(false);
    }
  }

  const openTopic = (subjectName) => {
    setActiveTopic(subjectName);
    setView("topic");
  };

  const openPerson = (person) => {
    setActivePerson(person);
    setView("person");
  };

  const openMessages = (person) => {
    setChatWithPerson(person);
    setView("messages");
  };

  const [unreadMessages, setUnreadMessages] = useState(0);

  const refreshUnreadMessages = () =>
    api
      .getUnreadMessageCount()
      .then(({ count }) => setUnreadMessages(count))
      .catch(() => {});

  useEffect(() => {
    if (!currentUser) return;
    refreshUnreadMessages();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshUnreadMessages();
    }, 15000);
    return () => clearInterval(id);
  }, [currentUser]);

  const toggleLike = async (postId) => {
    const flip = (p) =>
      p._id === postId ? { ...p, liked: !p.liked, likeCount: p.liked ? p.likeCount - 1 : p.likeCount + 1 } : p;
    setPosts((ps) => ps.map(flip));
    setSharedPost((sp) => sp && flip(sp));
    try {
      await api.toggleLike(postId);
    } catch (err) {
      loadPosts();
    }
  };

  const addPost = async (draft) => {
    const newPost = await api.createPost({ ...draft, tags: [] });
    const authorId = { ...currentUser, _id: currentUser.id || currentUser._id };
    setPosts((ps) => [{ ...newPost, authorId, liked: false }, ...ps]);
  };

  const updatePost = async (postId, content) => {
    await api.updatePost(postId, { content });
    setPosts((ps) => ps.map((p) => (p._id === postId ? { ...p, content } : p)));
  };

  const deletePost = async (postId) => {
    await api.deletePost(postId);
    setPosts((ps) => ps.filter((p) => p._id !== postId));
  };

  const openNotifications = () => {
    if (!notifOpen) loadNotifications();
    setNotifOpen((v) => !v);
    setProfileMenuOpen(false);
  };

  const markNotificationRead = (id) => {
    setNotifs((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.markNotificationRead(id).catch(() => {});
  };

  const markAllNotificationsRead = () => {
    setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
    api.markAllNotificationsRead().catch(() => {});
  };

  const unreadCount = notifs.filter((n) => !n.read).length;

  const isMine = (p) => (p.authorId?._id || p.authorId) === currentUser?.id;
  const myPosts = posts.filter(isMine);

  // Các môn hợp với vai trò (BE đã lọc), xếp theo số bài — dùng cho trang Khám phá và cột trái.
  // Tải lại khi đổi vai trò/môn dạy hoặc số bài thay đổi.
  const [allowedSubjects, setAllowedSubjects] = useState([]);
  useEffect(() => {
    if (!currentUser?.role) return;
    api.getSubjects("", 50).then(setAllowedSubjects).catch(() => {});
  }, [currentUser?.role, currentUser?.teachingSubjects?.join("|"), posts.length]);
  const popularSubjects = allowedSubjects.slice(0, 12);

  // "Môn học của bạn": giảng viên = môn mình dạy; học sinh/sinh viên = môn chọn gần đây + môn đã đăng,
  // thiếu thì bù bằng môn phổ biến. Chỉ giữ môn hợp vai trò hiện tại.
  const allowedLabels = new Set(allowedSubjects.map((s) => s.label));
  const mySubjects =
    currentUser?.role === "giang_vien"
      ? currentUser.teachingSubjects
      : [
          ...new Set([
            ...loadRecentSubjects(),
            ...myPosts.map((p) => p.subject),
            ...popularSubjects.map((s) => s.label),
          ]),
        ]
          .filter((label) => allowedLabels.has(label))
          .slice(0, 6);

  // Cập nhật luôn tên/màu tác giả trên các bài đã tải để không phải tải lại bảng tin
  const handleProfileUpdated = (user) => {
    setCurrentUser(user);
    setPosts((ps) =>
      ps.map((p) =>
        isMine(p)
          ? { ...p, authorId: { ...p.authorId, name: user.name, handle: user.handle, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl } }
          : p
      )
    );
  };

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
    setPosts([]);
    setProfileMenuOpen(false);
  };

  const nav = [
    { key: "feed", label: "Bảng tin", icon: Home },
    { key: "explore", label: "Khám phá", icon: Compass },
    { key: "live", label: "Trực tiếp", icon: Radio, badge: liveStreams.length || 0 },
    { key: "library", label: "Thư viện", icon: LibraryIcon },
    { key: "groups", label: "Nhóm học", icon: Users },
    { key: "messages", label: "Tin nhắn", icon: MessageCircle, badge: unreadMessages > 9 ? "9+" : unreadMessages },
  ];

  const searchedPosts = query && !query.trim().startsWith("@")
    ? posts.filter(
        (p) =>
          p.content.toLowerCase().includes(query.toLowerCase()) ||
          p.subject.toLowerCase().includes(query.toLowerCase())
      )
    : posts;

  const FEED_FILTERS = [
    { key: "all", label: "Tất cả", match: () => true },
    { key: "questions", label: "Câu hỏi", match: (p) => p.type === "question" },
    { key: "unsolved", label: "Chưa giải quyết", match: (p) => p.type === "question" && !p.acceptedCommentId },
    { key: "solved", label: "Đã giải quyết ✓", match: (p) => p.type === "question" && !!p.acceptedCommentId },
  ];
  const activeFilter = FEED_FILTERS.find((f) => f.key === feedFilter);
  const filteredPosts = searchedPosts.filter(activeFilter.match);
  const unsolvedCount = searchedPosts.filter(FEED_FILTERS[2].match).length;

  const setAccepted = (postId, acceptedCommentId) =>
    setPosts((ps) => ps.map((p) => (p._id === postId ? { ...p, acceptedCommentId } : p)));

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.paper }}>
        <Loader2 className="animate-spin" color={C.ink} size={28} />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onAuthed={(user) => setCurrentUser(user)} />;
  }

  return (
    <div style={{ background: C.paper, minHeight: "100vh" }}>
      <style>{FONTS}</style>
      {(!currentUser.role || !currentUser.birthDate || !currentUser.gender) && (
        <CompleteProfileModal user={currentUser} onDone={setCurrentUser} onLogout={handleLogout} />
      )}

      <div
        className="sticky top-0 z-20 flex items-center gap-4 px-5 py-3"
        style={{ background: C.paper, borderBottom: `1px solid ${C.line}` }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.ink }}>
            <BookOpen size={17} color={C.paper} />
          </div>
          <span
            style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 700 }}
            className="text-xl hidden sm:block"
          >
            Góc Học
          </span>
        </div>

        <UserSearch
          query={query}
          onQueryChange={(value) => {
            setQuery(value);
            // Gõ "@username" chỉ để tìm người, không chuyển sang lọc bảng tin
            if (value && !value.trim().startsWith("@")) setView("feed");
          }}
          onOpenPerson={openPerson}
        />

        <div className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <button
              onClick={openNotifications}
              className="p-2 rounded-full hover:opacity-70 relative"
              style={{ color: C.ink }}
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
                  style={{ background: C.coral, color: "#fff", fontFamily: "'Inter', sans-serif" }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotificationPanel
                notifications={notifs}
                onClose={() => setNotifOpen(false)}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onOpenLive={(id) => {
                  setNotifOpen(false);
                  openLive(id);
                }}
              />
            )}
          </div>

          <div className="relative">
            <button onClick={() => { setProfileMenuOpen((v) => !v); setNotifOpen(false); }}>
              <Avatar label={currentUser.name} size={34} color={C.ink} src={currentUser.avatarUrl} />
            </button>
            {profileMenuOpen && (
              <ProfileMenu
                onClose={() => setProfileMenuOpen(false)}
                onViewProfile={() => {
                  setView("profile");
                  setProfileMenuOpen(false);
                }}
                onLogout={handleLogout}
              />
            )}
          </div>
        </div>
      </div>

      {/* Trang tin nhắn bỏ cột gợi ý kết bạn để khung chat rộng hơn */}
      <div className={`max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[220px_1fr] ${view === "messages" ? "" : "lg:grid-cols-[220px_1fr_280px]"} gap-6 px-5 py-6`}>
        <aside className="hidden md:block">
          <nav className="space-y-1 sticky top-20">
            {nav.map((n) => (
              <NavItem
                key={n.key}
                icon={n.icon}
                label={n.label}
                badge={n.badge}
                active={view === n.key}
                onClick={() => setView(n.key)}
              />
            ))}

            <div className="pt-4 mt-4" style={{ borderTop: `1px dashed ${C.line}` }}>
              <SectionLabel>{currentUser.role === "giang_vien" ? "Môn bạn dạy" : "Môn học của bạn"}</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {mySubjects.map((name) => (
                  <button
                    key={name}
                    onClick={() => openTopic(name)}
                    className="flex items-center gap-2 px-1 hover:opacity-70 min-w-0"
                    title={name}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: subjectColor(name) }} />
                    <span className="text-[13.5px] truncate" style={{ color: C.ink2, fontFamily: "'Inter', sans-serif" }}>
                      {name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0">
          {sharedPostId && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Bài viết được chia sẻ</SectionLabel>
                <button
                  onClick={closeSharedPost}
                  className="text-xs font-medium hover:opacity-70"
                  style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Đóng ✕
                </button>
              </div>
              {sharedPostError ? (
                <EmptyState icon={Search} title="Không mở được bài viết" body={sharedPostError} />
              ) : sharedPost ? (
                <PostCard
                  post={sharedPost}
                  currentUser={currentUser}
                  onToggleLike={toggleLike}
                  onOpenTopic={openTopic}
                  onUpdatePost={updatePost}
                  onDeletePost={async (id) => {
                    await deletePost(id);
                    closeSharedPost();
                  }}
                  defaultShowComments
                />
              ) : (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin" color={C.mute} size={20} />
                </div>
              )}
            </div>
          )}

          {view === "feed" && (
            <>
              {liveStreams.length > 0 && (
                <button
                  onClick={() => openLive(liveStreams[0]._id)}
                  className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl text-left hover:opacity-90"
                  style={{ background: `${C.coral}12`, border: `1px solid ${C.coral}55` }}
                >
                  <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: C.coral, color: "#fff", fontFamily: "'Inter', sans-serif" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                  </span>
                  <span className="flex-1 min-w-0 text-sm truncate" style={{ color: C.ink, fontFamily: "'Inter', sans-serif" }}>
                    <b>{liveStreams[0].host?.name}</b> đang phát: {liveStreams[0].title}
                    {liveStreams.length > 1 && <span style={{ color: C.mute }}> · và {liveStreams.length - 1} buổi khác</span>}
                  </span>
                  <span className="text-xs font-semibold shrink-0" style={{ color: C.coral, fontFamily: "'Inter', sans-serif" }}>Xem →</span>
                </button>
              )}
              <Composer onPost={addPost} user={currentUser} />
              <div className="flex gap-1.5 mb-4 overflow-x-auto">
                {FEED_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFeedFilter(f.key)}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      background: feedFilter === f.key ? C.ink : C.card,
                      color: feedFilter === f.key ? C.paper : C.ink2,
                      border: `1px solid ${feedFilter === f.key ? C.ink : C.line}`,
                    }}
                  >
                    {f.label}
                    {f.key === "unsolved" && unsolvedCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center" style={{ background: C.mustard, color: "#fff" }}>
                        {unsolvedCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {loadingPosts ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin" color={C.mute} size={22} />
                </div>
              ) : postsError ? (
                <EmptyState icon={Search} title="Không tải được bài viết" body={postsError} />
              ) : filteredPosts.length ? (
                filteredPosts.map((p) => (
                  <PostCard
                    key={p._id}
                    post={p}
                    currentUser={currentUser}
                    onToggleLike={toggleLike}
                    onOpenTopic={openTopic}
                    onUpdatePost={updatePost}
                    onDeletePost={deletePost}
                    onOpenAuthor={openPerson}
                    onAcceptedChange={setAccepted}
                  />
                ))
              ) : feedFilter === "all" ? (
                <EmptyState icon={Search} title="Chưa có bài viết nào" body="Hãy là người đầu tiên đăng bài trong cộng đồng." />
              ) : (
                <EmptyState
                  icon={Search}
                  title={feedFilter === "unsolved" ? "Không còn câu hỏi nào bị bỏ ngỏ 🎉" : "Chưa có câu hỏi nào"}
                  body={feedFilter === "unsolved" ? "Mọi câu hỏi đều đã có câu trả lời hay nhất." : "Bấm \"Đặt câu hỏi\" ở ô phía trên để hỏi cộng đồng."}
                />
              )}
            </>
          )}

          {view === "topic" && (
            <TopicPage
              subjectName={activeTopic}
              posts={posts}
              currentUser={currentUser}
              onBack={() => setView("explore")}
              onToggleLike={toggleLike}
              onOpenTopic={openTopic}
              onUpdatePost={updatePost}
              onDeletePost={deletePost}
            />
          )}

          {view === "person" && activePerson && (
            <PersonProfile
              person={activePerson}
              currentUser={currentUser}
              onBack={() => setView("feed")}
              onMessage={openMessages}
              postProps={{ onToggleLike: toggleLike, onOpenTopic: openTopic, onUpdatePost: updatePost, onDeletePost: deletePost, onOpenAuthor: openPerson }}
            />
          )}

          {view === "explore" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                <div style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 700 }} className="text-xl mb-1">
                  Khám phá cộng đồng học tập
                </div>
                <p className="text-sm" style={{ color: C.mute, fontFamily: "'Inter', sans-serif" }}>
                  Duyệt bài viết theo môn học đang được quan tâm nhiều nhất tuần này.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {popularSubjects.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => openTopic(s.label)}
                    className="text-left rounded-2xl p-4 flex flex-col gap-2 transition-transform hover:-translate-y-0.5 min-w-0"
                    style={{ background: C.card, border: `1px solid ${C.line}` }}
                  >
                    <span className="w-3 h-3 rounded-full" style={{ background: subjectColor(s.label) }} />
                    <span className="leading-snug" style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 600 }}>{s.name}</span>
                    <span className="text-xs mt-auto" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {s.postCount} bài viết
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === "library" && <LibraryPage onOpenPost={openPost} />}

          {view === "live" && (
            <LivePage currentUser={currentUser} openStreamId={openLiveId} onOpened={() => setOpenLiveId(null)} />
          )}

          {view === "groups" && (
            <EmptyState icon={Users} title="Bạn chưa tham gia nhóm nào" body="Tham gia nhóm học theo môn để nhận tài liệu và trao đổi cùng bạn bè." />
          )}

          {view === "messages" && (
            <MessagesPage
              currentUser={currentUser}
              initialPerson={chatWithPerson}
              onUnreadChange={refreshUnreadMessages}
            />
          )}

          {view === "profile" && (
            <MyProfile user={currentUser} postCount={myPosts.length} onUpdated={handleProfileUpdated} onOpenPerson={openPerson}>
              <SectionLabel>Bài viết của bạn</SectionLabel>
              {myPosts.length ? (
                myPosts.map((p) => (
                  <PostCard
                    key={p._id}
                    post={p}
                    currentUser={currentUser}
                    onToggleLike={toggleLike}
                    onOpenTopic={openTopic}
                    onUpdatePost={updatePost}
                    onDeletePost={deletePost}
                  />
                ))
              ) : (
                <EmptyState icon={BookOpen} title="Bạn chưa đăng bài nào" body="Chia sẻ điều bạn đang học ở Bảng tin nhé." />
              )}
            </MyProfile>
          )}
        </main>

        <aside className={view === "messages" ? "hidden" : "hidden lg:block"}>
          <RightSidebar
            key={currentUser.id}
            currentUserId={currentUser.id}
            onViewPerson={openPerson}
          />
        </aside>
      </div>

      <div
        className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around py-2 z-20"
        style={{ background: C.card, borderTop: `1px solid ${C.line}` }}
      >
        {nav.map((n) => (
          <button key={n.key} onClick={() => setView(n.key)} className="p-2 relative">
            <n.icon size={21} color={view === n.key ? C.ink : C.mute} />
            {n.badge ? <span className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ background: C.coral }} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
