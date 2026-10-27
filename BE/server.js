import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectDB } from "./db.js";
import { requireAuth, optionalAuth } from "./middleware/auth.js";
import { validateRole, validatePersonal, subjectFilterFor, canPostInSubject, levelForNewSubject } from "./roles.js";

import User from "./models/User.js";
import Post from "./models/Post.js";
import Comment from "./models/Comment.js";
import Like from "./models/Like.js";
import Follow from "./models/Follow.js";
import Group from "./models/Group.js";
import Message from "./models/Message.js";
import Notification from "./models/Notification.js";
import Friendship from "./models/Friendship.js";
import Subject, { normalizeText } from "./models/Subject.js";
import { seedSubjects } from "./seedSubjects.js";
import { checkSubject } from "./subjectClassifier.js";
import { registerLiveRoutes } from "./live.js";
import { registerGoogleAuth } from "./googleAuth.js";
import { parseMedia, mediaLabel, registerGifRoutes } from "./media.js";
import { findProfanity, profanityMessage, maskProfanity } from "./profanity.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

await connectDB();
await seedSubjects();

// ---------- Auth ----------

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// Username lưu chữ thường, không kèm "@" — người dùng gõ "@NhatNam" hay "nhatnam" đều ra cùng một người
const HANDLE_RE = /^[a-z0-9._]{3,30}$/;
const HANDLE_RULE = "Username gồm 3–30 ký tự: chữ không dấu, số, dấu chấm hoặc gạch dưới";

function normalizeHandle(handle) {
  return (handle || "").trim().replace(/^@/, "").toLowerCase();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// So khớp không phân biệt hoa thường để vẫn tìm được các tài khoản cũ có chữ hoa
function handleQuery(handle) {
  return { handle: new RegExp(`^${escapeRegex(handle)}$`, "i") };
}

// Có từ chửi bậy → trả 400 kèm từ (đã che bớt) để người dùng biết chỗ cần sửa
function rejectProfanity(res, ...texts) {
  const bad = findProfanity(...texts);
  if (bad) res.status(400).json({ message: profanityMessage(bad) });
  return !!bad;
}

// Thông tin trả về cho chính chủ sau khi đăng ký/đăng nhập (không có passwordHash)
function selfUser(user) {
  const { passwordHash, ...rest } = user.toObject();
  return { ...rest, id: user._id };
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const handle = normalizeHandle(req.body.handle);
    if (!name || !handle || !email || !password) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin" });
    }
    if (!HANDLE_RE.test(handle)) return res.status(400).json({ message: HANDLE_RULE });
    if (rejectProfanity(res, name, handle, req.body.school)) return;
    if (!req.body.birthDate) return res.status(400).json({ message: "Vui lòng nhập ngày sinh" });
    if (!req.body.gender) return res.status(400).json({ message: "Vui lòng chọn giới tính" });
    const roleCheck = await validateRole(req.body);
    if (roleCheck.error) return res.status(400).json({ message: roleCheck.error });
    const personal = validatePersonal(req.body);
    if (personal.error) return res.status(400).json({ message: personal.error });
    if (await User.exists(handleQuery(handle))) {
      return res.status(409).json({ message: `@${handle} đã có người dùng` });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ message: "Email đã được sử dụng" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, handle, email, passwordHash, ...roleCheck.value, ...personal.value });
    const token = generateToken(user._id);
    res.status(201).json({ token, user: selfUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server, vui lòng thử lại" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    if (!user.passwordHash) {
      return res.status(400).json({ message: "Tài khoản này đăng ký bằng Google. Vui lòng bấm \"Tiếp tục với Google\"." });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    const token = generateToken(user._id);
    res.json({ token, user: selfUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server, vui lòng thử lại" });
  }
});

registerGoogleAuth(app, { generateToken, selfUser, handleQuery, escapeRegex });
registerGifRoutes(app, { requireAuth });

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select("-passwordHash");
  if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
  res.json(user);
});

// Cập nhật hồ sơ cá nhân
app.put("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const updates = {};
    const { name, handle, bio, avatarColor, avatarUrl, coverUrl } = req.body;
    if (rejectProfanity(res, name, handle, bio, req.body.school)) return;

    // Chỉ nhận chuỗi rỗng (xoá ảnh) hoặc data URL ảnh, tối đa ~2MB
    for (const [key, value] of Object.entries({ avatarUrl, coverUrl })) {
      if (value === undefined) continue;
      if (value && (!/^data:image\/(jpeg|png|webp);base64,/.test(value) || value.length > 2_000_000)) {
        return res.status(400).json({ message: "Ảnh không hợp lệ hoặc quá lớn" });
      }
      updates[key] = value;
    }

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: "Tên không được để trống" });
      updates.name = name.trim().slice(0, 50);
    }
    if (handle !== undefined) {
      const clean = normalizeHandle(handle);
      if (!HANDLE_RE.test(clean)) return res.status(400).json({ message: HANDLE_RULE });
      const taken = await User.exists({ ...handleQuery(clean), _id: { $ne: req.userId } });
      if (taken) return res.status(409).json({ message: `@${clean} đã có người dùng` });
      updates.handle = clean;
    }
    if (bio !== undefined) updates.bio = bio.trim().slice(0, 160);
    if (avatarColor !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(avatarColor)) return res.status(400).json({ message: "Màu không hợp lệ" });
      updates.avatarColor = avatarColor;
    }
    // Tuổi / vai trò / môn giảng dạy luôn được gửi và kiểm tra cùng nhau
    if (req.body.role !== undefined) {
      const roleCheck = await validateRole(req.body);
      if (roleCheck.error) return res.status(400).json({ message: roleCheck.error });
      Object.assign(updates, roleCheck.value);
    }
    const personal = validatePersonal(req.body);
    if (personal.error) return res.status(400).json({ message: personal.error });
    Object.assign(updates, personal.value);

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server, vui lòng thử lại" });
  }
});

// ---------- Privacy ----------
// visibility: "public" | "friends" (chỉ bạn bè) | "private" (chỉ mình tôi).
// Bài đăng trước khi có tính năng này không có trường visibility → coi là công khai.
// Dùng chung cho bài viết và livestream (đều có authorId/hostId + visibility).

const VISIBILITIES = ["public", "friends", "private"];
const NOT_FOUND_POST = "Bài viết không tồn tại hoặc bạn không có quyền xem";

async function friendIdsOf(userId) {
  if (!userId) return [];
  const me = new mongoose.Types.ObjectId(userId);
  const links = await Friendship.find({ status: "accepted", $or: [{ requesterId: me }, { recipientId: me }] });
  return links.map((f) => (f.requesterId.equals(me) ? f.recipientId : f.requesterId));
}

// Điều kiện Mongo: những bản ghi mà viewer được xem
async function visibleFilter(viewerId, ownerField = "authorId") {
  const isPublic = { visibility: { $nin: ["friends", "private"] } };
  if (!viewerId) return isPublic;
  const me = new mongoose.Types.ObjectId(viewerId);
  return {
    $or: [
      isPublic,
      { [ownerField]: me },
      { visibility: "friends", [ownerField]: { $in: await friendIdsOf(viewerId) } },
    ],
  };
}

async function canView(viewerId, doc, ownerField = "authorId") {
  const owner = doc[ownerField]?._id || doc[ownerField];
  if (!doc.visibility || doc.visibility === "public") return true;
  if (!viewerId) return false;
  if (String(owner) === String(viewerId)) return true;
  if (doc.visibility === "private") return false;
  return !!(await Friendship.exists({
    status: "accepted",
    $or: [
      { requesterId: viewerId, recipientId: owner },
      { requesterId: owner, recipientId: viewerId },
    ],
  }));
}

// Lấy bài viết nếu viewer được xem, không thì null (trả 404 chứ không 403 để không lộ bài có tồn tại)
async function findVisiblePost(viewerId, postId) {
  if (!mongoose.isValidObjectId(postId)) return null;
  const post = await Post.findById(postId);
  return post && (await canView(viewerId, post)) ? post : null;
}

// ---------- Posts ----------

app.get("/api/posts", optionalAuth, async (req, res) => {
  const filter = req.query.subject ? { subject: req.query.subject } : {};
  if (req.query.authorId && mongoose.isValidObjectId(req.query.authorId)) filter.authorId = req.query.authorId;
  if (req.query.type === "question") filter.type = "question";
  if (req.query.resolved === "false") filter.acceptedCommentId = null;
  if (req.query.resolved === "true") filter.acceptedCommentId = { $ne: null };
  const posts = await Post.find({ $and: [filter, await visibleFilter(req.userId)] })
    .populate("authorId", "name handle avatarColor avatarUrl role")
    .sort({ createdAt: -1 });
  res.json(posts);
});

// Xem một bài viết — dùng cho link chia sẻ
app.get("/api/posts/:id", optionalAuth, async (req, res) => {
  const post = await findVisiblePost(req.userId, req.params.id);
  if (!post) return res.status(404).json({ message: NOT_FOUND_POST });
  await post.populate("authorId", "name handle avatarColor avatarUrl role");
  res.json(post);
});

app.post("/api/posts", requireAuth, async (req, res) => {
  const { subject, content, tags } = req.body;
  const type = req.body.type === "question" ? "question" : "post";
  if (!(content || "").trim()) return res.status(400).json({ message: "Nội dung không được để trống" });
  if (rejectProfanity(res, content, ...(Array.isArray(tags) ? tags : []), req.body.lecturer)) return;
  if (!subject || !(await Subject.exists({ label: subject }))) {
    return res.status(400).json({ message: "Vui lòng chọn môn học" });
  }
  const me = await User.findById(req.userId).select("role teachingSubjects");
  if (!(await canPostInSubject(me, subject))) {
    return res.status(403).json({
      message:
        me.role === "giang_vien"
          ? `Bạn chỉ đăng được trong các môn mình dạy. Thêm "${subject}" vào môn giảng dạy ở trang cá nhân nếu cần.`
          : `Môn "${subject}" không dành cho ${me.role === "hoc_sinh" ? "học sinh" : "sinh viên"}.`,
    });
  }

  // Chỉ nhận file do chính người đăng upload; tên/kích thước lấy từ GridFS chứ không tin dữ liệu FE gửi.
  // kind: "photo" = ảnh thường (không vào Thư viện), "document" = tài liệu
  const requested = (req.body.attachments || []).filter((a) => mongoose.isValidObjectId(a?.fileId)).slice(0, 10);
  const kindOf = Object.fromEntries(requested.map((a) => [String(a.fileId), a.kind === "photo" ? "photo" : "document"]));
  const files = requested.length
    ? await mongoose.connection.db
        .collection("uploads.files")
        .find({
          _id: { $in: requested.map((a) => new mongoose.Types.ObjectId(a.fileId)) },
          "metadata.uploaderId": new mongoose.Types.ObjectId(req.userId),
        })
        .toArray()
    : [];
  const order = requested.map((a) => String(a.fileId));
  files.sort((a, b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id)));
  const attachments = files.map((f) => ({
    fileId: f._id,
    name: f.filename,
    mimeType: f.metadata.mimeType,
    size: f.length,
    // PDF luôn là tài liệu
    kind: f.metadata.mimeType === "application/pdf" ? "document" : kindOf[String(f._id)],
  }));

  // Nội dung (kèm tên file) lệch hẳn sang môn khác → trả 409 để FE hiện cảnh báo.
  // Người dùng xác nhận "vẫn đăng" thì gửi lại kèm ignoreSubjectWarning, bài được đánh dấu subjectMismatch.
  const check = await roleAwareCheck(me, [content, ...attachments.map((a) => a.name)].join(" "), subject);
  if (!check.ok && !req.body.ignoreSubjectWarning) {
    return res.status(409).json({
      code: "SUBJECT_MISMATCH",
      message: `Nội dung có vẻ thuộc nhóm môn ${check.groupName}, không phải ${subject}.`,
      ...check,
    });
  }

  const post = await Post.create({
    authorId: req.userId,
    subject,
    content,
    tags,
    type,
    attachments,
    semester: (req.body.semester || "").trim().slice(0, 40),
    lecturer: (req.body.lecturer || "").trim().slice(0, 60),
    subjectMismatch: !check.ok,
    visibility: VISIBILITIES.includes(req.body.visibility) ? req.body.visibility : "public",
  });
  res.status(201).json(post);
});

// Như checkSubject, nhưng chỉ gợi ý môn mà người dùng được phép đăng (theo vai trò).
// Môn gợi ý không hợp lệ → thử môn mặc định của nhóm, vẫn không được thì bỏ gợi ý (chỉ cảnh báo).
async function roleAwareCheck(user, content, subject) {
  const check = checkSubject(content, subject);
  if (check.ok) return check;
  for (const candidate of [check.suggestion, check.fallback]) {
    if (candidate && (await canPostInSubject(user, candidate))) return { ...check, suggestion: candidate };
  }
  return { ...check, suggestion: null };
}

// Kiểm tra nhanh khi người dùng đang gõ (FE gọi có debounce), không lưu gì
app.post("/api/subjects/check", requireAuth, async (req, res) => {
  const { content = "", subject = "" } = req.body;
  if (!subject || content.length > 20000) return res.json({ ok: true });
  const me = await User.findById(req.userId).select("role teachingSubjects");
  res.json(await roleAwareCheck(me, content, subject));
});

// Chọn / bỏ chọn câu trả lời hay nhất — chỉ người hỏi, chỉ với bài dạng câu hỏi
app.post("/api/posts/:id/accept/:commentId", requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id).catch(() => null);
  if (!post) return res.status(404).json({ message: "Không tìm thấy bài viết" });
  if (post.type !== "question") return res.status(400).json({ message: "Chỉ câu hỏi mới chọn được câu trả lời hay nhất" });
  if (post.authorId.toString() !== req.userId) {
    return res.status(403).json({ message: "Chỉ người đặt câu hỏi mới được chọn câu trả lời hay nhất" });
  }

  const comment = await Comment.findOne({ _id: req.params.commentId, postId: post._id }).catch(() => null);
  if (!comment) return res.status(404).json({ message: "Không tìm thấy câu trả lời" });

  // Bấm lại vào câu đang được chọn = bỏ chọn
  const unaccept = post.acceptedCommentId?.equals(comment._id);
  post.acceptedCommentId = unaccept ? null : comment._id;
  await post.save();

  if (!unaccept) {
    await notify({
      userId: comment.authorId,
      actorId: req.userId,
      postId: post._id,
      type: "answer_accepted",
      text: "đã chọn câu trả lời của bạn là hay nhất ✓",
    });
  }
  res.json({ acceptedCommentId: post.acceptedCommentId });
});

// Sửa bài viết — chỉ chủ bài viết mới được sửa
app.put("/api/posts/:id", requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Không tìm thấy bài viết" });
  if (post.authorId.toString() !== req.userId) {
    return res.status(403).json({ message: "Bạn không có quyền sửa bài viết này" });
  }

  const { content, subject, tags } = req.body;
  if (rejectProfanity(res, content, ...(Array.isArray(tags) ? tags : []))) return;
  if (content !== undefined) post.content = content;
  if (subject !== undefined) post.subject = subject;
  if (tags !== undefined) post.tags = tags;
  if (req.body.visibility !== undefined) {
    if (!VISIBILITIES.includes(req.body.visibility)) return res.status(400).json({ message: "Quyền riêng tư không hợp lệ" });
    post.visibility = req.body.visibility;
  }
  await post.save();

  const populated = await post.populate("authorId", "name handle avatarColor avatarUrl role");
  res.json(populated);
});

// Xóa bài viết — chỉ chủ bài viết mới được xóa, kèm xóa comment/like liên quan
app.delete("/api/posts/:id", requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Không tìm thấy bài viết" });
  if (post.authorId.toString() !== req.userId) {
    return res.status(403).json({ message: "Bạn không có quyền xóa bài viết này" });
  }

  // Ảnh trong bình luận cũng xoá theo
  const commentFiles = await Comment.find({ postId: post._id, "media.fileId": { $ne: null } }).distinct("media.fileId");
  await Promise.all([
    post.deleteOne(),
    Comment.deleteMany({ postId: post._id }),
    ...commentFiles.map((id) => uploads().delete(id).catch(() => {})),
    Like.deleteMany({ postId: post._id }),
    ...post.attachments.map((a) => uploads().delete(a.fileId).catch(() => {})),
  ]);
  res.json({ success: true });
});

// ---------- Subjects ----------

// Không có q: các môn có nhiều bài nhất. Có q: tìm theo tên, không cần gõ dấu,
// tên bắt đầu bằng q (hoặc có một từ bắt đầu bằng q) được xếp lên đầu.
// Đăng nhập rồi thì chỉ trả các môn hợp với vai trò (học sinh: phổ thông, sinh viên: đại học,
// giảng viên: môn mình dạy). ?all=1 để lấy tất cả (vd. lúc giảng viên chọn môn dạy, lọc Thư viện).
app.get("/api/subjects", optionalAuth, async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const q = normalizeText(req.query.q);

  const me = req.userId && !req.query.all ? await User.findById(req.userId).select("role teachingSubjects") : null;
  const scope = subjectFilterFor(me);

  const counts = await Post.aggregate([{ $group: { _id: "$subject", n: { $sum: 1 } } }]);
  const countOf = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const shape = (s) => ({ _id: s._id, name: s.name, label: s.label, level: s.level, postCount: countOf[s.label] || 0 });

  if (!q) {
    const all = await Subject.find(scope).lean();
    all.sort((a, b) => (countOf[b.label] || 0) - (countOf[a.label] || 0) || a.label.localeCompare(b.label));
    return res.json(all.slice(0, limit).map(shape));
  }

  const found = await Subject.find({ ...scope, search: new RegExp(escapeRegex(q)) }).limit(100).lean();
  const rank = (s) => (s.search.startsWith(q) ? 0 : s.search.includes(` ${q}`) ? 1 : 2);
  found.sort((a, b) => rank(a) - rank(b) || (countOf[b.label] || 0) - (countOf[a.label] || 0));
  res.json(found.slice(0, limit).map(shape));
});

// Người dùng thêm môn chưa có. Trùng tên (không phân biệt dấu, hoa thường) thì trả về môn sẵn có.
app.post("/api/subjects", requireAuth, async (req, res) => {
  const name = (req.body.name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: "Tên môn dài 2–80 ký tự" });
  if (rejectProfanity(res, name)) return;

  const me = await User.findById(req.userId).select("role teachingSubjects");
  let subject = await Subject.findOne({ search: normalizeText(name) });
  const existed = !!subject;

  if (!subject) {
    // Viết hoa chữ cái đầu cho đồng đều với danh sách có sẵn ("khoa học" → "Khoa học")
    subject = await Subject.create({
      name: name[0].toUpperCase() + name.slice(1),
      level: levelForNewSubject(me),
      createdBy: req.userId,
    });
  } else if (me?.role !== "giang_vien" && !(await canPostInSubject(me, subject.label))) {
    // Môn đã có nhưng thuộc cấp học khác, mà người dùng cấp này cũng cần → chuyển thành môn dùng chung
    subject.level = "both";
    await subject.save();
  }

  // Giảng viên thêm môn = nhận dạy môn đó luôn
  if (me?.role === "giang_vien" && !me.teachingSubjects.includes(subject.label)) {
    if (me.teachingSubjects.length >= 10) return res.status(400).json({ message: "Giảng viên dạy tối đa 10 môn" });
    me.teachingSubjects.push(subject.label);
    await me.save();
  }

  res.status(existed ? 200 : 201).json({ ...subject.toObject(), existed });
});

// ---------- Files (GridFS) ----------

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
const uploads = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });

// FE gửi thẳng nội dung file trong body (không multipart), tên file ở header X-File-Name
app.post(
  "/api/files",
  requireAuth,
  express.raw({ type: () => true, limit: MAX_FILE_SIZE }),
  async (req, res) => {
    const mimeType = (req.headers["content-type"] || "").split(";")[0];
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return res.status(400).json({ message: "Chỉ hỗ trợ file PDF hoặc ảnh (JPG, PNG, WebP, GIF)" });
    }
    if (!req.body?.length) return res.status(400).json({ message: "File rỗng" });

    let name = "tai-lieu";
    try {
      name = decodeURIComponent(req.headers["x-file-name"] || name).slice(0, 200);
    } catch {
      // giữ tên mặc định nếu header không giải mã được
    }

    const stream = uploads().openUploadStream(name, {
      metadata: { uploaderId: new mongoose.Types.ObjectId(req.userId), mimeType },
    });
    stream.end(req.body);
    stream.on("error", () => res.status(500).json({ message: "Không lưu được file" }));
    stream.on("finish", () =>
      res.status(201).json({ fileId: stream.id, name, mimeType, size: req.body.length })
    );
  }
);

// Ai cũng xem được vì file gắn với bài đăng công khai; ?download=1 để tải về thay vì xem trực tiếp
app.get("/api/files/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const id = new mongoose.Types.ObjectId(req.params.id);
  const file = await mongoose.connection.db.collection("uploads.files").findOne({ _id: id });
  if (!file) return res.status(404).json({ message: "File không tồn tại hoặc đã bị xoá" });

  const disposition = req.query.download ? "attachment" : "inline";
  res.set({
    "Content-Type": file.metadata?.mimeType || "application/octet-stream",
    "Content-Length": file.length,
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  uploads().openDownloadStream(id).pipe(res);
});

// ---------- Library ----------

// Mỗi file đính kèm là một "tài liệu"; lọc theo môn, học kỳ, giảng viên, loại file, từ khoá
app.get("/api/library", optionalAuth, async (req, res) => {
  const { subject, semester, lecturer, type, q } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const PAGE_SIZE = 24;

  // Chỉ tính file là tài liệu; ảnh thường (kind = "photo") không vào Thư viện.
  // Tài liệu trong bài "chỉ bạn bè"/"chỉ mình tôi" chỉ hiện với người được xem bài đó.
  const postMatch = {
    attachments: { $elemMatch: { kind: { $ne: "photo" } } },
    $and: [await visibleFilter(req.userId)],
  };
  if (subject) postMatch.subject = subject;
  if (semester) postMatch.semester = semester;
  if (lecturer) postMatch.lecturer = new RegExp(`^${escapeRegex(lecturer)}$`, "i");

  const fileMatch = {};
  if (type === "pdf") fileMatch["attachments.mimeType"] = "application/pdf";
  if (type === "image") fileMatch["attachments.mimeType"] = { $regex: "^image/" };
  if (q?.trim()) {
    const re = new RegExp(escapeRegex(q.trim()), "i");
    fileMatch.$or = [{ "attachments.name": re }, { content: re }, { lecturer: re }];
  }

  const [result] = await Post.aggregate([
    { $match: postMatch },
    { $unwind: "$attachments" },
    { $match: { "attachments.kind": { $ne: "photo" } } },
    { $match: fileMatch },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        total: [{ $count: "n" }],
        items: [
          { $skip: (page - 1) * PAGE_SIZE },
          { $limit: PAGE_SIZE },
          { $lookup: { from: "users", localField: "authorId", foreignField: "_id", as: "author" } },
          { $addFields: { author: { $arrayElemAt: ["$author", 0] } } },
          {
            $project: {
              _id: "$attachments.fileId",
              name: "$attachments.name",
              mimeType: "$attachments.mimeType",
              size: "$attachments.size",
              postId: "$_id",
              subject: 1,
              semester: 1,
              lecturer: 1,
              createdAt: 1,
              // Chỉ lấy trường công khai, không để lộ email/passwordHash
              author: { _id: 1, name: 1, handle: 1, avatarUrl: 1, avatarColor: 1, role: 1 },
            },
          },
        ],
      },
    },
  ]);

  const total = result.total[0]?.n || 0;
  res.json({ items: result.items, total, page, hasMore: page * PAGE_SIZE < total });
});

// Danh sách giá trị để đổ vào các ô lọc, kèm số tài liệu mỗi giá trị
app.get("/api/library/facets", optionalAuth, async (req, res) => {
  const countBy = (field) => [
    { $match: { [field]: { $nin: ["", null] } } },
    { $group: { _id: `$${field}`, count: { $sum: { $size: { $filter: { input: "$attachments", cond: { $ne: ["$$this.kind", "photo"] } } } } } } },
    { $sort: { count: -1, _id: 1 } },
  ];
  const [facets] = await Post.aggregate([
    { $match: { attachments: { $elemMatch: { kind: { $ne: "photo" } } }, $and: [await visibleFilter(req.userId)] } },
    { $facet: { subjects: countBy("subject"), semesters: countBy("semester"), lecturers: countBy("lecturer") } },
  ]);
  const shape = (rows) => rows.map((r) => ({ value: r._id, count: r.count }));
  res.json({
    subjects: shape(facets.subjects),
    semesters: shape(facets.semesters),
    lecturers: shape(facets.lecturers),
  });
});

app.post("/api/posts/:id/like", requireAuth, async (req, res) => {
  const userId = req.userId;
  const postId = req.params.id;
  if (!(await findVisiblePost(userId, postId))) return res.status(404).json({ message: NOT_FOUND_POST });
  const existing = await Like.findOne({ postId, userId });
  if (existing) {
    await existing.deleteOne();
    await Post.findByIdAndUpdate(postId, { $inc: { likeCount: -1 } });
    return res.json({ liked: false });
  }
  await Like.create({ postId, userId });
  const post = await Post.findByIdAndUpdate(postId, { $inc: { likeCount: 1 } });
  if (post) {
    await notify({ userId: post.authorId, actorId: userId, postId, type: "like", text: "đã thích bài viết của bạn" });
  }
  res.json({ liked: true });
});

// ---------- Comments ----------

app.get("/api/posts/:id/comments", optionalAuth, async (req, res) => {
  if (!(await findVisiblePost(req.userId, req.params.id))) return res.status(404).json({ message: NOT_FOUND_POST });
  const comments = await Comment.find({ postId: req.params.id })
    .populate("authorId", "name handle avatarColor avatarUrl role")
    .sort({ createdAt: 1 });
  res.json(comments);
});

app.post("/api/posts/:id/comments", requireAuth, async (req, res) => {
  const content = (req.body.content || "").trim();
  const { media, error } = await parseMedia(req.userId, req.body.media);
  if (error) return res.status(400).json({ message: error });
  if (!content && !media) return res.status(400).json({ message: "Bình luận không được để trống" });
  if (content.length > 1000) return res.status(400).json({ message: "Bình luận tối đa 1000 ký tự" });
  if (rejectProfanity(res, content)) return;

  if (!(await findVisiblePost(req.userId, req.params.id))) return res.status(404).json({ message: NOT_FOUND_POST });
  const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 } });
  if (!post) return res.status(404).json({ message: "Không tìm thấy bài viết" });

  const comment = await Comment.create({ postId: post._id, authorId: req.userId, content, media });
  const preview = content ? (content.length > 60 ? `${content.slice(0, 60)}…` : content) : mediaLabel(media);
  const verb = post.type === "question" ? "đã trả lời câu hỏi của bạn" : "đã bình luận";
  await notify({ userId: post.authorId, actorId: req.userId, postId: post._id, type: "comment", text: `${verb}: "${preview}"` });

  await comment.populate("authorId", "name handle avatarColor avatarUrl role");
  res.status(201).json(comment);
});

// Sửa bình luận — chỉ người viết bình luận
app.put("/api/comments/:id", requireAuth, async (req, res) => {
  const content = (req.body.content || "").trim();
  if (content.length > 1000) return res.status(400).json({ message: "Bình luận tối đa 1000 ký tự" });
  if (rejectProfanity(res, content)) return;

  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ message: "Không tìm thấy bình luận" });
  if (comment.authorId.toString() !== req.userId) {
    return res.status(403).json({ message: "Bạn không có quyền sửa bình luận này" });
  }
  if (!content && !comment.media) return res.status(400).json({ message: "Bình luận không được để trống" });

  comment.content = content;
  comment.edited = true;
  await comment.save();
  await comment.populate("authorId", "name handle avatarColor avatarUrl role");
  res.json(comment);
});

// Xóa bình luận — người viết bình luận hoặc chủ bài viết mới được xóa
app.delete("/api/comments/:id", requireAuth, async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ message: "Không tìm thấy bình luận" });
  const post = await Post.findById(comment.postId);
  const canDelete =
    comment.authorId.toString() === req.userId || (post && post.authorId.toString() === req.userId);
  if (!canDelete) return res.status(403).json({ message: "Bạn không có quyền xóa bình luận này" });

  await comment.deleteOne();
  if (comment.media?.fileId) uploads().delete(comment.media.fileId).catch(() => {});
  if (post) {
    // Xoá đúng câu trả lời hay nhất thì câu hỏi quay về trạng thái chưa giải quyết
    const update = { $inc: { commentCount: -1 } };
    if (post.acceptedCommentId?.equals(comment._id)) update.$set = { acceptedCommentId: null };
    await Post.updateOne({ _id: post._id }, update);
  }
  res.json({ success: true });
});

// ---------- Users ----------

const USER_CARD = "name handle avatarColor avatarUrl bio role";

// Trạng thái bạn bè giữa mình và từng người trong danh sách:
// "friends" | "outgoing" (mình đã gửi lời mời) | "incoming" (họ gửi cho mình) | "none"
async function friendStatuses(meId, userIds) {
  const links = await Friendship.find({
    $or: [
      { requesterId: meId, recipientId: { $in: userIds } },
      { recipientId: meId, requesterId: { $in: userIds } },
    ],
  });
  const map = {};
  for (const f of links) {
    const iAmRequester = f.requesterId.toString() === meId;
    const other = (iAmRequester ? f.recipientId : f.requesterId).toString();
    map[other] = f.status === "accepted" ? "friends" : iAmRequester ? "outgoing" : "incoming";
  }
  return map;
}

async function withFriendStatus(meId, users) {
  const map = await friendStatuses(meId, users.map((u) => u._id));
  return users.map((u) => ({ ...u.toObject(), friendStatus: map[u._id.toString()] || "none" }));
}

// Tìm người dùng thật. Gõ "@abc" → chỉ tìm theo username bắt đầu bằng "abc";
// gõ "abc" → tìm trong cả tên hiển thị lẫn username. Username khớp đúng được xếp lên đầu.
app.get("/api/users/search", requireAuth, async (req, res) => {
  const raw = (req.query.q || "").trim();
  const byHandleOnly = raw.startsWith("@");
  const q = raw.replace(/^@/, "");
  if (!q) return res.json([]);

  const contains = new RegExp(escapeRegex(q), "i");
  const filter = byHandleOnly
    ? { handle: new RegExp(`^${escapeRegex(q)}`, "i") }
    : { $or: [{ name: contains }, { handle: contains }] };

  const users = await User.find({ ...filter, _id: { $ne: req.userId } }).select(USER_CARD).limit(20);
  const lower = q.toLowerCase();
  const rank = (u) => {
    const h = u.handle.toLowerCase();
    if (h === lower) return 0;
    if (h.startsWith(lower)) return 1;
    if (u.name.toLowerCase().startsWith(lower)) return 2;
    return 3;
  };
  users.sort((a, b) => rank(a) - rank(b));
  res.json(await withFriendStatus(req.userId, users.slice(0, 10)));
});

app.get("/api/users/handle/:handle", async (req, res) => {
  const user = await User.findOne(handleQuery(normalizeHandle(req.params.handle))).select(USER_CARD);
  if (!user) return res.status(404).json({ message: "Người dùng này chưa có tài khoản Góc Học" });
  res.json(user);
});

app.get("/api/users/:id", async (req, res) => {
  const user = await User.findById(req.params.id).select(USER_CARD).catch(() => null);
  if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
  res.json(user);
});

// Trang cá nhân của người khác: thông tin + số liệu + trạng thái bạn bè với mình
app.get("/api/users/:id/profile", requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Không tìm thấy người dùng" });
  const user = await User.findById(req.params.id).select(`${USER_CARD} coverUrl teachingSubjects school`);
  if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

  const [postCount, friendCount, statuses] = await Promise.all([
    visibleFilter(req.userId).then((v) => Post.countDocuments({ $and: [{ authorId: user._id }, v] })),
    Friendship.countDocuments({ status: "accepted", $or: [{ requesterId: user._id }, { recipientId: user._id }] }),
    friendStatuses(req.userId, [user._id]),
  ]);
  res.json({
    ...user.toObject(),
    postCount,
    friendCount,
    friendStatus: user._id.toString() === req.userId ? "self" : statuses[user._id.toString()] || "none",
  });
});

// ---------- Friends ----------

function pairFilter(a, b) {
  return {
    $or: [
      { requesterId: a, recipientId: b },
      { requesterId: b, recipientId: a },
    ],
  };
}

app.get("/api/friends", requireAuth, async (req, res) => {
  const links = await Friendship.find({
    status: "accepted",
    $or: [{ requesterId: req.userId }, { recipientId: req.userId }],
  })
    .populate("requesterId recipientId", USER_CARD)
    .sort({ updatedAt: -1 });
  res.json(
    links
      .map((f) => (f.requesterId?._id.toString() === req.userId ? f.recipientId : f.requesterId))
      .filter(Boolean) // bỏ qua tài khoản đã bị xoá
      .map((u) => ({ ...u.toObject(), friendStatus: "friends" }))
  );
});

// Lời mời mình đã gửi, đang chờ người kia chấp nhận
app.get("/api/friends/sent", requireAuth, async (req, res) => {
  const links = await Friendship.find({ requesterId: req.userId, status: "pending" })
    .populate("recipientId", USER_CARD)
    .sort({ createdAt: -1 });
  res.json(links.filter((f) => f.recipientId).map((f) => ({ ...f.recipientId.toObject(), friendStatus: "outgoing" })));
});

// Lời mời kết bạn người khác gửi cho mình
app.get("/api/friends/requests", requireAuth, async (req, res) => {
  const links = await Friendship.find({ recipientId: req.userId, status: "pending" })
    .populate("requesterId", USER_CARD)
    .sort({ createdAt: -1 });
  res.json(links.filter((f) => f.requesterId).map((f) => ({ ...f.requesterId.toObject(), friendStatus: "incoming" })));
});

// Gợi ý kết bạn có xếp hạng. Mỗi người được cộng điểm theo:
//   bạn chung (×3), đã tương tác với bài của mình hoặc mình với bài của họ (×2), cùng môn học (×1)
// Thiếu người có điểm thì lấp bằng thành viên mới. ?skip=id1,id2 để bỏ qua người đã ẩn ở FE.
app.get("/api/friends/suggestions", requireAuth, async (req, res) => {
  const LIMIT = 5;
  const me = new mongoose.Types.ObjectId(req.userId);
  const skip = (req.query.skip || "").split(",").filter(mongoose.isValidObjectId);

  const links = await Friendship.find({ $or: [{ requesterId: me }, { recipientId: me }] });
  const other = (f) => (f.requesterId.equals(me) ? f.recipientId : f.requesterId);
  const myFriends = links.filter((f) => f.status === "accepted").map(other);
  const excluded = new Set([me, ...links.map(other)].map(String).concat(skip));

  const scores = {}; // id → { score, mutual, subjects:Set, interacted }
  const bump = (id, key, points, extra) => {
    id = String(id);
    if (excluded.has(id)) return;
    const s = (scores[id] ||= { score: 0, mutual: 0, subjects: new Set(), interacted: false });
    s.score += points;
    if (key === "mutual") s.mutual++;
    if (key === "subject") s.subjects.add(extra);
    if (key === "interacted") s.interacted = true;
  };

  const myPosts = await Post.find({ authorId: me }).select("_id subject");
  const myPostIds = myPosts.map((p) => p._id);
  const mySubjects = [...new Set(myPosts.map((p) => p.subject))];

  const [friendsOfFriends, commenters, likers, myCommentPostIds, sameSubject] = await Promise.all([
    myFriends.length
      ? Friendship.find({
          status: "accepted",
          $or: [{ requesterId: { $in: myFriends } }, { recipientId: { $in: myFriends } }],
        })
      : [],
    Comment.distinct("authorId", { postId: { $in: myPostIds } }),
    Like.distinct("userId", { postId: { $in: myPostIds } }),
    Comment.distinct("postId", { authorId: me }),
    mySubjects.length
      ? Post.aggregate([
          { $match: { subject: { $in: mySubjects }, authorId: { $ne: me } } },
          { $group: { _id: { author: "$authorId", subject: "$subject" } } },
        ])
      : [],
  ]);

  const friendSet = new Set(myFriends.map(String));
  for (const f of friendsOfFriends) {
    // Cạnh bạn–của–bạn: đầu nào không phải bạn mình thì đó là ứng viên
    const [a, b] = [String(f.requesterId), String(f.recipientId)];
    if (friendSet.has(a) && !friendSet.has(b)) bump(b, "mutual", 3);
    if (friendSet.has(b) && !friendSet.has(a)) bump(a, "mutual", 3);
  }
  const theirAuthors = await Post.distinct("authorId", { _id: { $in: myCommentPostIds } });
  for (const id of new Set([...commenters, ...likers, ...theirAuthors].map(String))) bump(id, "interacted", 2);
  for (const row of sameSubject) bump(row._id.author, "subject", 1, row._id.subject);

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, LIMIT);

  const fields = "name handle avatarColor avatarUrl bio createdAt";
  let users = await User.find({ _id: { $in: ranked.map(([id]) => id) } }).select(fields);
  const byId = Object.fromEntries(users.map((u) => [String(u._id), u]));
  users = ranked.map(([id]) => byId[id]).filter(Boolean);

  if (users.length < LIMIT) {
    const taken = [...excluded, ...users.map((u) => String(u._id))];
    const newcomers = await User.find({ _id: { $nin: taken } })
      .select(fields)
      .sort({ createdAt: -1 })
      .limit(LIMIT - users.length);
    users.push(...newcomers);
  }

  const reasonOf = (s) => {
    if (!s) return "Thành viên mới";
    if (s.mutual) return `${s.mutual} bạn chung`;
    if (s.interacted) return "Đã tương tác với bạn";
    return `Cũng học ${[...s.subjects].slice(0, 2).join(", ")}`;
  };

  res.json(
    users.map((u) => ({
      ...u.toObject(),
      friendStatus: "none",
      reason: reasonOf(scores[String(u._id)]),
    }))
  );
});

// Gửi lời mời. Nếu người kia đã gửi lời mời cho mình trước thì coi như chấp nhận luôn.
app.post("/api/friends/:userId", requireAuth, async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId) || userId === req.userId) {
    return res.status(400).json({ message: "Người dùng không hợp lệ" });
  }
  if (!(await User.exists({ _id: userId }))) return res.status(404).json({ message: "Không tìm thấy người dùng" });

  const existing = await Friendship.findOne(pairFilter(req.userId, userId));
  if (existing?.status === "accepted") return res.json({ friendStatus: "friends" });
  if (existing && existing.requesterId.toString() === req.userId) return res.json({ friendStatus: "outgoing" });

  if (existing) {
    existing.status = "accepted";
    await existing.save();
    await notify({ userId, actorId: req.userId, type: "friend_accept", text: "đã chấp nhận lời mời kết bạn" });
    return res.json({ friendStatus: "friends" });
  }

  await Friendship.create({ requesterId: req.userId, recipientId: userId });
  await notify({ userId, actorId: req.userId, type: "friend_request", text: "đã gửi cho bạn lời mời kết bạn" });
  res.status(201).json({ friendStatus: "outgoing" });
});

app.post("/api/friends/:userId/accept", requireAuth, async (req, res) => {
  const link = await Friendship.findOne({ requesterId: req.params.userId, recipientId: req.userId, status: "pending" });
  if (!link) return res.status(404).json({ message: "Lời mời không còn tồn tại" });
  link.status = "accepted";
  await link.save();
  await notify({ userId: req.params.userId, actorId: req.userId, type: "friend_accept", text: "đã chấp nhận lời mời kết bạn" });
  res.json({ friendStatus: "friends" });
});

// Dùng chung cho: huỷ lời mời đã gửi, từ chối lời mời, huỷ kết bạn
app.delete("/api/friends/:userId", requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Người dùng không hợp lệ" });
  await Friendship.deleteOne(pairFilter(req.userId, req.params.userId));
  res.json({ friendStatus: "none" });
});

// ---------- Follow ----------

app.post("/api/users/:id/follow", requireAuth, async (req, res) => {
  const followerId = req.userId;
  const followingId = req.params.id;
  const existing = await Follow.findOne({ followerId, followingId });
  if (existing) {
    await existing.deleteOne();
    return res.json({ following: false });
  }
  await Follow.create({ followerId, followingId });
  await notify({ userId: followingId, actorId: followerId, type: "follow", text: "bắt đầu theo dõi bạn" });
  res.json({ following: true });
});

app.get("/api/users/:id/followers", async (req, res) => {
  const follows = await Follow.find({ followingId: req.params.id }).populate("followerId", "name handle avatarColor avatarUrl role");
  res.json(follows.map((f) => f.followerId));
});

app.get("/api/users/:id/following", async (req, res) => {
  const follows = await Follow.find({ followerId: req.params.id }).populate("followingId", "name handle avatarColor avatarUrl role");
  res.json(follows.map((f) => f.followingId));
});

// ---------- Groups ----------

app.get("/api/groups", async (req, res) => {
  const filter = req.query.subject ? { subject: req.query.subject } : {};
  const groups = await Group.find(filter).populate("memberIds", "name handle avatarColor avatarUrl role");
  res.json(groups);
});

app.post("/api/groups", requireAuth, async (req, res) => {
  const { name, subject } = req.body;
  if (rejectProfanity(res, name)) return;
  const group = await Group.create({ name, subject, memberIds: [req.userId] });
  res.status(201).json(group);
});

app.post("/api/groups/:id/join", requireAuth, async (req, res) => {
  const userId = req.userId;
  const group = await Group.findById(req.params.id);
  if (!group) return res.status(404).json({ message: "Không tìm thấy nhóm" });
  const isMember = group.memberIds.some((m) => m.toString() === userId);
  if (isMember) {
    group.memberIds = group.memberIds.filter((m) => m.toString() !== userId);
  } else {
    group.memberIds.push(userId);
  }
  await group.save();
  res.json({ joined: !isMember });
});

// ---------- Messages ----------

const USER_PUBLIC = "name handle avatarColor avatarUrl role";

// Danh sách hội thoại: tin nhắn mới nhất + số tin chưa đọc với từng người
app.get("/api/conversations", requireAuth, async (req, res) => {
  const me = new mongoose.Types.ObjectId(req.userId);
  const rows = await Message.aggregate([
    { $match: { $or: [{ senderId: me }, { receiverId: me }] } },
    { $sort: { createdAt: -1 } },
    { $addFields: { partnerId: { $cond: [{ $eq: ["$senderId", me] }, "$receiverId", "$senderId"] } } },
    {
      $group: {
        _id: "$partnerId",
        lastMessage: { $first: "$content" },
        lastMedia: { $first: "$media.kind" },
        lastSenderId: { $first: "$senderId" },
        lastAt: { $first: "$createdAt" },
        unread: {
          $sum: { $cond: [{ $and: [{ $eq: ["$receiverId", me] }, { $ne: ["$isRead", true] }] }, 1, 0] },
        },
      },
    },
    { $sort: { lastAt: -1 } },
    { $limit: 50 },
  ]);

  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select(USER_PUBLIC);
  const byId = Object.fromEntries(users.map((u) => [u._id.toString(), u]));
  res.json(
    rows
      .filter((r) => byId[r._id.toString()])
      .map((r) => ({
        user: byId[r._id.toString()],
        lastMessage: r.lastMessage || mediaLabel(r.lastMedia && { kind: r.lastMedia }),
        lastFromMe: r.lastSenderId.toString() === req.userId,
        lastAt: r.lastAt,
        unread: r.unread,
      }))
  );
});

app.get("/api/conversations/unread-count", requireAuth, async (req, res) => {
  const count = await Message.countDocuments({ receiverId: req.userId, isRead: { $ne: true } });
  res.json({ count });
});

// Tin nhắn với một người. ?after=<ISO> chỉ lấy tin mới (dùng khi polling),
// ?before=<ISO> lấy trang cũ hơn. Đồng thời đánh dấu tin của họ gửi mình là đã đọc.
app.get("/api/messages/:otherUserId", requireAuth, async (req, res) => {
  const { otherUserId } = req.params;
  if (!mongoose.isValidObjectId(otherUserId)) return res.status(400).json({ message: "Người nhận không hợp lệ" });

  const filter = {
    $or: [
      { senderId: req.userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: req.userId },
    ],
  };
  const limit = 30;
  let messages;
  let hasMore = false;

  if (req.query.after) {
    messages = await Message.find({ ...filter, createdAt: { $gt: new Date(req.query.after) } }).sort({ createdAt: 1 });
  } else {
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };
    messages = await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1);
    hasMore = messages.length > limit;
    messages = messages.slice(0, limit).reverse();
  }

  await Message.updateMany(
    { senderId: otherUserId, receiverId: req.userId, isRead: { $ne: true } },
    { isRead: true }
  );
  res.json({ messages, hasMore });
});

app.post("/api/messages", requireAuth, async (req, res) => {
  const { receiverId } = req.body;
  const content = maskProfanity((req.body.content || "").trim());
  const { media, error } = await parseMedia(req.userId, req.body.media);
  if (error) return res.status(400).json({ message: error });
  if (!content && !media) return res.status(400).json({ message: "Tin nhắn không được để trống" });
  if (content.length > 2000) return res.status(400).json({ message: "Tin nhắn tối đa 2000 ký tự" });
  if (!mongoose.isValidObjectId(receiverId) || receiverId === req.userId) {
    return res.status(400).json({ message: "Người nhận không hợp lệ" });
  }
  if (!(await User.exists({ _id: receiverId }))) {
    return res.status(404).json({ message: "Không tìm thấy người nhận" });
  }
  const message = await Message.create({ senderId: req.userId, receiverId, content, media });
  res.status(201).json(message);
});

// ---------- Notifications ----------

// Tạo thông báo — bỏ qua khi tự tương tác với chính mình
async function notify({ userId, actorId, postId, liveId, type, text }) {
  if (!userId || userId.toString() === actorId.toString()) return;
  await Notification.create({ userId, actorId, postId, liveId, type, text });
}

// Chỉ người dùng đang đăng nhập mới xem/đánh dấu được thông báo của chính mình
app.get("/api/notifications", requireAuth, async (req, res) => {
  const notifs = await Notification.find({ userId: req.userId })
    .populate("actorId", "name handle avatarColor avatarUrl role")
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(notifs);
});

app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
  await Notification.updateMany({ userId: req.userId, isRead: false }, { isRead: true });
  res.json({ success: true });
});

app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.userId }, { isRead: true });
  res.json({ success: true });
});

// ---------- Livestream ----------

registerLiveRoutes(app, { requireAuth, optionalAuth, canView, visibleFilter, friendIdsOf, notify });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server chạy tại http://localhost:${PORT}`));
