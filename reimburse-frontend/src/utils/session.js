/**
 * Persist auth tokens in localStorage + first-party cookies.
 * iOS Safari / home-screen web apps often drop localStorage while cookies survive.
 */

function setCookie(name, value, maxAgeSec) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

function clearCookie(name) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

const AT_KEY = "token";
const RT_KEY = "refreshToken";
const AT_COOKIE = "whtb_at";
const RT_COOKIE = "whtb_rt";
const AT_MAX_AGE = 30 * 86400;
const RT_MAX_AGE = 90 * 86400;

export function hydrateSessionFromCookies() {
  try {
    const at = getCookie(AT_COOKIE);
    const rt = getCookie(RT_COOKIE);
    if (at && !localStorage.getItem(AT_KEY)) localStorage.setItem(AT_KEY, at);
    if (rt && !localStorage.getItem(RT_KEY)) localStorage.setItem(RT_KEY, rt);
  } catch {
    /* ignore */
  }
}

export function getAccessToken() {
  hydrateSessionFromCookies();
  try {
    return localStorage.getItem(AT_KEY) || getCookie(AT_COOKIE);
  } catch {
    return getCookie(AT_COOKIE);
  }
}

export function getRefreshToken() {
  hydrateSessionFromCookies();
  try {
    return localStorage.getItem(RT_KEY) || getCookie(RT_COOKIE);
  } catch {
    return getCookie(RT_COOKIE);
  }
}

export function setSessionTokens({ token, refreshToken } = {}) {
  try {
    if (token) {
      localStorage.setItem(AT_KEY, token);
      setCookie(AT_COOKIE, token, AT_MAX_AGE);
    }
    if (refreshToken) {
      localStorage.setItem(RT_KEY, refreshToken);
      setCookie(RT_COOKIE, refreshToken, RT_MAX_AGE);
    }
  } catch {
    if (token) setCookie(AT_COOKIE, token, AT_MAX_AGE);
    if (refreshToken) setCookie(RT_COOKIE, refreshToken, RT_MAX_AGE);
  }
}

export function clearSessionTokens() {
  try {
    localStorage.removeItem(AT_KEY);
    localStorage.removeItem(RT_KEY);
  } catch {
    /* ignore */
  }
  clearCookie(AT_COOKIE);
  clearCookie(RT_COOKIE);
}

export function tokenExpiresAt(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return (payload.exp || 0) * 1000;
  } catch {
    return null;
  }
}

export function accessTokenNeedsRefresh(token, skewMs = 120_000) {
  const exp = tokenExpiresAt(token);
  if (!exp) return true;
  return exp <= Date.now() + skewMs;
}
