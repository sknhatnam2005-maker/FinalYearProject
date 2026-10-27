import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";

const font = { fontFamily: "'Inter', sans-serif" };

// Tải thư viện Google Identity Services một lần cho cả trang
let gsiPromise = null;
function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => {
        gsiPromise = null;
        reject(new Error("Không tải được Google, kiểm tra kết nối mạng"));
      };
      document.head.appendChild(s);
    });
  }
  return gsiPromise;
}

// initialize chỉ gọi một lần; callback luôn trỏ tới handler mới nhất (StrictMode / mở lại trang)
let initializedFor = null;
let currentHandler = () => {};

// Nút "Tiếp tục với Google" (nút chính chủ của Google, vẽ trong iframe)
export default function GoogleButton({ onCredential, onError }) {
  const box = useRef(null);
  const [state, setState] = useState("loading"); // loading | ready | missing | error
  const [busy, setBusy] = useState(false);

  currentHandler = async (credential) => {
    setBusy(true);
    try {
      await onCredential(credential);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { clientId } = await api.googleConfig();
        if (!active) return;
        if (!clientId) return setState("missing");
        await loadGsi();
        if (!active || !box.current) return;
        if (initializedFor !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: ({ credential }) => currentHandler(credential),
            ux_mode: "popup",
          });
          initializedFor = clientId;
        }
        window.google.accounts.id.renderButton(box.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          locale: "vi",
          width: Math.min(400, Math.max(220, box.current.offsetWidth)),
        });
        setState("ready");
      } catch (err) {
        if (!active) return;
        setState("error");
        onError?.(err.message);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="relative">
      <div ref={box} className="w-full flex justify-center min-h-[44px]" style={{ opacity: busy ? 0.4 : 1 }} />
      {(state === "loading" || busy) && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs" style={{ ...font, color: C.mute }}>
          <Loader2 size={14} className="animate-spin" /> {busy ? "Đang đăng nhập…" : ""}
        </div>
      )}
      {state === "missing" && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-center px-3 rounded-full" style={{ ...font, color: C.mute, border: `1px dashed ${C.line}` }}>
          Đăng nhập Google chưa được bật (thiếu GOOGLE_CLIENT_ID trong BE/.env)
        </div>
      )}
    </div>
  );
}
