import React, { useState, useRef, useEffect } from "react";
import { Paperclip, Send, PenLine, HelpCircle, X, Loader2, FileText, AlertCircle, AlertTriangle, ImagePlus } from "lucide-react";
import { C } from "../constants";
import { semesterOptions } from "../data";
import { api, uploadFile, compressImage, formatSize, ACCEPTED_FILES } from "../api";
import Avatar from "./Avatar";
import VisibilityPicker, { loadLastVisibility } from "./VisibilityPicker";
import SubjectPicker, { loadRecentSubjects, rememberSubject } from "./SubjectPicker";

const MAX_FILES = 10;
const IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";
const font = { fontFamily: "'Inter', sans-serif" };

export default function Composer({ onPost, user }) {
  const [text, setText] = useState("");
  const [subject, setSubject] = useState(() => loadRecentSubjects()[0] || user?.teachingSubjects?.[0] || "");

  // Môn mặc định (lấy từ "gần đây") có thể không còn hợp với vai trò hiện tại → bỏ chọn
  useEffect(() => {
    if (!user?.role) return;
    api
      .getSubjects("", 50)
      .then((list) => {
        const labels = list.map((s) => s.label);
        setSubject((s) => (labels.includes(s) ? s : user.teachingSubjects?.[0] || ""));
      })
      .catch(() => {});
  }, [user?.role, user?.teachingSubjects?.join("|")]);
  const [dragging, setDragging] = useState(false);
  const photoInput = useRef(null);
  const [posting, setPosting] = useState(false);
  const [type, setType] = useState("post");
  const [visibility, setVisibility] = useState(loadLastVisibility);
  const isQuestion = type === "question";

  // Mỗi file được upload ngay khi chọn để lúc bấm Đăng không phải chờ
  const [files, setFiles] = useState([]); // { key, name, size, mimeType, previewUrl, status, fileId, error }
  const [semester, setSemester] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [lecturerOptions, setLecturerOptions] = useState([]);
  const [error, setError] = useState("");
  const fileInput = useRef(null);

  const hasFiles = files.length > 0;
  const photos = files.filter((f) => f.kind === "photo");
  const docs = files.filter((f) => f.kind === "document");
  const hasDocs = docs.length > 0;
  const uploading = files.some((f) => f.status === "uploading");

  // Gợi ý giảng viên đã có trong thư viện để mọi người gõ thống nhất một cách
  useEffect(() => {
    if (!hasDocs || lecturerOptions.length) return;
    api.getLibraryFacets().then((f) => setLecturerOptions(f.lecturers.map((l) => l.value))).catch(() => {});
  }, [hasDocs]);

  const patchFile = (key, patch) => setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  // kind: "photo" (ảnh thường) | "document" (vào Thư viện). PDF luôn là tài liệu.
  const addFiles = (list, kind) => {
    const accepted = [...list].filter((f) => ACCEPTED_FILES.split(",").includes(f.type));
    setError(accepted.length < list.length ? "Chỉ hỗ trợ ảnh (JPG, PNG, WebP, GIF) và PDF." : "");
    const room = MAX_FILES - files.length;
    if (accepted.length > room) setError(`Mỗi bài đăng tối đa ${MAX_FILES} file.`);

    for (const original of accepted.slice(0, room)) {
      const key = `${original.name}-${original.size}-${Math.random()}`;
      const fileKind = original.type === "application/pdf" ? "document" : kind;
      setFiles((fs) => [
        ...fs,
        {
          key,
          kind: fileKind,
          name: original.name,
          size: original.size,
          mimeType: original.type,
          previewUrl: original.type.startsWith("image/") ? URL.createObjectURL(original) : null,
          status: "uploading",
        },
      ]);
      // Ảnh thường thì nén cho nhẹ; ảnh tài liệu (slide, đề thi) giữ nguyên để chữ không bị mờ
      (fileKind === "photo" ? compressImage(original) : Promise.resolve(original))
        .then((file) => uploadFile(file).then(({ fileId, size }) => patchFile(key, { status: "done", fileId, size })))
        .catch((err) => patchFile(key, { status: "error", error: err.message }));
    }
  };

  const pickFiles = (kind) => (e) => {
    addFiles(e.target.files, kind);
    e.target.value = "";
  };

  // Dán ảnh chụp màn hình (Ctrl+V) vào ô soạn thảo
  const onPaste = (e) => {
    const pasted = [...e.clipboardData.files];
    if (!pasted.length) return;
    e.preventDefault();
    addFiles(pasted, "photo");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files, "photo");
  };

  const toggleKind = (key) =>
    setFiles((fs) => fs.map((f) => (f.key === key && f.mimeType !== "application/pdf" ? { ...f, kind: f.kind === "photo" ? "document" : "photo" } : f)));

  const removeFile = (key) =>
    setFiles((fs) => {
      const f = fs.find((x) => x.key === key);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return fs.filter((x) => x.key !== key);
    });

  const reset = () => {
    files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    setText("");
    setType("post");
    setFiles([]);
    setSemester("");
    setLecturer("");
    setError("");
    setMismatch(null);
    setKeepSubject("");
  };

  // ---------- Kiểm tra nội dung có khớp môn đã chọn ----------
  // mismatch: { suggestion, hits } khi nội dung nghiêng hẳn sang môn khác.
  // keepSubject: người dùng đã bấm "Vẫn đăng ở môn này" cho đúng môn đó.
  const [mismatch, setMismatch] = useState(null);
  const [keepSubject, setKeepSubject] = useState("");
  const checkText = [text, ...files.map((f) => f.name)].join(" ");

  useEffect(() => {
    if (!subject || text.trim().length < 15) {
      setMismatch(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .checkSubject(checkText, subject)
        .then((r) => setMismatch(r.ok ? null : r))
        .catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [checkText, subject]);

  const showWarning = mismatch && keepSubject !== subject;

  const switchToSuggested = () => {
    rememberSubject(mismatch.suggestion);
    setSubject(mismatch.suggestion);
    setMismatch(null);
  };

  const handlePost = async () => {
    if (!text.trim() || posting || uploading) return;
    if (!subject) {
      setError("Chọn môn học cho bài đăng nhé.");
      return;
    }
    setPosting(true);
    setError("");
    try {
      await onPost({
        content: text,
        subject,
        type,
        attachments: files.filter((f) => f.status === "done").map((f) => ({ fileId: f.fileId, kind: f.kind })),
        semester: hasDocs ? semester : "",
        lecturer: hasDocs ? lecturer : "",
        ignoreSubjectWarning: keepSubject === subject,
        visibility,
      });
      reset();
    } catch (err) {
      // BE phát hiện lệch môn (vd. bấm Đăng trước khi kiểm tra trực tiếp kịp chạy) → hiện cảnh báo
      if (err.data?.code === "SUBJECT_MISMATCH") setMismatch(err.data);
      else setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  const inputStyle = { ...font, background: C.paper, border: `1px solid ${C.line}`, color: C.ink };

  const statusLine = (f) => (
    <>
      {f.status === "uploading" && <><Loader2 size={11} className="animate-spin" /> Đang tải lên...</>}
      {f.status === "done" && formatSize(f.size)}
      {f.status === "error" && <><AlertCircle size={11} /> {f.error || "Lỗi"}</>}
    </>
  );

  // Nút nhỏ để chuyển một ảnh qua lại giữa "ảnh thường" và "tài liệu"
  const kindToggle = (f) =>
    f.mimeType !== "application/pdf" && (
      <button
        onClick={() => toggleKind(f.key)}
        title={f.kind === "photo" ? "Chuyển thành tài liệu (đưa vào Thư viện)" : "Chuyển thành ảnh thường"}
        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full hover:opacity-80"
        style={{ ...font, background: "rgba(28,37,65,0.7)", color: "#fff" }}
      >
        {f.kind === "photo" ? "→ Tài liệu" : "→ Ảnh"}
      </button>
    );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false)}
      onDrop={onDrop}
      className="relative rounded-2xl p-4 mb-5"
      style={{ background: C.card, border: `1px ${dragging ? "dashed" : "solid"} ${dragging ? C.green : isQuestion ? C.mustard : C.line}` }}
    >
      {dragging && (
        <div className="absolute inset-0 z-10 rounded-2xl flex items-center justify-center pointer-events-none" style={{ background: `${C.green}14` }}>
          <span className="text-sm font-semibold" style={{ ...font, color: C.green }}>Thả ảnh hoặc PDF vào đây</span>
        </div>
      )}

      <div className="flex gap-1 mb-3">
        {[
          { key: "post", label: "Bài viết", icon: PenLine },
          { key: "question", label: "Đặt câu hỏi", icon: HelpCircle },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{
              ...font,
              background: type === t.key ? (t.key === "question" ? C.mustard : C.ink) : "transparent",
              color: type === t.key ? "#fff" : C.mute,
            }}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Avatar label={user?.name || "Bạn"} color={C.ink} src={user?.avatarUrl} />
        <div className="flex-1 min-w-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            placeholder={
              isQuestion
                ? "Bạn đang bí ở đâu? Mô tả rõ câu hỏi, bạn đã thử những gì... (dán ảnh chụp màn hình bằng Ctrl+V)"
                : hasDocs
                ? "Mô tả tài liệu: slide chương mấy, đề thi năm nào, ghi chú gì..."
                : "Bạn đang học gì hôm nay? Chia sẻ với cộng đồng nhé..."
            }
            rows={2}
            className="w-full resize-none outline-none text-[15px] bg-transparent placeholder:opacity-60"
            style={{ ...font, color: C.ink }}
          />

          {photos.length > 0 && (
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((f) => (
                <div
                  key={f.key}
                  className="relative aspect-square rounded-xl overflow-hidden"
                  style={{ background: C.paper, outline: f.status === "error" ? `2px solid ${C.coral}` : "none" }}
                  title={f.error || f.name}
                >
                  <img src={f.previewUrl} alt="" className="w-full h-full object-cover" style={{ opacity: f.status === "done" ? 1 : 0.5 }} />
                  {f.status === "uploading" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin" color={C.ink} />
                    </div>
                  )}
                  {f.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(228,87,46,0.25)" }}>
                      <AlertCircle size={20} color="#fff" />
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(f.key)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(28,37,65,0.7)", color: "#fff" }}
                  >
                    <X size={13} />
                  </button>
                  <div className="absolute bottom-1 left-1">{kindToggle(f)}</div>
                </div>
              ))}
            </div>
          )}

          {hasDocs && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                {docs.map((f) => (
                  <div
                    key={f.key}
                    className="relative flex items-center gap-2 pl-1.5 pr-7 py-1.5 rounded-xl max-w-[240px]"
                    style={{ background: C.paper, border: `1px solid ${f.status === "error" ? C.coral : C.line}` }}
                    title={f.error || f.name}
                  >
                    {f.previewUrl ? (
                      <img src={f.previewUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${C.coral}1a` }}>
                        <FileText size={18} color={C.coral} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate" style={{ ...font, color: C.ink }}>{f.name}</div>
                      <div className="text-[11px] flex items-center gap-1" style={{ ...font, color: f.status === "error" ? C.coral : C.mute }}>
                        {statusLine(f)}
                      </div>
                      {kindToggle(f)}
                    </div>
                    <button
                      onClick={() => removeFile(f.key)}
                      className="absolute top-1 right-1 p-0.5 rounded-full hover:opacity-70"
                      style={{ color: C.mute }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Thông tin để tài liệu được xếp đúng chỗ trong Thư viện */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <input
                    list="semester-options"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    maxLength={40}
                    placeholder="Học kỳ (vd. Fall 2025)"
                    className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
                    style={inputStyle}
                  />
                  <datalist id="semester-options">
                    {semesterOptions().map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <input
                    list="lecturer-options"
                    value={lecturer}
                    onChange={(e) => setLecturer(e.target.value)}
                    maxLength={60}
                    placeholder="Giảng viên (vd. Nguyễn Văn A)"
                    className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
                    style={inputStyle}
                  />
                  <datalist id="lecturer-options">
                    {lecturerOptions.map((l) => <option key={l} value={l} />)}
                  </datalist>
                </div>
              </div>
              <div className="text-[11px]" style={{ ...font, color: C.mute }}>
                Tài liệu sẽ được lưu vào <b>Thư viện</b>, mọi người tìm được theo môn, học kỳ và giảng viên.
              </div>
            </div>
          )}

          {showWarning && (
            <div
              className="mt-3 rounded-xl px-3 py-2.5 text-sm"
              style={{ ...font, background: `${C.mustard}1c`, border: `1px solid ${C.mustard}`, color: C.ink2 }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} color="#B97A1C" className="shrink-0 mt-0.5" />
                <div className="min-w-0">
                  Nội dung có vẻ thuộc {mismatch.suggestion ? "môn" : "nhóm môn"}{" "}
                  <b style={{ color: C.ink }}>{mismatch.suggestion || mismatch.groupName}</b>, không phải{" "}
                  <b style={{ color: C.ink }}>{subject}</b>.
                  {mismatch.hits?.length > 0 && (
                    <div className="text-xs mt-0.5" style={{ color: C.mute }}>
                      Vì có các cụm: {mismatch.hits.map((h) => `"${h}"`).join(", ")}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* Không có gợi ý = môn đúng nằm ngoài các môn bạn được đăng (vd. giảng viên không dạy môn đó) */}
                    {mismatch.suggestion && (
                      <button
                        onClick={switchToSuggested}
                        className="text-xs font-semibold px-3 py-1 rounded-full hover:opacity-90"
                        style={{ background: C.ink, color: C.paper }}
                      >
                        Đổi sang {mismatch.suggestion}
                      </button>
                    )}
                    <button
                      onClick={() => setKeepSubject(subject)}
                      className="text-xs font-semibold px-3 py-1 rounded-full hover:opacity-80"
                      style={{ color: C.ink2, border: `1px solid ${C.line}`, background: C.card }}
                    >
                      Vẫn đăng ở {subject}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <div className="mt-2 text-xs" style={{ ...font, color: C.coral }}>{error}</div>}

          {/* Một hàng duy nhất: [ảnh][tài liệu][quyền riêng tư] | [môn — co giãn] | [Đăng] */}
          <div className="flex items-center gap-1 mt-3 pt-3" style={{ borderTop: `1px dashed ${C.line}` }}>
            {[
              { ref: photoInput, icon: ImagePlus, count: photos.length, title: "Thêm ảnh (hoặc kéo-thả / dán Ctrl+V)" },
              { ref: fileInput, icon: Paperclip, count: docs.length, title: "Đính kèm tài liệu PDF, slide, đề thi — sẽ vào Thư viện (tối đa 20MB/file)" },
            ].map(({ ref, icon: Icon, count, title }) => (
              <button
                key={title}
                onClick={() => ref.current.click()}
                disabled={files.length >= MAX_FILES}
                title={title}
                className="relative w-8 h-8 shrink-0 rounded-full flex items-center justify-center hover:bg-black/5 disabled:opacity-40"
                style={{ color: count ? C.green : C.ink2 }}
              >
                <Icon size={18} />
                {count > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ ...font, background: C.green, color: "#fff" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
            <input ref={photoInput} type="file" accept={IMAGE_TYPES} multiple hidden onChange={pickFiles("photo")} />
            <input ref={fileInput} type="file" accept={ACCEPTED_FILES} multiple hidden onChange={pickFiles("document")} />
            <VisibilityPicker compact value={visibility} onChange={setVisibility} />

            <div className="w-px h-5 mx-1 shrink-0" style={{ background: C.line }} />

            <div className="flex-1 min-w-0">
              <SubjectPicker
                popularLabel={user?.role === "giang_vien" ? "Môn bạn dạy" : "Phổ biến"}
                value={subject}
                onChange={(s) => {
                  setSubject(s);
                  setError("");
                }}
              />
            </div>

            <button
              disabled={!text.trim() || posting || uploading}
              onClick={handlePost}
              className="shrink-0 flex items-center gap-1.5 text-sm font-semibold pl-3.5 pr-4 py-1.5 rounded-full transition-opacity disabled:opacity-40"
              style={{ background: isQuestion ? C.mustard : C.ink, color: isQuestion ? "#fff" : C.paper, ...font }}
              title={uploading ? "Đợi file tải lên xong" : undefined}
            >
              {posting || uploading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {posting ? "Đang đăng" : uploading ? "Đang tải" : "Đăng"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
