/** Page links for the shadcn pagination pattern, including ellipsis. */
export function paginationItems(page, pageCount) {
  const pages = Math.max(1, Number(pageCount) || 1);
  const current = Math.min(pages, Math.max(1, Number(page) || 1));
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, index) => ({
      type: "page",
      value: index + 1,
    }));
  }

  const items = [{ type: "page", value: 1 }];
  if (current <= 3) {
    items.push(
      { type: "page", value: 2 },
      { type: "page", value: 3 },
      { type: "page", value: 4 },
      { type: "ellipsis" },
    );
  } else if (current >= pages - 2) {
    items.push(
      { type: "ellipsis" },
      { type: "page", value: pages - 3 },
      { type: "page", value: pages - 2 },
      { type: "page", value: pages - 1 },
    );
  } else {
    items.push(
      { type: "ellipsis" },
      { type: "page", value: current - 1 },
      { type: "page", value: current },
      { type: "page", value: current + 1 },
      { type: "ellipsis" },
    );
  }
  items.push({ type: "page", value: pages });
  return items;
}
