import React, { useState } from "react";
import {
  BookOpen, Loader2, ArrowLeft, ArrowRight, Eye, EyeOff, User, AtSign, Mail, Lock,
  CheckCircle2, Library, Radio, Users,
} from "lucide-react";
import { C, FONTS } from "../constants";
import { api, saveToken } from "../api";
import RoleFields, { roleFieldsError } from "./RoleFields";
import GoogleButton from "./GoogleButton";

const font = { fontFamily: "'Inter', sans-serif" };
const serif = { fontFamily: "'Fraunces', serif" };

const FEATURES = [
  { icon: CheckCircle2, title: "Hỏi đáp có lời giải hay nhất", desc: "Câu hỏi đã giải quyết được đánh dấu ✓, không trôi mất như trên mạng xã hội." },
  { icon: Library, title: "Thư viện tài liệu theo môn", desc: "Slide, đề thi, ghi chép lọc theo môn, học kỳ, giảng viên." },
  { icon: Radio, title: "Lớp học trực tiếp", desc: "Livestream giảng bài, chia sẻ màn hình, trò chuyện cùng lúc." },
  { icon: Users, title: "Kết nối bạn học", desc: "Tìm bạn dễ dàng." },
];

// Ô nhập có nhãn + icon; viền đậm khi đang gõ, đỏ khi lỗi
function Field({ label, icon: Icon, hint, error, right, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1.5" style={{ ...font, color: C.ink2 }}>{label}</span>
      <span
        className="flex items-center gap-2 px-3 rounded-xl transition-shadow focus-within:shadow-[0_0_0_3px_rgba(28,37,65,0.12)]"
        style={{ background: "#fff", border: `1px solid ${error ? C.coral : C.line}` }}
      >
        {Icon && <Icon size={16} color={C.mute} className="shrink-0" />}
        {children}
        {right}
      </span>
      {(error || hint) && (
        <span className="block text-[11px] mt-1 ml-0.5" style={{ ...font, color: error ? C.coral : C.mute }}>{error || hint}</span>
      )}
    </label>
  );
}

const inputCls = "flex-1 min-w-0 py-2.5 bg-transparent text-sm outline-none placeholder:opacity-60";

function PasswordField({ label, value, onChange, placeholder, error, showStrength = false, autoComplete }) {
  const [show, setShow] = useState(false);
  // Độ mạnh đơn giản: độ dài + có chữ hoa/thường, số, ký tự đặc biệt
  const score = [value.length >= 8, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^\w\s]/.test(value)].filter(Boolean).length;
  const level = !value ? null : value.length < 6 ? 0 : score <= 1 ? 1 : score <= 2 ? 2 : 3;
  const LEVELS = [
    { label: "Quá ngắn", color: C.coral },
    { label: "Yếu", color: C.coral },
    { label: "Trung bình", color: C.mustard },
    { label: "Mạnh", color: C.green },
  ];

  return (
    <div>
      <Field
        label={label}
        icon={Lock}
        error={error}
        right={
          <button type="button" onClick={() => setShow((s) => !s)} className="p-1 -mr-1 hover:opacity-70" style={{ color: C.mute }} title={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      >
        <input
          value={value}
          onChange={onChange}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          className={inputCls}
          style={{ ...font, color: C.ink }}
        />
      </Field>
      {showStrength && level !== null && (
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-1 rounded-full" style={{ background: i <= level ? LEVELS[level].color : C.line }} />
            ))}
          </div>
          <span className="text-[11px] w-16 text-right" style={{ ...font, color: LEVELS[level].color }}>{LEVELS[level].label}</span>
        </div>
      )}
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between relative overflow-hidden rounded-3xl p-10" style={{ background: C.ink, color: C.paper }}>
      {/* Hoạ tiết nền: các đường kẻ như trang vở */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{ backgroundImage: `repeating-linear-gradient(0deg, ${C.paper} 0 1px, transparent 1px 34px)` }}
      />
      <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-20" style={{ background: C.mustard }} />
      <div className="absolute -left-16 -bottom-20 w-56 h-56 rounded-full opacity-10" style={{ background: C.coral }} />

      <div className="relative flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.mustard }}>
          <BookOpen size={20} color={C.ink} />
        </div>
        <span style={{ ...serif, fontWeight: 700 }} className="text-2xl">Góc Học</span>
      </div>

      <div className="relative my-10">
        <h1 style={{ ...serif, fontWeight: 700 }} className="text-4xl leading-tight">
          Học cùng nhau,
          <br />
          <span style={{ color: C.mustard }}>hiểu sâu hơn.</span>
        </h1>
        <p className="mt-3 text-[15px] max-w-sm" style={{ ...font, color: "rgba(239,234,216,0.75)" }}>
          Cộng đồng hỏi đáp, chia sẻ tài liệu và học trực tuyến dành cho học sinh, sinh viên và giảng viên.
        </p>

        <div className="mt-8 space-y-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(239,234,216,0.1)" }}>
                <Icon size={17} color={C.mustard} />
              </span>
              <div>
                <div className="text-sm font-semibold" style={font}>{title}</div>
                <div className="text-xs mt-0.5" style={{ ...font, color: "rgba(239,234,216,0.65)" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative text-xs" style={{ ...font, color: "rgba(239,234,216,0.5)" }}>© {new Date().getFullYear()} Góc Học</div>
    </div>
  );
}

// Đăng ký 2 bước: (1) tài khoản, (2) thông tin cá nhân + vai trò
export default function LoginPage({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", handle: "", email: "", password: "", confirm: "" });
  const [info, setInfo] = useState({ birthDate: "", gender: "", school: "", role: "", teachingSubjects: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const mismatch = form.confirm && form.confirm !== form.password;
  const isRegister = mode === "register";

  const switchMode = (m) => {
    setMode(m);
    setStep(1);
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isRegister && (!form.email.trim() || !form.password)) return setError("Vui lòng nhập email và mật khẩu");
    if (isRegister && step === 1) {
      if (!form.name.trim()) return setError("Vui lòng nhập họ tên");
      if (form.handle.length < 3) return setError("Username cần ít nhất 3 ký tự");
      if (form.password.length < 6) return setError("Mật khẩu cần ít nhất 6 ký tự");
      if (mismatch) return setError("Mật khẩu nhập lại không khớp");
      return setStep(2);
    }
    if (isRegister) {
      const err = roleFieldsError(info);
      if (err) return setError(err);
    }

    setLoading(true);
    try {
      const { confirm, ...account } = form;
      const body = isRegister ? { ...account, ...info } : { email: form.email, password: form.password };
      const data = await api[mode](body);
      saveToken(data.token);
      onAuthed(data.user);
    } catch (err) {
      setError(err.message);
      // Lỗi thuộc bước 1 (trùng email/username) → quay lại bước 1 để sửa
      if (isRegister && /username|email|@/i.test(err.message)) setStep(1);
    } finally {
      setLoading(false);
    }
  };

  // Tài khoản Google mới chưa có ngày sinh / vai trò → App tự mở hộp bổ sung hồ sơ
  const googleLogin = async (credential) => {
    setError("");
    try {
      const data = await api.googleLogin(credential);
      saveToken(data.token);
      onAuthed(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const title = !isRegister ? "Chào mừng trở lại 👋" : step === 1 ? "Tạo tài khoản" : "Giới thiệu về bạn";
  const subtitle = !isRegister
    ? "Đăng nhập để tiếp tục học cùng cộng đồng."
    : step === 1
    ? "Chỉ mất một phút, miễn phí."
    : "Giúp Góc Học gợi ý đúng môn học cho bạn.";

  return (
    <div className="min-h-screen px-4 py-6 lg:p-6" style={{ background: C.paper }}>
      <style>{FONTS}</style>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 min-h-[calc(100vh-48px)]">
        <BrandPanel />

        <div className="flex flex-col items-center justify-center">
          {/* Logo cho màn hình nhỏ (khung giới thiệu bị ẩn) */}
          <div className="flex lg:hidden items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: C.ink }}>
              <BookOpen size={18} color={C.paper} />
            </div>
            <span style={{ ...serif, color: C.ink, fontWeight: 700 }} className="text-2xl">Góc Học</span>
          </div>

          <div
            className="w-full max-w-md rounded-3xl p-6 sm:p-8"
            style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 12px 40px rgba(28,37,65,0.08)" }}
          >
            {/* Chuyển Đăng nhập / Đăng ký */}
            <div className="grid grid-cols-2 p-1 rounded-full mb-6" style={{ background: C.paper }}>
              {["login", "register"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className="text-sm font-semibold py-2 rounded-full transition-all"
                  style={{
                    ...font,
                    background: mode === m ? C.ink : "transparent",
                    color: mode === m ? C.paper : C.mute,
                    boxShadow: mode === m ? "0 2px 8px rgba(28,37,65,0.2)" : "none",
                  }}
                >
                  {m === "login" ? "Đăng nhập" : "Đăng ký"}
                </button>
              ))}
            </div>

            <div className="mb-5">
              <h2 style={{ ...serif, color: C.ink, fontWeight: 700 }} className="text-2xl">{title}</h2>
              <p className="text-sm mt-1" style={{ ...font, color: C.mute }}>{subtitle}</p>
            </div>

            {isRegister && (
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs mb-2" style={{ ...font, color: C.mute }}>
                  <span>
                    Bước <b style={{ color: C.ink }}>{step}</b>/2 · {step === 1 ? "Tài khoản" : "Thông tin cá nhân"}
                  </span>
                  {step === 2 && (
                    <button type="button" onClick={() => { setStep(1); setError(""); }} className="flex items-center gap-1 font-medium hover:opacity-70" style={{ color: C.ink2 }}>
                      <ArrowLeft size={12} /> Quay lại
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[1, 2].map((s) => (
                    <div key={s} className="h-1.5 rounded-full transition-colors" style={{ background: s <= step ? C.ink : C.line }} />
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4" noValidate>
              {!isRegister && (
                <>
                  <Field label="Email" icon={Mail}>
                    <input value={form.email} onChange={update("email")} type="email" placeholder="ban@email.com" autoComplete="email" required className={inputCls} style={{ ...font, color: C.ink }} />
                  </Field>
                  <PasswordField label="Mật khẩu" value={form.password} onChange={update("password")} placeholder="Nhập mật khẩu" autoComplete="current-password" />
                </>
              )}

              {isRegister && step === 1 && (
                <>
                  <Field label="Họ và tên" icon={User}>
                    <input value={form.name} onChange={update("name")} placeholder="Nguyễn Văn A" maxLength={50} autoComplete="name" className={inputCls} style={{ ...font, color: C.ink }} />
                  </Field>
                  <Field label="Username" icon={AtSign} hint="Bạn bè tìm bạn bằng @username này. Chữ không dấu, số, dấu chấm, gạch dưới.">
                    <input
                      value={form.handle}
                      onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9._]/g, "") }))}
                      placeholder="nhatnam.study"
                      maxLength={30}
                      autoComplete="username"
                      className={inputCls}
                      style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.ink }}
                    />
                  </Field>
                  <Field label="Email" icon={Mail}>
                    <input value={form.email} onChange={update("email")} type="email" placeholder="ban@email.com" autoComplete="email" className={inputCls} style={{ ...font, color: C.ink }} />
                  </Field>
                  <PasswordField label="Mật khẩu" value={form.password} onChange={update("password")} placeholder="Ít nhất 6 ký tự" autoComplete="new-password" showStrength />
                  <PasswordField
                    label="Nhập lại mật khẩu"
                    value={form.confirm}
                    onChange={update("confirm")}
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                    error={mismatch ? "Mật khẩu nhập lại không khớp" : ""}
                  />
                </>
              )}

              {isRegister && step === 2 && <RoleFields value={info} onChange={setInfo} />}

              {error && (
                <div className="text-xs px-3 py-2.5 rounded-xl" style={{ background: `${C.coral}14`, border: `1px solid ${C.coral}40`, color: C.coral, ...font }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl transition-all hover:-translate-y-px disabled:opacity-60 disabled:translate-y-0"
                style={{ background: C.ink, color: C.paper, boxShadow: "0 6px 16px rgba(28,37,65,0.2)", ...font }}
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {!isRegister ? "Đăng nhập" : step === 1 ? "Tiếp tục" : "Tạo tài khoản"}
                {isRegister && step === 1 && !loading && <ArrowRight size={15} />}
              </button>
            </form>

            {/* Bước 2 của đăng ký là thông tin cá nhân, không hiện Google nữa */}
            {!(isRegister && step === 2) && (
              <>
                <div className="flex items-center gap-3 my-5 text-xs" style={{ ...font, color: C.mute }}>
                  <div className="flex-1 h-px" style={{ background: C.line }} />
                  hoặc
                  <div className="flex-1 h-px" style={{ background: C.line }} />
                </div>
                <GoogleButton onCredential={googleLogin} onError={setError} />
              </>
            )}

            <p className="text-center text-sm mt-6" style={{ ...font, color: C.mute }}>
              {isRegister ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
              <button type="button" onClick={() => switchMode(isRegister ? "login" : "register")} className="font-semibold hover:underline" style={{ color: C.ink }}>
                {isRegister ? "Đăng nhập" : "Đăng ký ngay"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
