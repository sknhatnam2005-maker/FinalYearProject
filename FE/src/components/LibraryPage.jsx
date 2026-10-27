import React, { useState, useEffect } from "react";
import { Search, Loader2, FileText, Download, ExternalLink, MessageSquareText, Library, X } from "lucide-react";
import { C } from "../constants";
import { subjectColor } from "../data";
import SubjectPicker from "./SubjectPicker";
import { api, fileUrl, formatSize, timeAgo } from "../api";
import EmptyState from "./EmptyState";
import SubjectTag from "./SubjectTag";
import { DocMeta } from "./Attachments";

const font = { fontFamily: "'Inter', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const EMPTY_FILTERS = { subject: "", semester: "", lecturer: "", type: "", q: "" };

function DocCard({ doc, onOpenPost }) {
  const isImage = doc.mimeType.startsWith("image/");
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <a href={fileUrl(doc._id)} target="_blank" rel="noreferrer" className="block h-32 relative" style={{ background: C.paper }}>
        {isImage ? (
          <img src={fileUrl(doc._id)} alt={doc.name} loading="lazy" className="w-full h-full object-cover hover:opacity-90" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ background: `${C.coral}12` }}>
            <FileText size={34} color={C.coral} />
            <span className="text-[10px] font-semibold tracking-wider" style={{ ...mono, color: C.coral }}>PDF</span>
          </div>
        )}
      </a>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <a href={fileUrl(doc._id)} target="_blank" rel="noreferrer" className="text-sm font-semibold leading-snug line-clamp-2 hover:underline" style={{ ...font, color: C.ink }} title={doc.name}>
          {doc.name}
        </a>
        <div><SubjectTag name={doc.subject} /></div>
        <DocMeta semester={doc.semester} lecturer={doc.lecturer} />
        <div className="text-[11px] mt-auto pt-1" style={{ ...font, color: C.mute }}>
          {doc.author?.name || "Người dùng"} · {timeAgo(doc.createdAt)} · {formatSize(doc.size)}
        </div>
      </div>
      <div className="flex" style={{ borderTop: `1px solid ${C.line}` }}>
        {[
          { icon: ExternalLink, label: "Xem", href: fileUrl(doc._id), target: "_blank" },
          { icon: Download, label: "Tải", href: fileUrl(doc._id, { download: true }) },
          { icon: MessageSquareText, label: "Bài đăng", onClick: () => onOpenPost(doc.postId) },
        ].map(({ icon: Icon, label, ...action }, i) => {
          const Tag = action.href ? "a" : "button";
          return (
            <Tag
              key={label}
              {...(action.href ? { href: action.href, target: action.target, rel: "noreferrer" } : { onClick: action.onClick })}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium hover:opacity-70"
              style={{ ...font, color: C.ink2, borderLeft: i ? `1px solid ${C.line}` : "none" }}
            >
              <Icon size={13} /> {label}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

export default function LibraryPage({ onOpenPost }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [facets, setFacets] = useState({ subjects: [], semesters: [], lecturers: [] });
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getLibraryFacets().then(setFacets).catch(() => {});
  }, []);

  // Gõ tìm kiếm: đợi 300ms sau phím cuối mới gọi API
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() })), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .getLibrary(filters)
      .then((res) => {
        if (cancelled) return;
        setDocs(res.items);
        setTotal(res.total);
        setHasMore(res.hasMore);
        setPage(1);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await api.getLibrary({ ...filters, page: page + 1 });
      setDocs((d) => [...d, ...res.items]);
      setHasMore(res.hasMore);
      setPage(page + 1);
    } finally {
      setLoadingMore(false);
    }
  };

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: f[key] === value ? "" : value }));
  const activeCount = ["subject", "semester", "lecturer", "type"].filter((k) => filters[k]).length + (filters.q ? 1 : 0);

  const selectStyle = { ...font, background: C.card, border: `1px solid ${C.line}`, color: C.ink };
  const chip = (active, color = C.ink) => ({
    ...font,
    background: active ? color : C.card,
    color: active ? "#fff" : C.ink2,
    border: `1px solid ${active ? color : C.line}`,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 space-y-3" style={{ background: C.card, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-lg" style={{ fontFamily: "'Fraunces', serif", color: C.ink, fontWeight: 700 }}>
              Thư viện tài liệu
            </div>
            <div className="text-xs" style={{ ...font, color: C.mute }}>
              Slide, đề thi, ghi chép được chia sẻ trong các bài đăng
            </div>
          </div>
          {activeCount > 0 && (
            <button
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setSearch("");
              }}
              className="flex items-center gap-1 text-xs font-medium hover:opacity-70 shrink-0"
              style={{ ...font, color: C.coral }}
            >
              <X size={13} /> Xoá bộ lọc ({activeCount})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-full" style={{ background: C.paper, border: `1px solid ${C.line}` }}>
          <Search size={15} style={{ color: C.mute }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên file, mô tả, giảng viên..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ ...font, color: C.ink }}
          />
        </div>

        {/* Chỉ hiện các môn đang có tài liệu; muốn môn khác thì chọn qua ô tìm môn */}
        <div className="flex items-center gap-1.5">
          <div className="shrink-0 max-w-[50%]">
            <SubjectPicker all placeholder="Tìm môn..." value={filters.subject} onChange={(label) => setFilters((f) => ({ ...f, subject: label }))} />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 min-w-0">
          {facets.subjects.map((s) => (
            <button
              key={s.value}
              onClick={() => set("subject", s.value)}
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={chip(filters.subject === s.value, subjectColor(s.value))}
            >
              {s.value}
              <span style={{ opacity: 0.7 }}>{s.count}</span>
            </button>
          ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={filters.semester} onChange={(e) => setFilters((f) => ({ ...f, semester: e.target.value }))} className="px-3 py-2 rounded-lg text-sm outline-none" style={selectStyle}>
            <option value="">Mọi học kỳ</option>
            {facets.semesters.map((s) => (
              <option key={s.value} value={s.value}>{s.value} ({s.count})</option>
            ))}
          </select>
          <select value={filters.lecturer} onChange={(e) => setFilters((f) => ({ ...f, lecturer: e.target.value }))} className="px-3 py-2 rounded-lg text-sm outline-none" style={selectStyle}>
            <option value="">Mọi giảng viên</option>
            {facets.lecturers.map((l) => (
              <option key={l.value} value={l.value}>{l.value} ({l.count})</option>
            ))}
          </select>
          <div className="flex gap-1">
            {[
              { key: "", label: "Tất cả" },
              { key: "pdf", label: "PDF" },
              { key: "image", label: "Ảnh" },
            ].map((t) => (
              <button
                key={t.label}
                onClick={() => setFilters((f) => ({ ...f, type: t.key }))}
                className="flex-1 text-xs font-semibold px-2 py-2 rounded-lg"
                style={chip(filters.type === t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loading && !error && docs.length > 0 && (
        <div className="text-xs px-1" style={{ ...mono, color: C.mute }}>
          {total} tài liệu
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin" color={C.mute} size={22} />
        </div>
      ) : error ? (
        <EmptyState icon={Library} title="Không tải được thư viện" body={error} />
      ) : docs.length ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {docs.map((d) => (
              <DocCard key={d._id} doc={d} onOpenPost={onOpenPost} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-full hover:opacity-80 disabled:opacity-50"
                style={{ ...font, background: C.card, color: C.ink, border: `1px solid ${C.ink}` }}
              >
                {loadingMore && <Loader2 size={14} className="animate-spin" />} Xem thêm
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Library}
          title={activeCount ? "Không có tài liệu khớp bộ lọc" : "Thư viện còn trống"}
          body={activeCount ? "Thử bỏ bớt bộ lọc hoặc đổi từ khoá." : "Đính kèm PDF hoặc ảnh khi đăng bài (nút 📎 Tài liệu) để tài liệu xuất hiện ở đây."}
        />
      )}
    </div>
  );
}
