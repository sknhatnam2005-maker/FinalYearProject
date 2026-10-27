import React, { useState, useEffect, useRef } from "react";
import { Pencil, Check, X, Loader2, Camera, Trash2, School, Lock } from "lucide-react";
import { C } from "../constants";
import { api, resizeImage } from "../api";
import Avatar from "./Avatar";
import RoleBadge from "./RoleBadge";
import SubjectTag from "./SubjectTag";
import RoleFields, { roleFieldsError } from "./RoleFields";
import { GENDERS } from "../roles";
import FriendsModal from "./FriendsModal";

// Kích thước ảnh sau khi cắt/thu nhỏ ở trình duyệt
const AVATAR_SIZE = [256, 256];
const COVER_SIZE = [1200, 400];

function ImageButton({ onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full hover:opacity-90"
      style={{ background: "rgba(28,37,65,0.7)", color: "#fff", fontFamily: "'Inter', sans-serif" }}
    >
      {children}
    </button>
  );
}

export default function MyProfile({ user, postCount, onUpdated, onOpenPerson, children }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [friendCount, setFriendCount] = useState(0);

  const avatarInput = useRef(null);
  const coverInput = useRef(null);

  const avatarColor = user.avatarColor && user.avatarColor !== C.ink ? user.avatarColor : C.mustard;
  const avatarUrl = editing ? form.avatarUrl : user.avatarUrl;
  const coverUrl = editing ? form.coverUrl : user.coverUrl;

  const [incomingCount, setIncomingCount] = useState(0);
  const [friendsModalTab, setFriendsModalTab] = useState(null); // null = đóng

  const loadFriendStats = () =>
    Promise.all([api.getFriends(), api.getFriendRequests()])
      .then(([friends, incoming]) => {
        setFriendCount(friends.length);
        setIncomingCount(incoming.length);
      })
      .catch(() => {});

  useEffect(() => {
    loadFriendStats();
  }, [user.id]);

  const startEdit = () => {
    setForm({
      name: user.name,
      handle: user.handle,
      bio: user.bio || "",
      avatarUrl: user.avatarUrl || "",
      coverUrl: user.coverUrl || "",
      birthDate: user.birthDate ? String(user.birthDate).slice(0, 10) : "",
      gender: user.gender || "",
      school: user.school || "",
      role: user.role || "",
      teachingSubjects: user.teachingSubjects || [],
    });
    setError("");
    setEditing(true);
  };

  const pickImage = (key, [w, h]) => async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, w, h);
      setForm((f) => ({ ...f, [key]: dataUrl }));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async () => {
    const roleErr = roleFieldsError(form);
    if (roleErr) return setError(roleErr);
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateMe(form);
      onUpdated({ ...updated, id: updated._id });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const inputStyle = {
    background: C.paper,
    border: `1px solid ${C.line}`,
    color: C.ink,
    fontFamily: "'Inter', sans-serif",
  };
  const labelStyle = { color: C.ink2, fontFamily: "'Inter', sans-serif" };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <div
          className="h-32 sm:h-40 relative bg-cover bg-center"
          style={{ backgroundColor: C.ink, backgroundImage: coverUrl ? `url(${coverUrl})` : undefined }}
        >
          {editing && (
            <div className="absolute top-3 right-3 flex gap-2">
              <ImageButton onClick={() => coverInput.current.click()}>
                <Camera size={14} /> {coverUrl ? "Đổi ảnh bìa" : "Thêm ảnh bìa"}
              </ImageButton>
              {coverUrl && (
                <ImageButton title="Xoá ảnh bìa" onClick={() => setForm((f) => ({ ...f, coverUrl: "" }))}>
                  <Trash2 size={14} />
                </ImageButton>
              )}
            </div>
          )}
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={pickImage("coverUrl", COVER_SIZE)} />
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between gap-3">
            <div className="relative z-10 -mt-12 inline-flex rounded-full" style={{ border: `4px solid ${C.card}`, background: C.card }}>
              <Avatar label={(editing ? form.name : user.name) || "?"} size={88} color={avatarColor} src={avatarUrl} />
              {editing && (
                <button
                  type="button"
                  onClick={() => avatarInput.current.click()}
                  title="Đổi ảnh đại diện"
                  className="absolute inset-0 rounded-full flex items-center justify-center opacity-80 hover:opacity-100"
                  style={{ background: "rgba(28,37,65,0.45)", color: "#fff" }}
                >
                  <Camera size={22} />
                </button>
              )}
              {editing && avatarUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, avatarUrl: "" }))}
                  title="Xoá ảnh đại diện"
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: C.card, color: C.coral, border: `1px solid ${C.line}` }}
                >
                  <Trash2 size={13} />
                </button>
              )}
              <input ref={avatarInput} type="file" accept="image/*" hidden onChange={pickImage("avatarUrl", AVATAR_SIZE)} />
            </div>
            {!editing && (
              <button
                onClick={startEdit}
                className="mt-3 flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-80"
                style={{ background: C.card, color: C.ink, border: `1px solid ${C.ink}` }}
              >
                <Pencil size={14} /> Chỉnh sửa hồ sơ
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium" style={labelStyle}>Tên hiển thị</label>
                <input value={form.name} onChange={set("name")} maxLength={50} className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs font-medium" style={labelStyle}>Username</label>
                <div className="mt-1 flex items-center rounded-lg px-3" style={inputStyle}>
                  <span className="text-sm" style={{ color: C.mute }}>@</span>
                  <input value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9._]/g, "") }))} maxLength={30} className="flex-1 py-2 bg-transparent text-sm outline-none" style={{ fontFamily: "'IBM Plex Mono', monospace" }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium flex justify-between" style={labelStyle}>
                  Giới thiệu <span style={{ color: C.mute }}>{form.bio.length}/160</span>
                </label>
                <textarea value={form.bio} onChange={set("bio")} maxLength={160} rows={3} placeholder="Bạn đang học gì, quan tâm chủ đề nào?" className="mt-1 w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs font-medium" style={labelStyle}>Thông tin cá nhân</label>
                <div className="mt-1">
                  <RoleFields
                    value={{ birthDate: form.birthDate, gender: form.gender, school: form.school, role: form.role, teachingSubjects: form.teachingSubjects }}
                    onChange={(v) => setForm((f) => ({ ...f, ...v }))}
                  />
                </div>
              </div>

              {error && <div className="text-sm" style={{ color: C.coral, fontFamily: "'Inter', sans-serif" }}>{error}</div>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-80"
                  style={{ color: C.ink, border: `1px solid ${C.line}` }}
                >
                  <X size={14} /> Huỷ
                </button>
                <button
                  onClick={save}
                  disabled={saving || !form.name.trim()}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50"
                  style={{ background: C.ink, color: C.paper }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Lưu
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 text-xl flex items-center gap-2 flex-wrap" style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 700 }}>
                {user.name} <RoleBadge role={user.role} full />
              </div>
{user.school && (
            <div className="mt-2 flex items-center gap-1.5 text-sm" style={{ fontFamily: "'Inter', sans-serif", color: C.ink2 }}>
              <School size={14} color={C.mute} /> {user.school}
            </div>
          )}
          {(user.birthDate || user.gender) && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-xs" style={{ fontFamily: "'Inter', sans-serif", color: C.mute }}>
              <Lock size={11} />
              {user.birthDate && <span>Sinh ngày {new Date(user.birthDate).toLocaleDateString("vi-VN", { timeZone: "UTC" })}</span>}
              {user.birthDate && user.gender && <span>·</span>}
              {user.gender && <span>{GENDERS[user.gender]}</span>}
              <span>· chỉ bạn thấy</span>
            </div>
          )}
          {user.role === "giang_vien" && user.teachingSubjects?.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" style={{ fontFamily: "'Inter', sans-serif", color: C.mute }}>
              Giảng dạy: {user.teachingSubjects.map((s) => <SubjectTag key={s} name={s} />)}
            </div>
          )}
              <div className="text-sm" style={{ color: C.mute, fontFamily: "'IBM Plex Mono', monospace" }}>
                @{user.handle}
              </div>
              <p className="mt-3 text-sm whitespace-pre-line" style={{ color: user.bio ? C.ink2 : C.mute, fontFamily: "'Inter', sans-serif" }}>
                {user.bio || "Chưa có giới thiệu."}
              </p>
              <div className="flex items-center gap-5 text-sm mt-4 flex-wrap" style={{ fontFamily: "'Inter', sans-serif", color: C.ink2 }}>
                <span><b>{postCount}</b> bài viết</span>
                <button onClick={() => setFriendsModalTab("friends")} className="hover:underline">
                  <b>{friendCount}</b> bạn bè
                </button>
                {incomingCount > 0 && (
                  <button
                    onClick={() => setFriendsModalTab("incoming")}
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full hover:opacity-80"
                    style={{ background: `${C.coral}1a`, color: C.coral }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.coral }} />
                    {incomingCount} lời mời kết bạn
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {children}

      {friendsModalTab && (
        <FriendsModal
          initialTab={friendsModalTab}
          onClose={() => {
            setFriendsModalTab(null);
            loadFriendStats();
          }}
          onOpenPerson={onOpenPerson}
          onFriendCountChange={setFriendCount}
        />
      )}
    </div>
  );
}
