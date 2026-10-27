import React, { useState, useEffect, useRef } from "react";
import { Radio, Camera, MonitorUp, Loader2, Eye, Video } from "lucide-react";
import { C } from "../constants";
import { api, timeAgo } from "../api";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import SubjectTag from "./SubjectTag";
import EmptyState from "./EmptyState";
import LiveRoom from "./LiveRoom";
import SubjectPicker from "./SubjectPicker";
import VisibilityPicker, { loadLastVisibility } from "./VisibilityPicker";

const font = { fontFamily: "'Inter', sans-serif" };
const MIN_TITLE = 2; // khớp với BE/live.js

// Xin quyền camera/màn hình TRƯỚC khi tạo buổi live, để bị từ chối thì không tạo buổi rỗng.
// Hình là bắt buộc; micro thì không (nhiều laptop không có/tắt micro) → thiếu micro vẫn phát, chỉ không có tiếng.
// Trả về { media, noMic }.
async function getMedia(source) {
  if (!navigator.mediaDevices) {
    throw new Error("Trình duyệt không cho dùng camera ở đây. Hãy mở bằng http://localhost hoặc HTTPS.");
  }
  const video =
    source === "screen"
      ? await navigator.mediaDevices.getDisplayMedia({ video: true })
      : await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
  const mic = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
  return {
    media: new MediaStream([...video.getVideoTracks(), ...(mic ? mic.getAudioTracks() : [])]),
    noMic: !mic,
  };
}

function mediaError(err) {
  if (err.name === "NotAllowedError") return "Bạn chưa cho phép dùng camera/micro. Hãy bật quyền trong trình duyệt rồi thử lại.";
  if (err.name === "NotFoundError") return "Không tìm thấy camera trên máy. Bạn có thể chọn \"Chia sẻ màn hình\" để phát.";
  if (err.name === "NotReadableError") return "Camera đang được ứng dụng khác sử dụng.";
  return err.message || "Không mở được camera/micro.";
}

function StartForm({ user, onStarted }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState(loadLastVisibility);
  const [source, setSource] = useState("camera");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const start = async (e) => {
    e.preventDefault();
    setError("");
    if (title.trim().length < MIN_TITLE) {
      setError(`Nhập tiêu đề ít nhất ${MIN_TITLE} ký tự để mọi người biết buổi live về gì nhé.`);
      return;
    }
    setStarting(true);
    let media, noMic;
    try {
      ({ media, noMic } = await getMedia(source));
    } catch (err) {
      setError(mediaError(err));
      setStarting(false);
      return;
    }
    try {
      const stream = await api.startLive({ title, subject, visibility });
      onStarted(stream, media, noMic);
    } catch (err) {
      media.getTracks().forEach((t) => t.stop());
      setError(err.message);
      setStarting(false);
    }
  };

  const sourceBtn = (key, Icon, label) => (
    <button
      type="button"
      onClick={() => setSource(key)}
      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg"
      style={{
        ...font,
        background: source === key ? `${C.coral}14` : C.card,
        color: source === key ? C.coral : C.ink2,
        border: `1.5px solid ${source === key ? C.coral : C.line}`,
      }}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <form onSubmit={start} className="rounded-2xl p-4 space-y-3" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${C.coral}1a` }}>
          <Radio size={16} color={C.coral} />
        </span>
        <div>
          <div className="font-semibold" style={{ fontFamily: "'Fraunces', serif", color: C.ink }}>Phát trực tiếp</div>
          <div className="text-xs" style={{ ...font, color: C.mute }}>Giảng bài, giải đề, học nhóm cùng mọi người</div>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder={user.role === "giang_vien" ? "Tiêu đề, vd. Chữa đề giữa kỳ Cơ sở dữ liệu" : "Tiêu đề, vd. Học nhóm ôn thi Toán"}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
        style={{ ...font, background: C.paper, border: `1px solid ${C.line}`, color: C.ink }}
      />

      <div className="flex gap-2">
        {sourceBtn("camera", Camera, "Camera")}
        {navigator.mediaDevices?.getDisplayMedia && sourceBtn("screen", MonitorUp, "Chia sẻ màn hình")}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <VisibilityPicker value={visibility} onChange={setVisibility} />
          <SubjectPicker value={subject} onChange={setSubject} placeholder="Môn (không bắt buộc)" />
        </div>
        <button
          type="submit"
          disabled={starting}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-40"
          style={{ ...font, background: C.coral, color: "#fff" }}
        >
          {starting ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />} Bắt đầu phát
        </button>
      </div>

      {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ ...font, background: `${C.coral}1a`, color: C.coral }}>{error}</div>}
    </form>
  );
}

function StreamCard({ stream, onOpen }) {
  const host = stream.host || {};
  return (
    <button
      onClick={() => onOpen(stream)}
      className="text-left rounded-2xl overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{ background: C.card, border: `1px solid ${C.line}` }}
    >
      <div className="relative aspect-video flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.ink}, #2E3A63)` }}>
        <Avatar label={host.name || "?"} size={56} color={host.avatarColor && host.avatarColor !== C.ink ? host.avatarColor : C.mustard} src={host.avatarUrl} />
        <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ ...font, background: C.coral, color: "#fff" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
        </span>
        <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ ...font, background: "rgba(0,0,0,0.55)", color: "#fff" }}>
          <Eye size={11} /> {stream.viewerCount}
        </span>
      </div>
      <div className="p-3 space-y-1">
        <div className="text-sm font-semibold leading-snug line-clamp-2" style={{ ...font, color: C.ink }}>{stream.title}</div>
        <div className="flex items-center gap-1.5 text-xs" style={{ ...font, color: C.mute }}>
          {host.name} <RoleBadge role={host.role} /> · bắt đầu {timeAgo(stream.startedAt)}
        </div>
        {stream.subject && <SubjectTag name={stream.subject} />}
      </div>
    </button>
  );
}

// openStreamId: mở thẳng một buổi live (vd. bấm "Xem" từ banner bảng tin)
export default function LivePage({ currentUser, openStreamId, onOpened }) {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null); // { stream, isHost, media }
  const [error, setError] = useState("");
  const roomRef = useRef(null);
  roomRef.current = room;

  const load = () =>
    api
      .getLiveStreams()
      .then(setStreams)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const t = setInterval(() => !roomRef.current && document.visibilityState === "visible" && load(), 10_000);
    return () => clearInterval(t);
  }, []);

  const openStream = async (s) => {
    setError("");
    const isHost = String(s.host?._id) === String(currentUser.id);
    if (isHost) return setError("Bạn đang phát buổi này ở một tab khác.");
    setRoom({ stream: s, isHost: false });
  };

  useEffect(() => {
    if (!openStreamId) return;
    api
      .getLiveStream(openStreamId)
      .then((s) => (s.status === "live" ? openStream(s) : setError("Buổi phát trực tiếp đã kết thúc.")))
      .catch((err) => setError(err.message))
      .finally(() => onOpened?.());
  }, [openStreamId]);

  if (room) {
    return (
      <LiveRoom
        key={room.stream._id}
        stream={room.stream}
        isHost={room.isHost}
        mediaStream={room.media}
        noMic={room.noMic}
        currentUser={currentUser}
        onExit={() => {
          setRoom(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <StartForm user={currentUser} onStarted={(stream, media, noMic) => setRoom({ stream, isHost: true, media, noMic })} />

      {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ ...font, background: `${C.coral}1a`, color: C.coral }}>{error}</div>}

      <div className="text-xs font-semibold uppercase tracking-wide px-1" style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.mute }}>
        Đang phát trực tiếp
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin" color={C.mute} size={22} />
        </div>
      ) : streams.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {streams.map((s) => (
            <StreamCard key={s._id} stream={s} onOpen={openStream} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Radio} title="Chưa có ai đang phát" body="Hãy là người đầu tiên mở lớp học trực tiếp!" />
      )}
    </div>
  );
}
