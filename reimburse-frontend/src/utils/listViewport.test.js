import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  listPageClass,
  listScrollClass,
  listSectionClass,
  listTableScrollClass,
  verticalScrollOwnerCount,
} from "./listViewport.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("list pages fill the shell without becoming a second vertical scroller", () => {
  for (const name of [listPageClass, listSectionClass]) {
    assert.match(name, /\bmin-h-0\b/);
    assert.match(name, /\bflex-1\b/);
    assert.match(name, /\boverflow-hidden\b/);
    assert.equal(verticalScrollOwnerCount([name]), 0);
    assert.doesNotMatch(name, /min-h-48|36rem|h-\[|max-h-\[/);
  }
  assert.match(listPageClass, /\bh-full\b/);
  assert.match(listPageClass, /\bmax-h-full\b/);
});

test("the list region is the only vertical scroll owner and ends at its content", () => {
  assert.equal(verticalScrollOwnerCount([listScrollClass]), 1);
  assert.equal(verticalScrollOwnerCount([listTableScrollClass]), 1);
  assert.equal(
    verticalScrollOwnerCount([listPageClass, listScrollClass, listTableScrollClass]),
    2,
  );
  for (const name of [listScrollClass, listTableScrollClass]) {
    assert.match(name, /\bmin-h-0\b/);
    assert.match(name, /\bflex-1\b/);
    assert.match(name, /\boverscroll-y-none\b/);
    assert.doesNotMatch(name, /min-h-48|36rem|h-\[|max-h-\[|p[trblxy]?-/);
  }
  assert.match(listTableScrollClass, /\boverflow-x-auto\b/);
  assert.match(listScrollClass, /\boverflow-x-hidden\b/);
});

test("reimbursement list views use the viewport contract", () => {
  for (const file of ["views/Home.vue", "views/ListDetail.vue"]) {
    const source = read(file);
    assert.match(source, /listPageClass/);
    assert.match(source, /listScrollClass/);
    assert.match(source, /listTableScrollClass/);
    assert.doesNotMatch(source, /min-h-48|36rem|100dvh-12rem/);
  }
});

test("the document shell is one dynamic viewport and does not extend past it", () => {
  const theme = read("styles/theme.css");
  assert.match(theme, /height:\s*100dvh/);
  assert.match(theme, /overflow:\s*hidden/);
  assert.doesNotMatch(theme, /min-height:\s*100vh/);
  const shell = read("layouts/AppShell.vue");
  assert.match(shell, /env\(safe-area-inset-top\)/);
  assert.match(shell, /env\(safe-area-inset-bottom\)/);
  assert.match(shell, /\bh-full\b/);
  assert.doesNotMatch(shell, /\bh-dvh\b/);
});
