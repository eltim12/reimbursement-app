import assert from "node:assert/strict";
import test from "node:test";
import { paginationItems } from "./pagination.js";

const values = (items) => items.map((item) => item.value ?? "…");

test("short page counts list every page", () => {
  assert.deepEqual(values(paginationItems(2, 1)), [1]);
  assert.deepEqual(values(paginationItems(2, 7)), [1, 2, 3, 4, 5, 6, 7]);
});

test("long page counts keep the current page and collapse the rest", () => {
  assert.deepEqual(values(paginationItems(1, 10)), [1, 2, 3, 4, "…", 10]);
  assert.deepEqual(values(paginationItems(5, 10)), [1, "…", 4, 5, 6, "…", 10]);
  assert.deepEqual(values(paginationItems(10, 10)), [1, "…", 7, 8, 9, 10]);
});
