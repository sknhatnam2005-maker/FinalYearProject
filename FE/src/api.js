const API_URL = "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("gochoc_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Có lỗi xảy ra, vui lòng thử lại");
    err.status = res.status;
    err.data = data; // vd. { code: "SUBJECT_MISMATCH", suggestion, hits }
    throw err;
  }
  return data;
}

export const api = {
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  googleConfig: () => request("/auth/google/config"),
  googleLogin: (credential) => request("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  me: () => request("/auth/me"),
  updateMe: (body) => request("/auth/me", { method: "PUT", body: JSON.stringify(body) }),
  getFollowers: (userId) => request(`/users/${userId}/followers`),
  getFollowing: (userId) => request(`/users/${userId}/following`),

  getPosts: (subject) =>
    request(`/posts${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`),
  createPost: (body) => request("/posts", { method: "POST", body: JSON.stringify(body) }),
  updatePost: (postId, body) => request(`/posts/${postId}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePost: (postId) => request(`/posts/${postId}`, { method: "DELETE" }),
  toggleLike: (postId) => request(`/posts/${postId}/like`, { method: "POST" }),

  getPost: (postId) => request(`/posts/${postId}`),
  getLibrary: (filters = {}) => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    return request(`/library${qs ? `?${qs}` : ""}`);
  },
  getLibraryFacets: () => request("/library/facets"),
  // Mặc định BE chỉ trả môn hợp với vai trò người dùng; all: true để lấy tất cả
  getSubjects: (q = "", limit, { all = false } = {}) => {
    const qs = new URLSearchParams({ ...(q && { q }), ...(limit && { limit }), ...(all && { all: 1 }) }).toString();
    return request(`/subjects${qs ? `?${qs}` : ""}`);
  },
  createSubject: (body) => request("/subjects", { method: "POST", body: JSON.stringify(body) }),
  checkSubject: (content, subject) =>
    request("/subjects/check", { method: "POST", body: JSON.stringify({ content, subject }) }),
  acceptAnswer: (postId, commentId) => request(`/posts/${postId}/accept/${commentId}`, { method: "POST" }),
  getComments: (postId) => request(`/posts/${postId}/comments`),
  updateComment: (commentId, content) =>
    request(`/comments/${commentId}`, { method: "PUT", body: JSON.stringify({ content }) }),
  deleteComment: (commentId) => request(`/comments/${commentId}`, { method: "DELETE" }),
  addComment: (postId, content, media) =>
    request(`/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ content, media }) }),
  searchGifs: (q = "", offset = 0) =>
    request(`/gifs?${new URLSearchParams({ ...(q && { q }), ...(offset && { offset }) })}`),

  toggleFollow: (userId) => request(`/users/${userId}/follow`, { method: "POST" }),

  getGroups: (subject) =>
    request(`/groups${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`),
  createGroup: (body) => request("/groups", { method: "POST", body: JSON.stringify(body) }),
  joinGroup: (groupId) => request(`/groups/${groupId}/join`, { method: "POST" }),

  getConversations: () => request("/conversations"),
  getUnreadMessageCount: () => request("/conversations/unread-count"),
  getMessages: (otherUserId, { before, after } = {}) => {
    const qs = new URLSearchParams({ ...(before && { before }), ...(after && { after }) }).toString();
    return request(`/messages/${otherUserId}${qs ? `?${qs}` : ""}`);
  },
  sendMessage: (receiverId, content, media) =>
    request("/messages", { method: "POST", body: JSON.stringify({ receiverId, content, media }) }),
  searchUsers: (q) => request(`/users/search?q=${encodeURIComponent(q)}`),
  getProfile: (userId) => request(`/users/${userId}/profile`),
  getPostsByAuthor: (authorId) => request(`/posts?authorId=${authorId}`),

  getFriends: () => request("/friends"),
  getFriendRequests: () => request("/friends/requests"),
  getSentFriendRequests: () => request("/friends/sent"),
  getFriendSuggestions: (skipIds = []) =>
    request(`/friends/suggestions${skipIds.length ? `?skip=${skipIds.join(",")}` : ""}`),
  sendFriendRequest: (userId) => request(`/friends/${userId}`, { method: "POST" }),
  acceptFriendRequest: (userId) => request(`/friends/${userId}/accept`, { method: "POST" }),
  removeFriend: (userId) => request(`/friends/${userId}`, { method: "DELETE" }),
  getUserByHandle: (handle) => request(`/users/handle/${encodeURIComponent(handle.replace(/^@/, ""))}`),

  getLiveStreams: () => request("/live"),
  getLiveStream: (id) => request(`/live/${id}`),
  startLive: (body) => request("/live", { method: "POST", body: JSON.stringify(body) }),
  joinLive: (id, session) => request(`/live/${id}/join`, { method: "POST", body: JSON.stringify({ session }) }),
  leaveLive: (id) => request(`/live/${id}/leave`, { method: "POST" }),
  endLive: (id) => request(`/live/${id}/end`, { method: "POST" }),
  pollLive: (id, body) => request(`/live/${id}/poll`, { method: "POST", body: JSON.stringify(body) }),
  sendLiveSignal: (id, body) => request(`/live/${id}/signal`, { method: "POST", body: JSON.stringify(body) }),
  sendLiveChat: (id, text) => request(`/live/${id}/chat`, { method: "POST", body: JSON.stringify({ text }) }),

  getNotifications: () => request("/notifications"),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "POST" }),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "POST" }),
};

export const MAX_UPLOAD_MB = 20;
export const ACCEPTED_FILES = "application/pdf,image/jpeg,image/png,image/webp,image/gif";

// Gửi nguyên nội dung file làm body (BE đọc bằng express.raw), không dùng multipart
export async function uploadFile(file) {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`"${file.name}" vượt quá ${MAX_UPLOAD_MB}MB`);
  const token = getToken();
  const res = await fetch(`${API_URL}/files`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Tải file lên thất bại");
  return data;
}

// Ảnh chụp điện thoại thường 3–8MB: thu về cạnh dài tối đa 2000px, JPEG 85%.
// GIF (có thể là ảnh động) và ảnh đã nhỏ thì giữ nguyên.
export function compressImage(file, maxDim = 2000) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return Promise.resolve(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 1.5 * 1024 * 1024) return resolve(file);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) return resolve(file);
          const name = file.name.replace(/\.\w+$/, "") + ".jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

export function fileUrl(fileId, { download = false } = {}) {
  return `${API_URL}/files/${fileId}${download ? "?download=1" : ""}`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function saveToken(token) {
  localStorage.setItem("gochoc_token", token);
}

export function clearToken() {
  localStorage.removeItem("gochoc_token");
}

// Cắt giữa ảnh theo tỉ lệ width:height rồi thu nhỏ, trả về data URL JPEG
export function resizeImage(file, width, height) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Vui lòng chọn file ảnh"));
    const img = new Image();
    img.onload = () => {
      const scale = Math.max(width / img.width, height / img.height);
      const sw = width / scale;
      const sh = height / scale;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, width, height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Không đọc được ảnh"));
    img.src = URL.createObjectURL(file);
  });
}

export function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
