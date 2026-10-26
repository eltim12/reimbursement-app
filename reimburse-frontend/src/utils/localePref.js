/** Shared language preference across WHTB apps (localStorage + .whtb.glass cookie). */

const KEY = "whtb-locale";

function hostAllowsSharedCookie() {
  return (
    window.location.hostname === "whtb.glass" ||
    window.location.hostname.endsWith(".whtb.glass")
  );
}

export function readSharedLocale() {
  const row = document.cookie.split("; ").find((part) => part.startsWith(`${KEY}=`));
  if (row) {
    const value = decodeURIComponent(row.slice(KEY.length + 1));
    if (value) return value;
  }
  return localStorage.getItem(KEY);
}

export function writeSharedLocale(value) {
  localStorage.setItem(KEY, value);
  const domain = hostAllowsSharedCookie() ? "; Domain=.whtb.glass" : "";
  document.cookie = `${KEY}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${domain}`;
}
