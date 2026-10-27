import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, Camera, PhoneOff, Eye, Send, Loader2, Volume2, ArrowLeft, RotateCw } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import SubjectTag from "./SubjectTag";
import { VisibilityIcon } from "./VisibilityPicker";

// STUN công khai của Google để hai máy khác mạng tìm được đường kết nối trực tiếp
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const POLL_MS = 1000;
const font = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

function useElapsed(since) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Phòng livestream.
 * - Người phát (isHost): giữ một RTCPeerConnection cho mỗi người xem. Khi có tín hiệu "join"
 *   thì tạo kết nối mới, gắn camera/màn hình vào rồi gửi offer.
 * - Người xem: chờ offer từ người phát, trả answer, nhận video qua ontrack.
 * Tín hiệu (offer/answer/ICE) đi qua BE bằng cách poll mỗi giây.
 */
export default function LiveRoom({ stream: initialInfo, isHost, mediaStream, noMic = false, currentUser, onExit }) {
  const [info, setInfo] = useState(initialInfo);
  const [status, setStatus] = useState("live");
  const [viewerCount, setViewerCount] = useState(initialInfo.viewerCount || 0);
  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  // Người phát
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  // Người xem
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true); // trình duyệt chặn tự phát tiếng → bắt đầu tắt tiếng

  const videoRef = useRef(null);
  const chatRef = useRef(null);
  // Người phát: viewerId → { pc, session, remoteSet, pendingIce }
  const peers = useRef(new Map());
  // Người xem: kết nối hiện tại tới người phát
  const pcRef = useRef(null);
  // Mỗi lần người xem vào phòng tạo một mã phiên mới; mọi tín hiệu đều mang mã này để bỏ qua
  // tín hiệu của lần vào trước (vd. React StrictMode chạy effect 2 lần → vào phòng 2 lần)
  const sessionRef = useRef(null);
  const pendingIce = useRef([]); // ICE tới trước offer (người xem)
  const firstJoin = useRef(null);
  const cursors = useRef({ signalAfter: null, chatAfter: null });
  const cameraTrack = useRef(null);
  const localStream = useRef(mediaStream);
  const mounted = useRef(false);

  const hostId = String(info.host?._id || info.host);
  const elapsed = useElapsed(info.startedAt);
  const signal = (to, type, data) => api.sendLiveSignal(info._id, { to, type, data }).catch(() => {});

  // ICE sinh ra ngay khi setLocalDescription, có thể gửi đi TRƯỚC cả offer/answer → bên kia nhận ICE
  // khi chưa có kết nối. Nên giữ ICE lại, gửi offer/answer xong mới gửi ICE.
  const iceSender = (to, session) => {
    let ready = false;
    const queue = [];
    const send = (c) => signal(to, "ice", { session, candidate: c.toJSON() });
    return {
      onCandidate: (e) => e.candidate && (ready ? send(e.candidate) : queue.push(e.candidate)),
      flush: () => {
        ready = true;
        queue.splice(0).forEach(send);
      },
    };
  };

  // ---------- Người phát ----------

  const closePeer = (viewerId) => {
    peers.current.get(viewerId)?.pc.close();
    peers.current.delete(viewerId);
  };

  const connectViewer = async (viewerId, session) => {
    closePeer(viewerId);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer = { pc, session, remoteSet: false, pendingIce: [] };
    peers.current.set(viewerId, peer);
    localStream.current.getTracks().forEach((t) => pc.addTrack(t, localStream.current));
    const ice = iceSender(viewerId, session);
    pc.onicecandidate = ice.onCandidate;
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" && peers.current.get(viewerId)?.pc === pc) closePeer(viewerId);
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await signal(viewerId, "offer", { session, type: offer.type, sdp: offer.sdp });
    ice.flush();
  };

  const hostHandleAnswer = async (viewerId, data) => {
    const peer = peers.current.get(viewerId);
    if (!peer || peer.session !== data.session || peer.remoteSet) return; // answer của phiên cũ
    await peer.pc.setRemoteDescription({ type: data.type, sdp: data.sdp });
    peer.remoteSet = true;
    for (const c of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
  };

  const hostHandleIce = async (viewerId, data) => {
    const peer = peers.current.get(viewerId);
    if (!peer || peer.session !== data.session) return;
    if (peer.remoteSet) await peer.pc.addIceCandidate(data.candidate).catch(() => {});
    else peer.pendingIce.push(data.candidate);
  };

  // Thay track video đang gửi cho mọi người xem (camera ⇄ màn hình) mà không cần kết nối lại
  const replaceVideoTrack = async (track) => {
    const old = localStream.current.getVideoTracks()[0];
    if (old) localStream.current.removeTrack(old);
    localStream.current.addTrack(track);
    for (const { pc } of peers.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
    }
    if (videoRef.current) videoRef.current.srcObject = localStream.current;
  };

  const toggleScreen = async () => {
    try {
      if (!sharing) {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = screen.getVideoTracks()[0];
        if (!cameraTrack.current) cameraTrack.current = localStream.current.getVideoTracks()[0] || null;
        track.onended = () => stopScreen(); // bấm "Dừng chia sẻ" của trình duyệt
        await replaceVideoTrack(track);
        setSharing(true);
      } else {
        await stopScreen();
      }
    } catch {
      // người dùng huỷ hộp thoại chọn màn hình
    }
  };

  const stopScreen = async () => {
    const screenTrack = localStream.current.getVideoTracks()[0];
    if (cameraTrack.current && cameraTrack.current.readyState === "live") {
      await replaceVideoTrack(cameraTrack.current);
    }
    screenTrack?.stop();
    setSharing(false);
  };

  const toggleTrack = (kind, on, set) => {
    localStream.current.getTracks().filter((t) => t.kind === kind).forEach((t) => (t.enabled = !on));
    set(!on);
  };

  // ---------- Người xem ----------

  const viewerHandleOffer = async (from, data) => {
    if (data.session !== sessionRef.current) return; // offer của lần vào phòng trước
    pcRef.current?.close();
    setConnected(false);
    setFailed(false);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.ontrack = (e) => {
      const video = videoRef.current;
      if (video && video.srcObject !== e.streams[0]) {
        video.srcObject = e.streams[0];
        video.play().catch(() => {});
      }
    };
    const ice = iceSender(from, data.session);
    pc.onicecandidate = ice.onCandidate;
    // Chỉ coi là đã kết nối khi đường truyền thông suốt (ontrack chạy từ trước khi có hình thật)
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      if (pc.connectionState === "connected") {
        setConnected(true);
        setFailed(false);
      }
      if (pc.connectionState === "failed") setFailed(true);
    };
    await pc.setRemoteDescription({ type: data.type, sdp: data.sdp });
    for (const c of pendingIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => {});
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await signal(from, "answer", { session: data.session, type: answer.type, sdp: answer.sdp });
    ice.flush();
  };

  const viewerHandleIce = async (data) => {
    if (data.session !== sessionRef.current) return;
    const pc = pcRef.current;
    if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
    else pendingIce.current.push(data.candidate); // ICE tới trước offer
  };

  // Vào phòng với một mã phiên mới; người phát sẽ gửi offer kèm đúng mã này
  const joinRoom = () => {
    sessionRef.current = Math.random().toString(36).slice(2);
    pendingIce.current = [];
    pcRef.current?.close();
    pcRef.current = null;
    setConnected(false);
    setFailed(false);
    return api.joinLive(info._id, sessionRef.current);
  };

  const rejoin = () => joinRoom().catch((err) => setError(err.message));

  // ---------- Xử lý tín hiệu & vòng poll ----------

  const handleSignal = async (s) => {
    const data = s.data || {};
    try {
      if (isHost) {
        if (s.type === "join") await connectViewer(s.from, data.session);
        else if (s.type === "leave") closePeer(s.from);
        else if (s.type === "answer") await hostHandleAnswer(s.from, data);
        else if (s.type === "ice") await hostHandleIce(s.from, data);
      } else if (s.from === hostId) {
        if (s.type === "offer") await viewerHandleOffer(s.from, data);
        else if (s.type === "ice") await viewerHandleIce(data);
      }
    } catch (err) {
      console.warn("Lỗi xử lý tín hiệu", s.type, err);
    }
  };

  useEffect(() => {
    // Mỗi lần effect chạy có cờ riêng: lần chạy cũ (bị React StrictMode gỡ thử) tự dừng vòng poll
    // của nó, không đè lên lần chạy mới.
    let active = true;
    mounted.current = true;
    let timer;

    const tick = async () => {
      if (!active) return;
      try {
        const res = await api.pollLive(info._id, cursors.current);
        if (!active) return;
        for (const s of res.signals) {
          await handleSignal(s);
          cursors.current.signalAfter = s._id;
        }
        if (res.chat.length) {
          setChat((c) => {
            const known = new Set(c.map((m) => m._id));
            return [...c, ...res.chat.filter((m) => !known.has(m._id))];
          });
          cursors.current.chatAfter = res.chat[res.chat.length - 1].createdAt;
        }
        setViewerCount(res.viewerCount);
        // Người xem rời đi mà không kịp báo (đóng tab) → đóng kết nối thừa
        if (isHost && res.viewers) {
          for (const id of peers.current.keys()) if (!res.viewers.includes(id)) closePeer(id);
        }
        if (res.status === "ended") {
          setStatus("ended");
          return; // dừng poll
        }
      } catch (err) {
        if (err.status === 404) {
          setStatus("ended");
          return;
        }
      }
      if (active) timer = setTimeout(tick, POLL_MS);
    };

    (async () => {
      if (isHost) {
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
        cameraTrack.current = mediaStream.getVideoTracks()[0] || null;
      } else {
        try {
          // Ref giữ nguyên qua lần gỡ/gắn lại của StrictMode → chỉ vào phòng đúng 1 lần
          if (!firstJoin.current) firstJoin.current = joinRoom();
          const joined = await firstJoin.current;
          if (!active) return;
          setInfo((i) => ({ ...i, ...joined, host: i.host }));
        } catch (err) {
          if (!active) return;
          setError(err.message);
          if (err.status === 410) setStatus("ended");
          return;
        }
      }
      tick();
    })();

    return () => {
      active = false;
      mounted.current = false;
      clearTimeout(timer);
      // Ở chế độ dev, React StrictMode gỡ rồi gắn lại component ngay lập tức. Đợi một nhịp:
      // nếu đã được gắn lại thì không làm gì; chỉ khi rời phòng thật mới tắt camera/kết thúc live.
      setTimeout(() => {
        if (mounted.current) return;
        if (isHost) {
          // Rời phòng (kể cả bấm sang mục khác trên menu) = kết thúc buổi live
          api.endLive(info._id).catch(() => {});
          for (const id of [...peers.current.keys()]) closePeer(id);
          localStream.current?.getTracks().forEach((t) => t.stop());
          cameraTrack.current?.stop();
        } else {
          pcRef.current?.close();
          api.leaveLive(info._id).catch(() => {});
        }
      }, 0);
    };
  }, [info._id]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [chat]);

  // Người phát rời phòng = kết thúc buổi live
  const endLive = async () => {
    if (!confirm("Kết thúc buổi phát trực tiếp?")) return;
    await api.endLive(info._id).catch(() => {});
    onExit();
  };

  const sendChat = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const msg = await api.sendLiveChat(info._id, text);
      setChat((c) => (c.some((m) => m._id === msg._id) ? c : [...c, msg]));
    } catch (err) {
      setError(err.message);
    }
  };

  const host = info.host || {};
  const controlBtn = (active, onClick, OnIcon, OffIcon, title, danger) => (
    <button
      onClick={onClick}
      title={title}
      className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-85"
      style={{ background: danger ? C.coral : active ? "rgba(255,255,255,0.18)" : "rgba(228,87,46,0.85)", color: "#fff" }}
    >
      {active ? <OnIcon size={18} /> : <OffIcon size={18} />}
    </button>
  );

  return (
    <div className="space-y-3">
      <button
        onClick={isHost && status === "live" ? endLive : onExit}
        className="flex items-center gap-1.5 text-xs font-medium hover:opacity-70"
        style={{ ...mono, color: C.mute }}
      >
        <ArrowLeft size={14} /> {isHost && status === "live" ? "Kết thúc và quay lại" : "Quay lại danh sách"}
      </button>

      <div className="rounded-2xl overflow-hidden flex flex-col lg:flex-row" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        {/* Video */}
        <div className="flex-1 min-w-0">
          <div className="relative bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isHost || muted}
              className="w-full h-full object-contain"
              style={isHost && !sharing ? { transform: "scaleX(-1)" } : undefined}
            />

            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span
                className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md"
                style={{ ...font, background: status === "live" ? C.coral : "rgba(0,0,0,0.6)", color: "#fff" }}
              >
                {status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                {status === "live" ? `LIVE · ${elapsed}` : "ĐÃ KẾT THÚC"}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md" style={{ ...font, background: "rgba(0,0,0,0.6)", color: "#fff" }}>
                <Eye size={12} /> {viewerCount}
              </span>
            </div>

            {/* Trạng thái phía người xem */}
            {!isHost && status === "live" && !connected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm" style={{ ...font, color: "#fff" }}>
                {failed ? (
                  <>
                    Không kết nối được tới người phát.
                    <button onClick={rejoin} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                      <RotateCw size={14} /> Thử lại
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="animate-spin" size={26} /> Đang kết nối...
                  </>
                )}
              </div>
            )}
            {!isHost && connected && muted && status === "live" && (
              <button
                onClick={() => setMuted(false)}
                className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ ...font, background: "rgba(0,0,0,0.65)", color: "#fff" }}
              >
                <Volume2 size={14} /> Bấm để bật tiếng
              </button>
            )}
            {status === "ended" && (
              <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ ...font, color: "#fff", background: "rgba(0,0,0,0.6)" }}>
                Buổi phát trực tiếp đã kết thúc.
              </div>
            )}

            {/* Nút điều khiển của người phát */}
            {isHost && status === "live" && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.55)" }}>
                {!noMic && controlBtn(micOn, () => toggleTrack("audio", micOn, setMicOn), Mic, MicOff, micOn ? "Tắt mic" : "Bật mic")}
                {controlBtn(camOn, () => toggleTrack("video", camOn, setCamOn), Video, VideoOff, camOn ? "Tắt hình" : "Bật hình")}
                {navigator.mediaDevices?.getDisplayMedia &&
                  controlBtn(true, toggleScreen, sharing ? Camera : MonitorUp, MonitorUp, sharing ? "Quay lại camera" : "Chia sẻ màn hình")}
                {controlBtn(true, endLive, PhoneOff, PhoneOff, "Kết thúc", true)}
              </div>
            )}
          </div>

          <div className="p-4 flex items-start gap-3">
            <Avatar label={host.name || "?"} size={40} color={host.avatarColor && host.avatarColor !== C.ink ? host.avatarColor : C.mustard} src={host.avatarUrl} />
            <div className="min-w-0">
              <div className="font-semibold leading-snug" style={{ fontFamily: "'Fraunces', serif", color: C.ink }}>{info.title}</div>
              <div className="flex items-center gap-1.5 flex-wrap text-xs mt-0.5" style={{ ...font, color: C.mute }}>
                {host.name} <RoleBadge role={host.role} /> · <VisibilityIcon value={info.visibility} />
                {info.subject && <SubjectTag name={info.subject} />}
              </div>
            </div>
          </div>
          {isHost && noMic && status === "live" && (
            <div className="mx-4 mb-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ ...font, background: `${C.mustard}1c`, color: C.ink2 }}>
              <MicOff size={14} color="#B97A1C" className="shrink-0" />
              Không tìm thấy micro nên buổi live đang phát hình không có tiếng. Cắm tai nghe có mic rồi phát lại nếu cần nói.
            </div>
          )}
          {error && <div className="px-4 pb-3 text-xs" style={{ ...font, color: C.coral }}>{error}</div>}
        </div>

        {/* Chat */}
        <div className="lg:w-80 flex flex-col h-80 lg:h-auto" style={{ borderLeft: `1px solid ${C.line}`, borderTop: `1px solid ${C.line}` }}>
          <div className="px-4 py-2.5 text-sm font-semibold" style={{ ...font, color: C.ink, borderBottom: `1px solid ${C.line}` }}>
            Trò chuyện trực tiếp
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 lg:max-h-[420px]">
            {chat.length ? (
              chat.map((m) => (
                <div key={m._id} className="text-sm leading-snug break-words" style={font}>
                  <span className="font-semibold" style={{ color: String(m.userId) === hostId ? C.coral : C.ink }}>
                    {m.name}
                  </span>{" "}
                  <RoleBadge role={m.role} /> <span style={{ color: C.ink2 }}>{m.text}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-center mt-6" style={{ ...font, color: C.mute }}>Chưa có tin nhắn nào. Hãy chào mọi người!</div>
            )}
          </div>
          <form onSubmit={sendChat} className="p-2 flex items-center gap-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={300}
              disabled={status !== "live"}
              placeholder={status === "live" ? "Nhắn gì đó..." : "Buổi live đã kết thúc"}
              className="flex-1 px-3 py-2 rounded-full text-sm outline-none disabled:opacity-60"
              style={{ ...font, background: C.paper, color: C.ink }}
            />
            <button
              type="submit"
              disabled={!draft.trim() || status !== "live"}
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{ background: C.ink, color: C.paper }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
