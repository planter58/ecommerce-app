const API_BASE = import.meta.env.VITE_API_URL || 'https://ecommerce-app-z4wp.onrender.com/api';
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

// Return a URL suitable for 4:3 cover without client-side crop when hosted on Cloudinary.
// If not Cloudinary, fall back to the absolute URL (caller can use a blurred underlay for fill look).
export function toCoverUrl(url, aspect = '4:3') {
  const abs = toAbsoluteUrl(url);
  if (!abs) return '';
  try {
    const u = new URL(abs);
    const host = u.hostname;
    // Basic Cloudinary detection and transformation insertion: /image/upload/ => /image/upload/<transforms>/
    if (host.includes('res.cloudinary.com') && u.pathname.includes('/image/upload/')) {
      const parts = u.pathname.split('/image/upload/');
      const before = parts[0];
      const after = parts[1] || '';
      const transforms = `c_fill,ar_${aspect.replace(':', ':')},g_auto,f_auto,q_auto`;
      u.pathname = `${before}/image/upload/${transforms}/${after}`.replace(/\/+/g, '/');
      return u.toString();
    }
  } catch {
    // ignore
  }
  return abs;
}
