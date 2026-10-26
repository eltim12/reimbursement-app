const assert = require("node:assert/strict");
const test = require("node:test");
const { parseListPage, listSearchClause } = require("./list-page");

test("list paging stays off unless the client asks for a page", () => {
  const parsed = parseListPage({});
  assert.equal(parsed.paginate, false);
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 20);
  assert.equal(parsed.offset, 0);
});

test("list paging clamps page size and keeps the requested page", () => {
  const parsed = parseListPage({ page: "3", pageSize: "500", q: "  kas  " });
  assert.equal(parsed.paginate, true);
  assert.equal(parsed.page, 3);
  assert.equal(parsed.pageSize, 100);
  assert.equal(parsed.offset, 200);
  assert.equal(parsed.q, "kas");
});

test("invalid page values fall back to the first page", () => {
  const parsed = parseListPage({ page: "0", pageSize: "-1" });
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 20);
});

test("search escapes LIKE wildcards and matches id, name, and owner", () => {
  const clause = listSearchClause("100%_a");
  assert.match(clause.sql, /l\.name LIKE/);
  assert.match(clause.sql, /CAST\(l\.id AS CHAR\)/);
  assert.match(clause.sql, /u\.email/);
  assert.deepEqual(clause.params, [
    "%100\\%\\_a%",
    "%100\\%\\_a%",
    "%100\\%\\_a%",
    "%100\\%\\_a%",
  ]);
  assert.equal(listSearchClause("  ").sql, "");
});
