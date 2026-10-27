import React, { useState, useEffect, useRef } from "react";
import { ImagePlus, Smile, Loader2, X, Search } from "lucide-react";
import { C } from "../constants";
import { api, uploadFile, compressImage, fileUrl } from "../api";

// Ảnh / emoji / GIF dùng chung cho ô bình luận và ô nhắn tin.

const font = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const EMOJI_GROUPS = [
  {
    name: "Mặt cười",
    icon: "😀",
    list: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 😌 😔 😪 😴 😷 🤒 🤕 🥵 🥶 😵 🤯 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 💀 🤡 👻 🤖",
  },
  {
    name: "Cử chỉ",
    icon: "👍",
    list: "👍 👎 👌 🤌 ✌️ 🤞 🫶 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 👏 🙌 👐 🤲 🙏 🤝 💪 🫵 ✍️ 🙋 🙆 🙅 🤷 🤦 🙇 💁",
  },
  {
    name: "Học tập",
    icon: "📚",
    list: "📚 📖 📝 ✏️ 🖊️ 📒 📓 📔 📕 📗 📘 📙 📎 📌 📐 📏 🧮 🔬 🔭 🧪 🧬 💻 🖥️ ⌨️ 🖱️ 💾 📊 📈 📉 🗂️ 📅 ⏰ ⏳ 🎓 🏫 🧠 💡 🔍 ✅ ❌ ❓ ❗ ⭐ 🌟 🏆 🥇 🎯 🚀",
  },
  {
    name: "Trái tim",
    icon: "❤️",
    list: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💤 🔥 ✨ 🎉 🎊 🎁 🎈",
  },
  {
    name: "Đồ ăn",
    icon: "🍜",
    list: "☕ 🧋 🍵 🥤 🍺 🍜 🍲 🍚 🍙 🍱 🍣 🍕 🍔 🍟 🌭 🥪 🌮 🍗 🍖 🥩 🍳 🥞 🍰 🎂 🍩 🍪 🍫 🍬 🍦 🍉 🍓 🍌 🍎 🥭 🍍 🥑",
  },
  {
    name: "Động vật",
    icon: "🐱",
    list: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦉 🐺 🐴 🦄 🐝 🐛 🦋 🐌 🐢 🐍 🐙 🐬 🐳 🐟 🦀 🌸 🌹 🌻 🌈 ☀️ 🌙 ⛅ 🌧️ ❄️",
  },
].map((g) => ({ ...g, list: g.list.split(" ") }));

// Chèn chữ vào đúng vị trí con trỏ trong input/textarea
export function insertAtCursor(el, text, value, setValue) {
  if (!el) return setValue(value + text);
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  setValue(value.slice(0, start) + text + value.slice(end));
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + text.length, start + text.length);
  });
}

function imageSize(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: null, height: null });
    img.src = src;
  });
}

// Quản lý 1 ảnh/GIF đính kèm: tải ảnh lên ngay khi chọn để lúc gửi chỉ cần fileId
export function useMediaAttachment(onError) {
  const [media, setMedia] = useState(null);
  const token = useRef(0); // bỏ kết quả tải lên cũ nếu người dùng đã chọn ảnh khác / xoá

  const attachFile = async (file) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return onError?.("Chỉ gửi được ảnh JPG, PNG, WebP hoặc GIF");
    const my = ++token.current;
    const localUrl = URL.createObjectURL(file);
    const { width, height } = await imageSize(localUrl);
    setMedia({ kind: "image", uploading: true, localUrl, width, height });
    try {
      const uploaded = await uploadFile(await compressImage(file, 1600));
      if (my !== token.current) return;
      setMedia({ kind: "image", fileId: uploaded.fileId, mimeType: uploaded.mimeType, localUrl, width, height });
    } catch (err) {
      if (my !== token.current) return;
      setMedia(null);
      onError?.(err.message);
    }
  };

  const attachGif = (gif) => {
    token.current++;
    setMedia({ kind: "gif", url: gif.url, width: gif.width, height: gif.height });
  };

  const clear = () => {
    token.current++;
    setMedia(null);
  };

  // Dán ảnh (Ctrl+V) vào ô nhập
  const onPaste = (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      attachFile(file);
    }
  };

  return { media, attachFile, attachGif, clear, onPaste, uploading: !!media?.uploading };
}

// Dữ liệu gửi lên BE (bỏ phần chỉ dùng ở FE)
export function mediaPayload(media) {
  if (!media || media.uploading) return undefined;
  return media.kind === "gif"
    ? { kind: "gif", url: media.url, width: media.width, height: media.height }
    : { kind: "image", fileId: media.fileId, width: media.width, height: media.height };
}

function mediaSrc(media) {
  return media.localUrl || (media.kind === "gif" ? media.url : fileUrl(media.fileId));
}

// Ảnh/GIF hiển thị trong bình luận hoặc tin nhắn; giữ đúng tỉ lệ ngay từ đầu để khung không nhảy khi ảnh tải xong
export function MediaView({ media, maxWidth = 240, maxHeight = 260 }) {
  if (!media) return null;
  const src = mediaSrc(media);
  const ratio = media.width && media.height ? media.width / media.height : null;
  const width = ratio ? Math.min(maxWidth, maxHeight * ratio) : undefined;
  return (
    <a href={media.kind === "gif" ? media.url : fileUrl(media.fileId)} target="_blank" rel="noreferrer" className="block max-w-full" title={media.kind === "gif" ? "GIF" : "Xem ảnh gốc"}>
      <img
        src={src}
        alt={media.kind === "gif" ? "GIF" : "Ảnh"}
        loading="lazy"
        className="block rounded-xl max-w-full object-cover"
        style={{
          width: width ?? "auto",
          maxWidth,
          maxHeight,
          aspectRatio: ratio || undefined,
          background: C.line,
        }}
      />
    </a>
  );
}

// Ảnh nhỏ phía trên ô nhập, có nút xoá
export function MediaPreview({ media, onRemove }) {
  if (!media) return null;
  return (
    <div className="relative inline-block">
      <img src={mediaSrc(media)} alt="" className="h-16 max-w-[120px] rounded-lg object-cover" style={{ opacity: media.uploading ? 0.5 : 1, border: `1px solid ${C.line}` }} />
      {media.uploading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin" color={C.ink} />
        </span>
      )}
      {media.kind === "gif" && (
        <span className="absolute left-1 bottom-1 text-[9px] font-bold px-1 rounded" style={{ ...mono, background: "rgba(0,0,0,0.6)", color: "#fff" }}>GIF</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        title="Bỏ ảnh"
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: C.ink, color: C.paper }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function Popover({ onClose, children, align = "left" }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        className={`absolute bottom-full mb-2 ${align === "right" ? "right-0" : "left-0"} z-40 w-[min(320px,calc(100vw-32px))] rounded-xl overflow-hidden`}
        style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 8px 24px rgba(28,37,65,0.18)" }}
      >
        {children}
      </div>
    </>
  );
}

function EmojiPanel({ onPick }) {
  const [group, setGroup] = useState(0);
  return (
    <div>
      <div className="flex px-1 pt-1" style={{ borderBottom: `1px solid ${C.line}` }}>
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.name}
            type="button"
            title={g.name}
            onClick={() => setGroup(i)}
            className="flex-1 py-1.5 text-lg rounded-t-lg"
            style={{ background: i === group ? C.paper : "transparent" }}
          >
            {g.icon}
          </button>
        ))}
      </div>
      <div className="px-2 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ ...mono, color: C.mute }}>
        {EMOJI_GROUPS[group].name}
      </div>
      <div className="grid grid-cols-8 gap-0.5 p-1.5 max-h-52 overflow-y-auto">
        {EMOJI_GROUPS[group].list.map((e) => (
          <button key={e} type="button" onClick={() => onPick(e)} className="h-9 text-xl rounded-lg hover:bg-black/5">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function GifPanel({ onPick, onUploadGif }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { message, noKey }

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .searchGifs(query.trim())
        .then((r) => {
          if (!active) return;
          setGifs(r.gifs);
          setNextOffset(r.nextOffset);
          setError(null);
        })
        .catch((err) => active && setError({ message: err.message, noKey: err.data?.code === "NO_GIF_KEY" }))
        .finally(() => active && setLoading(false));
    }, query ? 400 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const loadMore = async () => {
    if (nextOffset === null || loading) return;
    setLoading(true);
    try {
      const r = await api.searchGifs(query.trim(), nextOffset);
      setGifs((g) => [...g, ...r.gifs.filter((x) => !g.some((y) => y.id === x.id))]);
      setNextOffset(r.nextOffset);
    } catch {
      setNextOffset(null);
    } finally {
      setLoading(false);
    }
  };

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) loadMore();
  };

  return (
    <div>
      <div className="p-2" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <Search size={14} color={C.mute} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm GIF (vd. haha, cảm ơn, mệt)"
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ ...font, color: C.ink }}
          />
          {loading && <Loader2 size={13} className="animate-spin" color={C.mute} />}
        </div>
      </div>

      {error ? (
        <div className="p-4 text-center space-y-2">
          <div className="text-xs" style={{ ...font, color: error.noKey ? C.mute : C.coral }}>{error.message}</div>
          <button
            type="button"
            onClick={onUploadGif}
            className="text-xs font-semibold px-3 py-1.5 rounded-full hover:opacity-80"
            style={{ ...font, background: C.ink, color: C.paper }}
          >
            Tải GIF từ máy
          </button>
        </div>
      ) : (
        <div onScroll={onScroll} className="h-64 overflow-y-auto p-1.5 columns-2 gap-1.5">
          {gifs.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(g)}
              title={g.title}
              className="block w-full mb-1.5 rounded-lg overflow-hidden hover:opacity-80 break-inside-avoid"
              style={{ background: C.paper, aspectRatio: g.width && g.height ? `${g.width} / ${g.height}` : undefined }}
            >
              <img src={g.preview} alt={g.title} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
          {!loading && !gifs.length && (
            <div className="text-xs text-center py-6" style={{ ...font, color: C.mute, columnSpan: "all" }}>Không tìm thấy GIF nào.</div>
          )}
        </div>
      )}
      <div className="px-2 py-1 text-[10px] text-right" style={{ ...mono, color: C.mute, borderTop: `1px solid ${C.line}` }}>
        Powered by GIPHY
      </div>
    </div>
  );
}

// 3 nút: ảnh, emoji, GIF. attachment = kết quả useMediaAttachment
export function MediaTools({ attachment, onEmoji, align = "left", size = 32 }) {
  const [open, setOpen] = useState(null); // "emoji" | "gif" | null
  const fileInput = useRef(null);
  const gifInput = useRef(null);

  const btn = "rounded-full flex items-center justify-center shrink-0 hover:bg-black/5 disabled:opacity-40";
  const style = { width: size, height: size, color: C.ink2 };

  return (
    <div className="relative flex items-center shrink-0">
      <button type="button" className={btn} style={style} title="Gửi ảnh" disabled={attachment.uploading} onClick={() => fileInput.current?.click()}>
        <ImagePlus size={17} />
      </button>
      <button type="button" className={btn} style={{ ...style, color: open === "emoji" ? C.ink : C.ink2 }} title="Emoji" onClick={() => setOpen((o) => (o === "emoji" ? null : "emoji"))}>
        <Smile size={17} />
      </button>
      <button
        type="button"
        className={btn}
        style={{ ...style, color: open === "gif" ? C.ink : C.ink2 }}
        title="GIF"
        onClick={() => setOpen((o) => (o === "gif" ? null : "gif"))}
      >
        <span className="text-[10px] font-bold px-1 rounded" style={{ ...mono, border: "1.5px solid currentColor", lineHeight: "13px" }}>GIF</span>
      </button>

      <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => { attachment.attachFile(e.target.files[0]); e.target.value = ""; }} />
      <input ref={gifInput} type="file" accept="image/gif" hidden onChange={(e) => { attachment.attachFile(e.target.files[0]); e.target.value = ""; }} />

      {open === "emoji" && (
        <Popover onClose={() => setOpen(null)} align={align}>
          <EmojiPanel onPick={onEmoji} />
        </Popover>
      )}
      {open === "gif" && (
        <Popover onClose={() => setOpen(null)} align={align}>
          <GifPanel
            onPick={(g) => {
              attachment.attachGif(g);
              setOpen(null);
            }}
            onUploadGif={() => {
              setOpen(null);
              gifInput.current?.click();
            }}
          />
        </Popover>
      )}
    </div>
  );
}
