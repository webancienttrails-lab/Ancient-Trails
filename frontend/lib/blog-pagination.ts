export const BLOG_PAGE_SIZE = 6;

export function parseBlogPage(value: string | string[] | undefined) {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && Number.isSafeInteger((page - 1) * BLOG_PAGE_SIZE) ? page : null;
}

export function getBlogPageCount(total: number) {
  return Math.ceil(total / BLOG_PAGE_SIZE);
}

export function getBlogPageHref(page: number, category = "All", sort = "Latest") {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (category !== "All") params.set("category", category);
  if (sort !== "Latest") params.set("sort", sort);
  const query = params.toString();
  return `/blog${query ? `?${query}` : ""}`;
}
