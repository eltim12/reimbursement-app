const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseListPage(query = {}) {
  const page = parsePositiveInt(query.page, 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE),
  );
  const q = String(query.q ?? "").trim().slice(0, 200);
  const paginate = query.page != null || query.pageSize != null;
  return {
    page,
    pageSize,
    q,
    paginate,
    offset: (page - 1) * pageSize,
  };
}

function listSearchClause(q) {
  const term = String(q || "").trim();
  if (!term) return { sql: "", params: [] };
  const like = `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  return {
    sql: ` AND (l.name LIKE ? ESCAPE '\\\\' OR CAST(l.id AS CHAR) LIKE ? ESCAPE '\\\\' OR IFNULL(u.name, '') LIKE ? ESCAPE '\\\\' OR IFNULL(u.email, '') LIKE ? ESCAPE '\\\\')`,
    params: [like, like, like, like],
  };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseListPage,
  listSearchClause,
};
