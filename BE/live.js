import mongoose from "mongoose";
import Livestream from "./models/Livestream.js";
import LiveSignal from "./models/LiveSignal.js";
import User from "./models/User.js";
import { findProfanity, profanityMessage, maskProfanity } from "./profanity.js";

// Livestream bằng WebRTC: video đi thẳng từ máy người phát tới từng người xem (mỗi người xem
// một kết nối). Server chỉ chuyển tin "bắt tay" (offer/answer/ICE) qua LiveSignal, giữ chat và
// đếm người xem. FE gọi /poll khoảng mỗi giây để nhận tín hiệu + chat mới.

const HOST_TIMEOUT_MS = 30_000; // người phát không poll 30s → buổi live tự kết thúc
const VIEWER_TIMEOUT_MS = 15_000; // người xem không poll 15s → không tính là đang xem
const MAX_CHAT = 300;

const HOST_FIELDS = "name handle avatarColor avatarUrl role";
const isLive = (s) => s.status === "live" && Date.now() - s.hostLastSeen.getTime() < HOST_TIMEOUT_MS;

function activeViewers(stream) {
  const cutoff = Date.now() - VIEWER_TIMEOUT_MS;
  return stream.viewers.filter((v) => v.lastSeen.getTime() > cutoff);
}

function shape(stream) {
  const s = stream.toObject ? stream.toObject() : stream;
  return {
    _id: s._id,
    host: s.hostId,
    title: s.title,
    subject: s.subject,
    visibility: s.visibility,
    status: isLive(stream) ? "live" : "ended",
    startedAt: s.createdAt,
    endedAt: s.endedAt,
    viewerCount: activeViewers(stream).length,
    peakViewers: s.peakViewers,
  };
}

// Đánh dấu kết thúc các buổi mà người phát đã mất kết nối
async function endStaleStreams() {
  await Livestream.updateMany(
    { status: "live", hostLastSeen: { $lt: new Date(Date.now() - HOST_TIMEOUT_MS) } },
    { $set: { status: "ended", endedAt: new Date() } }
  );
}

export function registerLiveRoutes(app, { requireAuth, optionalAuth, canView, visibleFilter, friendIdsOf, notify }) {
  // Lấy buổi live mà người dùng được xem, không thì trả 404
  async function loadStream(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "Buổi phát trực tiếp không tồn tại" });
      return null;
    }
    const stream = await Livestream.findById(req.params.id);
    if (!stream || !(await canView(req.userId, stream, "hostId"))) {
      res.status(404).json({ message: "Buổi phát trực tiếp không tồn tại hoặc bạn không có quyền xem" });
      return null;
    }
    return stream;
  }

  const isHost = (stream, userId) => String(stream.hostId) === String(userId);

  // Bắt đầu phát. Mỗi người chỉ có 1 buổi đang phát; buổi cũ (nếu còn) bị kết thúc.
  app.post("/api/live", requireAuth, async (req, res) => {
    const title = (req.body.title || "").trim().slice(0, 120);
    if (title.length < 2) return res.status(400).json({ message: "Tiêu đề cần ít nhất 2 ký tự" });
    const bad = findProfanity(title);
    if (bad) return res.status(400).json({ message: profanityMessage(bad) });
    const visibility = ["public", "friends", "private"].includes(req.body.visibility) ? req.body.visibility : "public";

    await Livestream.updateMany({ hostId: req.userId, status: "live" }, { $set: { status: "ended", endedAt: new Date() } });
    const stream = await Livestream.create({
      hostId: req.userId,
      title,
      subject: (req.body.subject || "").slice(0, 80),
      visibility,
    });

    // Báo cho bạn bè (trừ khi chỉ mình tôi)
    if (visibility !== "private") {
      const friends = await friendIdsOf(req.userId);
      await Promise.all(
        friends.map((id) =>
          notify({ userId: id, actorId: req.userId, liveId: stream._id, type: "live", text: `đang phát trực tiếp: "${title}"` })
        )
      );
    }

    await stream.populate("hostId", HOST_FIELDS);
    res.status(201).json(shape(stream));
  });

  // Các buổi đang phát mà người dùng được xem
  app.get("/api/live", optionalAuth, async (req, res) => {
    await endStaleStreams();
    const streams = await Livestream.find({ $and: [{ status: "live" }, await visibleFilter(req.userId, "hostId")] })
      .populate("hostId", HOST_FIELDS)
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(streams.map(shape));
  });

  app.get("/api/live/:id", optionalAuth, async (req, res) => {
    const stream = await loadStream(req, res);
    if (!stream) return;
    await stream.populate("hostId", HOST_FIELDS);
    res.json({ ...shape(stream), chat: stream.chat.slice(-50) });
  });

  // Người xem vào phòng → báo cho người phát để tạo kết nối WebRTC tới người này
  app.post("/api/live/:id/join", requireAuth, async (req, res) => {
    const stream = await loadStream(req, res);
    if (!stream) return;
    if (!isLive(stream)) return res.status(410).json({ message: "Buổi phát trực tiếp đã kết thúc" });
    if (isHost(stream, req.userId)) return res.json(shape(stream));

    const me = new mongoose.Types.ObjectId(req.userId);
    const now = new Date();
    // Cập nhật nếu đã có trong danh sách, chưa có thì thêm — làm nguyên tử để 2 request
    // vào phòng cùng lúc không tạo ra 2 dòng người xem cho cùng một người
    const seen = await Livestream.updateOne({ _id: stream._id, "viewers.userId": me }, { $set: { "viewers.$.lastSeen": now } });
    if (!seen.matchedCount) {
      await Livestream.updateOne(
        { _id: stream._id, "viewers.userId": { $ne: me } },
        { $push: { viewers: { userId: me, lastSeen: now } } }
      );
    }
    // Mã phiên (do FE tạo) đi kèm offer/answer/ICE để hai bên bỏ qua tín hiệu của lần vào trước
    const session = String(req.body.session || "").slice(0, 40);
    await LiveSignal.create({ streamId: stream._id, from: me, to: stream.hostId, type: "join", data: { session } });

    const fresh = await Livestream.findById(stream._id);
    const count = activeViewers(fresh).length;
    if (count > fresh.peakViewers) await Livestream.updateOne({ _id: stream._id }, { $max: { peakViewers: count } });
    res.json(shape(fresh));
  });

  app.post("/api/live/:id/leave", requireAuth, async (req, res) => {
    const stream = await loadStream(req, res);
    if (!stream) return;
    const me = new mongoose.Types.ObjectId(req.userId);
    await Livestream.updateOne({ _id: stream._id }, { $pull: { viewers: { userId: me } } });
    if (!isHost(stream, req.userId)) {
      await LiveSignal.create({ streamId: stream._id, from: me, to: stream.hostId, type: "leave" });
    }
    res.json({ success: true });
  });

  // Chuyển offer/answer/ICE. Chỉ cho phép giữa người phát và người xem của chính buổi này.
  app.post("/api/live/:id/signal", requireAuth, async (req, res) => {
    const stream = await loadStream(req, res);
    if (!stream) return;
    const { to, type, data } = req.body;
    if (!["offer", "answer", "ice"].includes(type) || !mongoose.isValidObjectId(to)) {
      return res.status(400).json({ message: "Tín hiệu không hợp lệ" });
    }
    const fromHost = isHost(stream, req.userId);
    const toHost = isHost(stream, to);
    if (fromHost === toHost) return res.status(403).json({ message: "Chỉ trao đổi giữa người phát và người xem" });
    if (JSON.stringify(data || null).length > 20_000) return res.status(400).json({ message: "Tín hiệu quá lớn" });

    await LiveSignal.create({ streamId: stream._id, from: req.userId, to, type, data });
    res.json({ success: true });
  });

  // Gọi định kỳ: báo "tôi còn ở đây", nhận tín hiệu WebRTC + chat mới kể từ lần trước
  app.post("/api/live/:id/poll", requireAuth, async (req, res) => {
    const stream = await loadStream(req, res);
    if (!stream) return;
    const now = new Date();
    const host = isHost(stream, req.userId);

    if (isLive(stream)) {
      if (host) await Livestream.updateOne({ _id: stream._id }, { $set: { hostLastSeen: now } });
      else await Livestream.updateOne({ _id: stream._id, "viewers.userId": req.userId }, { $set: { "viewers.$.lastSeen": now } });
    } else if (stream.status === "live") {
      await Livestream.updateOne({ _id: stream._id }, { $set: { status: "ended", endedAt: now } });
    }

    const { signalAfter, chatAfter } = req.body;
    const signalQuery = { streamId: stream._id, to: req.userId };
    if (mongoose.isValidObjectId(signalAfter)) signalQuery._id = { $gt: signalAfter };
    const signals = await LiveSignal.find(signalQuery).sort({ _id: 1 }).limit(200);

    const chat = chatAfter ? stream.chat.filter((m) => m.createdAt > new Date(chatAfter)) : stream.chat.slice(-50);
    const fresh = await Livestream.findById(stream._id);

    res.json({
      status: isLive(fresh) ? "live" : "ended",
      viewerCount: activeViewers(fresh).length,
      // Người phát dùng danh sách này để đóng kết nối tới người xem đã rời mà không kịp báo
      viewers: host ? activeViewers(fresh).map((v) => String(v.userId)) : undefined,
      signals: signals.map((s) => ({ _id: s._id, from: String(s.from), type: s.type, data: s.data })),
      chat,
    });
  });

  app.post("/api/live/:id/chat", requireAuth, async (req, res) => {
    const stream = await loadStream(req, res);
    if (!stream) return;
    if (!isLive(stream)) return res.status(410).json({ message: "Buổi phát trực tiếp đã kết thúc" });
    const text = maskProfanity((req.body.text || "").trim().slice(0, 300));
    if (!text) return res.status(400).json({ message: "Tin nhắn trống" });

    const me = await User.findById(req.userId).select("name role");
    const msg = { _id: new mongoose.Types.ObjectId(), userId: me._id, name: me.name, role: me.role, text, createdAt: new Date() };
    await Livestream.updateOne({ _id: stream._id }, { $push: { chat: { $each: [msg], $slice: -MAX_CHAT } } });
    res.status(201).json(msg);
  });

  app.post("/api/live/:id/end", requireAuth, async (req, res) => {
    const stream = await loadStream(req, res);
    if (!stream) return;
    if (!isHost(stream, req.userId)) return res.status(403).json({ message: "Chỉ người phát mới kết thúc được" });
    await Livestream.updateOne({ _id: stream._id }, { $set: { status: "ended", endedAt: new Date(), viewers: [] } });
    await LiveSignal.deleteMany({ streamId: stream._id });
    res.json({ success: true });
  });
}
