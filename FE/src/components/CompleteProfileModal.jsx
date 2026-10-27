import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { C } from "../constants";
import { api } from "../api";
import RoleFields, { roleFieldsError } from "./RoleFields";

// Tài khoản tạo trước khi có các trường này: bắt buộc bổ sung ngày sinh, giới tính, vai trò trước khi dùng tiếp
export default function CompleteProfileModal({ user, onDone, onLogout }) {
  const [info, setInfo] = useState({
    birthDate: user.birthDate ? String(user.birthDate).slice(0, 10) : "",
    gender: user.gender || "",
    school: user.school || "",
    role: user.role || "",
    teachingSubjects: user.teachingSubjects || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault();
    const err = roleFieldsError(info);
    if (err) return setError(err);
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateMe(info);
      onDone({ ...updated, id: updated._id });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(28,37,65,0.55)" }}>
      <form onSubmit={save} className="w-full max-w-sm rounded-2xl p-5 space-y-3 my-auto" style={{ background: C.card }}>
        <div>
          <div className="text-lg" style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 700 }}>
            Hoàn thiện hồ sơ
          </div>
          <p className="text-sm mt-1" style={{ fontFamily: "'Inter', sans-serif", color: C.mute }}>
            Chào {user.name}! Cho Góc Học biết bạn là ai để gợi ý đúng môn học cho bạn nhé.
          </p>
        </div>

        <RoleFields value={info} onChange={setInfo} />

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: `${C.coral}1a`, color: C.coral, fontFamily: "'Inter', sans-serif" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-60"
          style={{ background: C.ink, color: C.paper, fontFamily: "'Inter', sans-serif" }}
        >
          {saving && <Loader2 size={15} className="animate-spin" />} Tiếp tục
        </button>
        <button type="button" onClick={onLogout} className="w-full text-xs hover:underline" style={{ color: C.mute, fontFamily: "'Inter', sans-serif" }}>
          Đăng xuất
        </button>
      </form>
    </div>
  );
}
