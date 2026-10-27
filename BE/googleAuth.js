import User from "./models/User.js";

// Đăng nhập bằng Google (Gmail). FE dùng Google Identity Services lấy "credential" (ID token),
// BE hỏi Google kiểm tra token rồi đăng nhập / tạo tài khoản theo email.
// Cần GOOGLE_CLIENT_ID trong BE/.env (Google Cloud Console → Credentials → OAuth client ID → Web).

const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

async function verifyGoogleToken(credential) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return null;
  const info = await res.json();
  const valid =
    info.aud === process.env.GOOGLE_CLIENT_ID &&
    ISSUERS.includes(info.iss) &&
    Number(info.exp) * 1000 > Date.now() &&
    (info.email_verified === "true" || info.email_verified === true);
  return valid ? info : null;
}

// Ảnh Google lưu thành data URL như ảnh người dùng tự tải lên (link Google đôi khi bị chặn khi nhúng)
async function fetchAvatar(picture) {
  if (!picture) return "";
  try {
    const res = await fetch(picture.replace(/=s\d+(-c)?$/, "") + "=s256-c");
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length < 1_500_000 ? `data:${type.split(";")[0]};base64,${buf.toString("base64")}` : "";
  } catch {
    return "";
  }
}

// Username gợi ý từ email: "Nguyen.Van-A@gmail.com" → "nguyen.van_a", trùng thì thêm số
async function uniqueHandle(email, handleQuery) {
  let base = email.split("@")[0].toLowerCase().replace(/-/g, "_").replace(/[^a-z0-9._]/g, "").slice(0, 24);
  if (base.length < 3) base = `user${base}`;
  if (!(await User.exists(handleQuery(base)))) return base;
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}${Math.floor(100 + Math.random() * 9900)}`;
    if (!(await User.exists(handleQuery(candidate)))) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}

export function registerGoogleAuth(app, { generateToken, selfUser, handleQuery, escapeRegex }) {
  // FE hỏi client ID ở đây để chỉ phải cấu hình một chỗ (BE/.env)
  app.get("/api/auth/google/config", (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID || "" });
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(503).json({ message: "Máy chủ chưa cấu hình đăng nhập Google (thiếu GOOGLE_CLIENT_ID)" });
      }
      const info = req.body.credential && (await verifyGoogleToken(req.body.credential));
      if (!info) return res.status(401).json({ message: "Đăng nhập Google không hợp lệ hoặc đã hết hạn, vui lòng thử lại" });

      const email = info.email.toLowerCase();
      let user = await User.findOne({ googleId: info.sub });
      let isNew = false;

      if (!user) {
        // Email đã đăng ký bằng mật khẩu → gắn Google vào tài khoản đó
        user = await User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });
        if (user) {
          user.googleId = info.sub;
          if (!user.avatarUrl) user.avatarUrl = await fetchAvatar(info.picture);
          await user.save();
        }
      }

      if (!user) {
        // Tài khoản mới: ngày sinh, giới tính, vai trò để FE hỏi bổ sung (CompleteProfileModal)
        user = await User.create({
          name: (info.name || email.split("@")[0]).slice(0, 50),
          handle: await uniqueHandle(email, handleQuery),
          email,
          googleId: info.sub,
          avatarUrl: await fetchAvatar(info.picture),
        });
        isNew = true;
      }

      res.status(isNew ? 201 : 200).json({ token: generateToken(user._id), user: selfUser(user), isNew });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server, vui lòng thử lại" });
    }
  });
}
