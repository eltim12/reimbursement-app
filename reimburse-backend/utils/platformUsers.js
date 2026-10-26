/**
 * Platform (admin.whtb.glass) users for the purchasing pemohon picker.
 * Never throws — returns [] on misconfig / network failure.
 */

function platformApiBase() {
  return String(process.env.PLATFORM_API_URL || "http://127.0.0.1:3020").replace(
    /\/$/,
    "",
  );
}

function platformSecret() {
  return String(process.env.PLATFORM_INTERNAL_SECRET || "").trim();
}

/**
 * @param {string} [search]
 * @param {string} [companySlug]
 * @returns {Promise<Array<{ id: string, email: string, name: string }>>}
 */
async function searchPlatformUsers(search = "", companySlug = "whtb") {
  const secret = platformSecret();
  const base = platformApiBase();
  if (!secret || !base) return [];
  try {
    const params = new URLSearchParams();
    params.set("companySlug", String(companySlug || "whtb").trim().toLowerCase() || "whtb");
    if (String(search || "").trim()) params.set("search", String(search).trim());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `${base}/api/internal/company-users?${params}`,
      {
        headers: { "x-platform-internal-secret": secret },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.data) ? body.data : [];
  } catch {
    return [];
  }
}

module.exports = { searchPlatformUsers };
