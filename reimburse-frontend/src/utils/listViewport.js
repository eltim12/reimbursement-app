/**
 * Reimbursement lists fill the shell and scroll in one place.
 * The page column does not scroll. A table scroller may move horizontally
 * on that same element, and it ends at the last row.
 */

export const listPageClass =
  "flex h-full max-h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden";

export const listSectionClass =
  "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden";

export const listScrollClass =
  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-none";

export const listTableScrollClass =
  "min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-none";

const VERTICAL_SCROLL = new Set([
  "overflow-y-auto",
  "overflow-y-scroll",
  "overflow-auto",
]);

export function verticalScrollOwnerCount(classNames) {
  return classNames.filter((name) =>
    String(name)
      .split(/\s+/)
      .some((token) => VERTICAL_SCROLL.has(token)),
  ).length;
}
