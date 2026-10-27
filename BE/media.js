import mongoose from "mongoose";

// Ảnh / GIF kèm trong bình luận và tin nhắn.
// FE gửi media = { kind: "image", fileId } (ảnh vừa tải lên qua /api/files)
//            hoặc { kind: "gif", url, width, height } (GIF chọn từ GIPHY).

// Chỉ nhận link GIF của GIPHY, không cho nhúng ảnh từ trang bất kỳ
const GIF_URL_RE = /^https:\/\/(media\d*|i)\.giphy\.com\/[^\s"'<>]+$/;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const size = (n) => (Number.isFinite(+n) && +n > 0 && +n < 5000 ? Math.round(+n) : null);

// Trả về { media } (null nếu không gửi kèm) hoặc { error }
export async function parseMedia(userId, raw) {
  if (!raw) return { media: null };
  if (raw.kind === "gif" && typeof raw.url === "string" && raw.url.length < 1000 && GIF_URL_RE.test(raw.url)) {
    return { media: { kind: "gif", url: raw.url, width: size(raw.width), height: size(raw.height) } };
  }
  if (raw.kind === "image" && mongoose.isValidObjectId(raw.fileId)) {
    // Chỉ dùng được ảnh do chính mình tải lên
    const file = await mongoose.connection.db.collection("uploads.files").findOne({
      _id: new mongoose.Types.ObjectId(raw.fileId),
      "metadata.uploaderId": new mongoose.Types.ObjectId(userId),
    });
    if (file && IMAGE_TYPES.includes(file.metadata?.mimeType)) {
      return {
        media: { kind: "image", fileId: file._id, mimeType: file.metadata.mimeType, width: size(raw.width), height: size(raw.height) },
      };
    }
  }
  return { error: "Ảnh hoặc GIF không hợp lệ, vui lòng chọn lại" };
}

// Chữ thay thế khi tin/bình luận chỉ có ảnh (danh sách hội thoại, thông báo)
export function mediaLabel(media) {
  if (!media) return "";
  return media.kind === "gif" ? "[GIF]" : "[Ảnh]";
}

// Tìm GIF qua GIPHY (BE gọi hộ để không lộ API key ra trình duyệt).
// Cần GIPHY_API_KEY trong BE/.env (developers.giphy.com → Create an App → API).
export function registerGifRoutes(app, { requireAuth }) {
  app.get("/api/gifs", requireAuth, async (req, res) => {
    const key = process.env.GIPHY_API_KEY;
    if (!key) {
      return res.status(503).json({ message: "Tìm GIF chưa được bật (thiếu GIPHY_API_KEY trong BE/.env)", code: "NO_GIF_KEY" });
    }
    const q = String(req.query.q || "").trim().slice(0, 50);
    const offset = Math.min(Math.max(parseInt(req.query.offset) || 0, 0), 500);
    const params = new URLSearchParams({ api_key: key, limit: "24", offset: String(offset), rating: "pg", lang: "vi" });
    if (q) params.set("q", q);
    try {
      const r = await fetch(`https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}?${params}`);
      if (!r.ok) return res.status(502).json({ message: "Không lấy được GIF, thử lại sau" });
      const { data = [], pagination = {} } = await r.json();
      res.json({
        gifs: data
          .filter((g) => g.images?.fixed_height?.url)
          .map((g) => ({
            id: g.id,
            title: g.title || "",
            url: g.images.fixed_height.url,
            width: +g.images.fixed_height.width || null,
            height: +g.images.fixed_height.height || null,
            preview: (g.images.fixed_width_small || g.images.fixed_height_small || g.images.fixed_height).url,
          })),
        nextOffset: (pagination.offset || 0) + (pagination.count || 0) < (pagination.total_count || 0) ? offset + data.length : null,
      });
    } catch {
      res.status(502).json({ message: "Không kết nối được GIPHY, kiểm tra mạng" });
    }
  });
}
