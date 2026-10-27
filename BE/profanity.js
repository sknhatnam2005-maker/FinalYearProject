// Lọc từ chửi bậy (tiếng Việt + tiếng Anh).
// - Bài viết, bình luận, hồ sơ, tên môn, tiêu đề live: chặn hẳn (findProfanity → báo lỗi 400).
// - Tin nhắn, chat livestream: thay từ bậy bằng *** (maskProfanity) để cuộc trò chuyện không bị ngắt.
//
// Chỉ dùng từ có dấu cho những từ mà khi bỏ dấu sẽ trùng từ bình thường
// (vd. "lồn" ↔ "lon", "buồi" ↔ "buổi", "cặc" ↔ "các", "đéo" ↔ "đeo"), tránh chặn nhầm.

const L = "\\p{L}\\p{N}";
const SEP = `[^${L}]*`; // cho phép chèn dấu cách / ký tự giữa các chữ: "đ.m", "dit   me"

const WORDS = [
  // tiếng Việt có dấu
  "đ[ịi]t+",
  "đụ+",
  "đéo+",
  "lồn+",
  "buồi+",
  "cặc+",
  "đĩ+",
  "đ[ck]?m+",
  "đù" + SEP + "m[áaẹeé]",
  "óc" + SEP + "chó",
  "chó" + SEP + "đẻ",
  "vãi" + SEP + "(?:cả" + SEP + ")?(?:lồn|l|loz+|chưởng)",
  // tiếng Việt viết tắt / không dấu (chỉ những cách viết không trùng từ bình thường)
  "dm{2,}",
  "d[ck]m+",
  "dit" + SEP + "(?:me|mẹ|ma|má|con|cu)",
  "ditme",
  "djt+",
  "vcl+",
  "vkl+",
  "vcc",
  "clgt",
  "cmm+",
  "loz+",
  "đjt+",
  // tiếng Anh
  "f+[ua]*c+k+[\\p{L}]*",
  "f+u+k+",
  "motherf+u*c*k+[\\p{L}]*",
  "sh+i+t+(?:s|ty|head)?",
  "bitch(?:es|y)?",
  "cunts?",
  "assholes?",
  "dickheads?",
  "puss(?:y|ies)",
  "whores?",
  "sluts?",
  "bastards?",
  "nigg(?:a|er)s?",
  "wtf",
  "stfu",
];

const PATTERN = new RegExp(`(?<![${L}])(?:${WORDS.join("|")})(?![${L}])`, "giu");

// Chữ số / ký hiệu hay dùng để lách: "f4ck", "sh1t", "đ!t". Đổi 1 ký tự lấy 1 ký tự để giữ nguyên vị trí.
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };

function prepare(text) {
  // NFC: gõ trên macOS hay ra dạng tổ hợp (e + dấu) làm regex không khớp
  const nfc = String(text || "").normalize("NFC");
  const lower = [...nfc].map((ch) => {
    const l = ch.toLowerCase();
    return l.length === ch.length ? l : ch; // hiếm khi toLowerCase đổi độ dài; giữ nguyên để không lệch vị trí
  });
  return { nfc, prepared: lower.map((ch) => LEET[ch] ?? ch).join("") };
}

// Ghép các chữ cái đứng lẻ: "f u c k" → "fuck", "đ . m" → "đm"
function joinSingles(text) {
  return text
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .reduce((out, tok) => {
      const last = out[out.length - 1];
      if (tok.length === 1 && last && last.single) last.text += tok;
      else out.push({ text: tok, single: tok.length === 1 });
      return out;
    }, [])
    .map((t) => t.text)
    .join(" ");
}

// Trả về từ bậy đầu tiên tìm thấy (đã che bớt để hiện trong thông báo lỗi), không có thì null
export function findProfanity(...texts) {
  for (const text of texts) {
    if (!text) continue;
    const { prepared } = prepare(text);
    for (const candidate of [prepared, joinSingles(prepared)]) {
      PATTERN.lastIndex = 0;
      const m = PATTERN.exec(candidate);
      if (m) {
        const word = m[0].replace(/[^\p{L}\p{N}]/gu, "");
        return word[0] + "*".repeat(Math.max(word.length - 1, 2));
      }
    }
  }
  return null;
}

export function profanityMessage(word) {
  return `Nội dung có từ ngữ không phù hợp ("${word}"). Vui lòng sửa lại trước khi đăng.`;
}

// Thay từ bậy bằng dấu * (giữ nguyên độ dài). Dạng tách chữ "f u c k" không che được thì vẫn để nguyên.
export function maskProfanity(text) {
  const { nfc, prepared } = prepare(text);
  const chars = [...nfc];
  // Regex chạy theo code unit; đổi ra vị trí theo ký tự để thay đúng chỗ
  const prepChars = [...prepared];
  let unitToChar = [];
  prepChars.forEach((ch, i) => {
    for (let k = 0; k < ch.length; k++) unitToChar.push(i);
  });
  unitToChar.push(prepChars.length);
  PATTERN.lastIndex = 0;
  for (const m of prepared.matchAll(PATTERN)) {
    const start = unitToChar[m.index];
    const end = unitToChar[m.index + m[0].length];
    for (let i = start; i < end; i++) if (/[\p{L}\p{N}]/u.test(chars[i])) chars[i] = "*";
  }
  return chars.join("");
}
