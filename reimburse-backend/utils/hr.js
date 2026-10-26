/**
 * HR internal API client for cross-module pickers (purchasing pemohon).
 * Never throws — returns [] on misconfig / network failure.
 */

function hrApiBase() {
  return String(process.env.HR_API_URL || "http://127.0.0.1:3011").replace(
    /\/$/,
    "",
  );
}

function platformSecret() {
  return String(process.env.PLATFORM_INTERNAL_SECRET || "").trim();
}

/**
 * @typedef {{ id: string, employeeCode: string, fullName: string, email: string|null, departmentName: string|null }} HrEmployeeHit
 */

/** @param {string} [search] @returns {Promise<HrEmployeeHit[]>} */
async function searchHrEmployees(search = "") {
  const secret = platformSecret();
  const base = hrApiBase();
  if (!secret || !base) return [];
  try {
    const params = new URLSearchParams();
    if (String(search || "").trim()) {
      params.set("search", String(search).trim());
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${base}/api/internal/employees?${params}`, {
      headers: { "x-platform-internal-secret": secret },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.data) ? body.data : [];
  } catch {
    return [];
  }
}

module.exports = { searchHrEmployees, hrApiBase, platformSecret };
