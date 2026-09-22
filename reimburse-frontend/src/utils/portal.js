/** Canonical WHTB app portal (only login entrance). */
export function portalBaseUrl() {
  return (import.meta.env.VITE_PORTAL_URL || "https://app.whtb.glass").replace(
    /\/$/,
    "",
  );
}

export function portalLoginUrl({ logout = false } = {}) {
  const base = `${portalBaseUrl()}/login`;
  return logout ? `${base}?logout=1` : base;
}

/** Hard-navigate to portal login (optionally force portal session clear). */
export function redirectToPortalLogin({ logout = false } = {}) {
  window.location.replace(portalLoginUrl({ logout }));
}
