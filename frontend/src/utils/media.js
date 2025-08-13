const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

export function toAbsoluteUrl(url) {
  if (!url) return '';
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/uploads/')) return `${API_ORIGIN}${url}`;
    return url;
  } catch {
    return url;
  }
}
