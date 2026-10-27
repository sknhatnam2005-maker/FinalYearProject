import { normalizeText } from "./models/Subject.js";

// Kiểm tra nội dung bài đăng có khớp môn đã chọn không, bằng từ khoá đặc trưng của từng nhóm môn.
// Từ khoá viết không dấu, chữ thường (giống normalizeText). Cụm nhiều từ được tính 2 điểm, từ đơn 1 điểm.
// Tránh các từ đơn mơ hồ (vd. "hàm", "biến", "mảng", "diện tích") vì xuất hiện ở nhiều môn.
const GROUPS = {
  toan: {
    name: "Toán",
    defaultSubject: "Toán học",
    keywords: [
      "dao ham", "tich phan", "nguyen ham", "vi phan", "phuong trinh", "bat phuong trinh", "he phuong trinh",
      "ham so", "do thi ham so", "cuc tri", "tiem can", "gioi han", "ma tran", "dinh thuc", "vecto", "vector",
      "logarit", "luong giac", "sin", "cos", "hinh hoc", "tam giac", "duong tron", "hinh chop", "lang tru",
      "the tich", "chung minh", "da thuc", "so phuc", "to hop", "chinh hop", "hoan vi", "cap so cong",
      "cap so nhan", "day so", "dinh ly", "menh de", "tap hop", "toa do", "mat phang", "xac suat",
      "thong ke", "ki vong", "ky vong", "phuong sai", "do lech chuan", "bien ngau nhien", "phan phoi chuan",
      "quy nap", "nghiem", "giai phuong trinh", "pytago", "dong dang", "song song", "vuong goc", "bai toan",
    ],
  },
  tin: {
    name: "Tin học / Lập trình",
    defaultSubject: "Lập trình",
    keywords: [
      "lap trinh", "code", "source code", "vong lap", "con tro", "struct", "class", "object", "ke thua", "da hinh",
      "interface", "java", "python", "c++", "javascript", "typescript", "html", "css", "react", "nodejs", "node js",
      "sql", "database", "co so du lieu", "khoa chinh", "khoa ngoai", "query", "select", "join", "api", "bug",
      "compile", "debug", "git", "github", "thuat toan", "do phuc tap", "stack", "queue", "linked list",
      "danh sach lien ket", "cay nhi phan", "sap xep noi bot", "tim kiem nhi phan", "de quy", "recursion", "array",
      "string", "exception", "server", "client", "framework", "spring boot", "servlet", "jsp", "android", "kotlin",
      "flutter", "tcp", "subnet", "router", "he dieu hanh", "process", "thread", "deadlock", "linux", "terminal",
      "machine learning", "neural network", "dataset", "oop", "uml", "use case", "test case", "unit test",
      "frontend", "backend", "docker", "mongodb", "express", "mvc", "bien kieu", "kieu du lieu", "ham main",
    ],
  },
  anh: {
    name: "Tiếng Anh",
    defaultSubject: "Tiếng Anh",
    keywords: [
      "tieng anh", "grammar", "tense", "present perfect", "past simple", "present simple", "vocabulary", "ielts",
      "toeic", "toefl", "listening", "speaking", "essay", "pronunciation", "phrasal verb", "idiom", "passive voice",
      "conditional", "relative clause", "ngu phap tieng anh", "tu vung", "thi hien tai", "thi qua khu",
      "cau bi dong", "cau dieu kien", "menh de quan he", "phat am", "dong tu bat quy tac",
    ],
  },
  ly: {
    name: "Vật lý",
    defaultSubject: "Vật lý",
    keywords: [
      "vat ly", "dien tro", "dong dien", "hieu dien the", "cong suat", "dong nang", "the nang", "van toc", "gia toc",
      "dinh luat newton", "ma sat", "dao dong", "con lac", "buoc song", "tan so", "quang hoc", "thau kinh",
      "khuc xa", "dien truong", "tu truong", "cam ung dien tu", "nhiet dong luc hoc", "hat nhan", "phong xa",
      "ohm", "joule", "culong", "trong luc", "quan tinh", "momen", "ap suat", "dong luong", "chuyen dong",
    ],
  },
  hoa: {
    name: "Hoá học",
    defaultSubject: "Hoá học",
    keywords: [
      "hoa hoc", "phan ung", "mol", "nguyen tu", "phan tu", "nguyen to", "bang tuan hoan", "axit", "bazo",
      "oxi hoa", "chat khu", "can bang phuong trinh hoa hoc", "este", "ancol", "andehit", "polime", "kim loai",
      "dung dich", "nong do", "ket tua", "huu co", "vo co", "hidrocacbon", "ankan", "anken", "ankin", "benzen",
      "lien ket cong hoa tri", "lien ket ion", "so oxi hoa", "chat xuc tac",
    ],
  },
  sinh: {
    name: "Sinh học",
    defaultSubject: "Sinh học",
    keywords: [
      "sinh hoc", "te bao", "adn", "dna", "arn", "rna", "gen", "nhiem sac the", "di truyen", "dot bien", "quang hop",
      "ho hap te bao", "protein", "enzyme", "tien hoa", "sinh thai", "quan the", "menden", "nguyen phan",
      "giam phan", "vi khuan", "virus", "he sinh thai", "chon loc tu nhien",
    ],
  },
  van: {
    name: "Ngữ văn",
    defaultSubject: "Ngữ văn",
    keywords: [
      "ngu van", "van hoc", "tac pham", "tac gia", "nhan vat", "bai tho", "doan tho", "kho tho", "truyen ngan",
      "tieu thuyet", "nghi luan", "nghi luan van hoc", "nghi luan xa hoi", "cam nhan", "doan van", "bai van",
      "van mau", "bien phap tu tu", "an du", "hoan du", "nhan hoa", "dieu ca", "nguyen du", "truyen kieu",
      "xuan quynh", "to huu", "nam cao", "chi pheo", "vo chong a phu", "vo nhat", "song da", "tay tien",
      "viet bac", "mo bai", "than bai", "ket bai", "gia tri nhan dao", "gia tri hien thuc", "nhan vat tru tinh",
      "tho luc bat", "ca dao", "tuc ngu", "phan tich bai tho", "phan tich nhan vat",
    ],
  },
  su: {
    name: "Lịch sử",
    defaultSubject: "Lịch sử",
    keywords: [
      "lich su", "chien tranh", "khang chien", "trieu dai", "trieu nguyen", "nha tran", "nha ly", "nha le",
      "hiep dinh", "dien bien phu", "the chien", "chien tranh the gioi", "phong kien", "thuc dan", "de quoc",
      "khoi nghia", "chien dich",
    ],
  },
  dia: {
    name: "Địa lý",
    defaultSubject: "Địa lý",
    keywords: [
      "dia ly", "khi hau", "dia hinh", "dan so", "song ngoi", "ban do", "vi do", "kinh do", "dong bang",
      "cao nguyen", "gio mua", "tai nguyen thien nhien", "vung kinh te", "luu vuc",
    ],
  },
  kinhte: {
    name: "Kinh tế",
    defaultSubject: "Kinh tế",
    keywords: [
      "kinh te", "cung cau", "gia ca", "lam phat", "gdp", "thi truong", "doanh nghiep", "marketing", "ke toan",
      "tai chinh", "loi nhuan", "chi phi", "doanh thu", "dau tu", "lai suat", "co phieu", "startup",
      "business model", "khach hang", "khoi nghiep",
    ],
  },
  chinhtri: {
    name: "Lý luận chính trị",
    defaultSubject: "Triết học Mác – Lênin",
    keywords: [
      "mac lenin", "triet hoc", "chu nghia duy vat", "duy vat bien chung", "bien chung", "y thuc xa hoi",
      "vat chat va y thuc", "gia tri thang du", "chu nghia xa hoi", "giai cap cong nhan", "tu tuong ho chi minh",
      "dang cong san", "hinh thai kinh te xa hoi", "luc luong san xuat", "quan he san xuat",
    ],
  },
  nhat: {
    name: "Tiếng Nhật",
    defaultSubject: "Tiếng Nhật",
    keywords: ["tieng nhat", "hiragana", "katakana", "kanji", "jlpt", "desu", "masu", "bunpo", "minna no nihongo"],
  },
};

// Môn → các nhóm được coi là khớp (nhóm đầu là chính). Môn không có ở đây (vd. môn người dùng tự thêm)
// sẽ được đoán nhóm theo tên môn; đoán không ra thì bỏ qua, không cảnh báo.
const SUBJECT_GROUPS = {
  "toan hoc": ["toan"],
  "tin hoc": ["tin"],
  "giao duc cong dan": ["chinhtri"],
  "toan cao cap": ["toan"],
  "toan roi rac": ["toan", "tin"],
  "xac suat thong ke": ["toan"],
  "lap trinh": ["tin"],
  "nhap mon lap trinh": ["tin"],
  "lap trinh huong doi tuong": ["tin"],
  "cau truc du lieu va giai thuat": ["tin", "toan"],
  "co so du lieu": ["tin"],
  "kien truc may tinh": ["tin"],
  "he dieu hanh": ["tin"],
  "mang may tinh": ["tin"],
  "thiet ke web": ["tin"],
  "lap trinh web": ["tin"],
  "lap trinh di dong": ["tin"],
  "cong nghe phan mem": ["tin"],
  "phan tich yeu cau phan mem": ["tin"],
  "kiem thu phan mem": ["tin"],
  "kien truc va thiet ke phan mem": ["tin"],
  "tri tue nhan tao": ["tin", "toan"],
  "hoc may": ["tin", "toan"],
  "internet van vat (iot)": ["tin", "ly"],
  "an toan thong tin": ["tin"],
  "do an tot nghiep": ["tin"],
  "tieng anh": ["anh"],
  "vat ly": ["ly", "toan"],
  "hoa hoc": ["hoa"],
  "sinh hoc": ["sinh", "hoa"],
  "ngu van": ["van"],
  "lich su": ["su", "chinhtri"],
  "dia ly": ["dia", "kinhte"],
  "kinh te": ["kinhte", "toan"],
  "khoi nghiep": ["kinhte"],
  "tieng nhat": ["nhat"],
  "triet hoc mac – lenin": ["chinhtri"],
  "kinh te chinh tri mac – lenin": ["chinhtri", "kinhte"],
  "chu nghia xa hoi khoa hoc": ["chinhtri"],
  "tu tuong ho chi minh": ["chinhtri", "su"],
  "lich su dang cong san viet nam": ["chinhtri", "su"],
};

// Tên hiển thị (có dấu) của các môn trong SUBJECT_GROUPS, để trả về đúng label như trong DB
const SUBJECT_LABELS = Object.fromEntries(
  [
    "Toán học", "Toán cao cấp", "Toán rời rạc", "Xác suất thống kê", "Lập trình", "Nhập môn lập trình",
    "Lập trình hướng đối tượng", "Cấu trúc dữ liệu và giải thuật", "Cơ sở dữ liệu", "Kiến trúc máy tính",
    "Hệ điều hành", "Mạng máy tính", "Thiết kế web", "Lập trình web", "Lập trình di động", "Công nghệ phần mềm",
    "Kiểm thử phần mềm", "Trí tuệ nhân tạo", "Học máy", "An toàn thông tin", "Tiếng Anh", "Vật lý", "Hoá học",
    "Sinh học", "Ngữ văn", "Lịch sử", "Địa lý", "Kinh tế", "Khởi nghiệp", "Tiếng Nhật", "Triết học Mác – Lênin",
    "Tư tưởng Hồ Chí Minh",
  ].map((label) => [normalizeText(label), label])
);

const MIN_SIGNAL = 3; // điểm tối thiểu của nhóm thắng mới đủ chắc để cảnh báo

function prepare(text) {
  // Giữ + và # cho "c++", "c#"; còn lại thành khoảng trắng. Thêm khoảng trắng 2 đầu để khớp nguyên từ.
  return ` ${normalizeText(text).replace(/[^a-z0-9+#]+/g, " ").trim()} `;
}

function scoreGroups(text) {
  const t = prepare(text);
  const result = {};
  for (const [key, g] of Object.entries(GROUPS)) {
    let score = 0;
    const hits = [];
    for (const kw of g.keywords) {
      if (!t.includes(` ${kw} `)) continue;
      score += kw.includes(" ") ? 2 : 1;
      hits.push(kw);
    }
    if (score) result[key] = { score, hits };
  }
  return result;
}

function groupsOfSubject(label) {
  const key = normalizeText(label);
  if (SUBJECT_GROUPS[key]) return SUBJECT_GROUPS[key];
  // Môn tự thêm: đoán từ chính tên môn (vd. "Giải tích 2" → có "tich phan"? không; "Lập trình C" → tin)
  const guess = Object.entries(scoreGroups(label)).sort((a, b) => b[1].score - a[1].score)[0];
  return guess ? [guess[0]] : [];
}

/**
 * @returns {{ ok: true } | { ok: false, suggestion: string, groupName: string, hits: string[] }}
 */
export function checkSubject(content, subjectLabel) {
  const allowed = groupsOfSubject(subjectLabel);
  if (!allowed.length) return { ok: true }; // không biết môn này thuộc nhóm nào → không phán xét

  const scores = scoreGroups(content);
  const ranked = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length) return { ok: true };

  const [bestKey, best] = ranked[0];
  const chosenScore = Math.max(0, ...allowed.map((g) => scores[g]?.score || 0));

  // Chỉ cảnh báo khi nhóm thắng nằm ngoài môn đã chọn, đủ tín hiệu và áp đảo rõ ràng
  if (allowed.includes(bestKey) || best.score < MIN_SIGNAL || best.score < chosenScore * 2 + 1) {
    return { ok: true };
  }
  // Nội dung nhắc thẳng tên một môn cụ thể của nhóm đó (vd. "toán cao cấp") thì gợi ý môn đó
  const t = prepare(content);
  const named = Object.keys(SUBJECT_GROUPS).find(
    (name) => SUBJECT_GROUPS[name][0] === bestKey && t.includes(` ${prepare(name).trim()} `)
  );
  const namedLabel = named && SUBJECT_LABELS[named];

  return {
    ok: false,
    suggestion: namedLabel || GROUPS[bestKey].defaultSubject,
    fallback: GROUPS[bestKey].defaultSubject,
    groupName: GROUPS[bestKey].name,
    hits: best.hits.slice(0, 4),
  };
}
