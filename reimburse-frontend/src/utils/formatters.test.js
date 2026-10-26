import assert from "node:assert/strict";
import test from "node:test";
import { formatLocaleDate } from "./formatters.js";

test("dates use Indonesian and Chinese, not a US numeric format", () => {
  assert.equal(formatLocaleDate("2026-10-26", "en"), "26 Oktober 2026");
  assert.equal(formatLocaleDate("2026-10-26", "zh"), "2026年10月26日");
  assert.equal(formatLocaleDate("", "en"), "—");
  assert.equal(formatLocaleDate("not-a-date", "zh"), "—");
});
