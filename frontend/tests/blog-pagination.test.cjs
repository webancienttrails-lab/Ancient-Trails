const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, relative);
  const loaded = new Module(filename, module);
  loaded.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : module.require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}
const pagination = load("../lib/blog-pagination.ts");
const seo = load("../lib/seo.ts", { "./site-origin": { getSiteOrigin: () => "https://ancienttrails.tech" } });
const makeRoute = data => load("../app/blog/page.tsx", {
  "@/lib/seo": seo,
  "next/navigation": { notFound() { throw new Error("NOT_FOUND"); } },
  "@/lib/blog-pagination": pagination,
  "@/lib/blogs": { async listPublishedBlogs(options) { return { data: typeof data === "function" ? data(options) : data }; } },
  "./_components/blog-pages": { BlogListPage: () => null },
}).default;

test("page totals come from the published count with no phantom pages", () => {
  for (const [total, expected] of [[0, 0], [1, 1], [6, 1], [7, 2], [48, 8], [49, 9]]) {
    assert.equal(pagination.getBlogPageCount(total), expected);
  }
});
test("invalid page values are rejected", () => {
  assert.equal(pagination.parseBlogPage(undefined), 1);
  assert.equal(pagination.parseBlogPage("2"), 2);
  for (const page of ["0", "-1", "1.5", "abc", "", "Infinity", "9007199254740992", ["1", "2"]]) {
    assert.equal(pagination.parseBlogPage(page), null);
  }
});
test("with one published post page 1 has no pager and page 9 invokes notFound", async () => {
  const route = makeRoute({ total: 1, blogs: [{ slug: "only-post" }], categories: [], popularPosts: [] });
  const result = await route({ searchParams: Promise.resolve({}) });
  assert.equal(result.props.currentPage, 1);
  assert.equal(result.props.totalPages, 1);
  await assert.rejects(route({ searchParams: Promise.resolve({ page: "9" }) }), /NOT_FOUND/);
  await assert.rejects(route({ searchParams: Promise.resolve({ page: "2" }) }), /NOT_FOUND/);
});
test("an empty blog still has a valid first page, and later pages return notFound", async () => {
  const route = makeRoute({ total: 0, blogs: [], categories: [], popularPosts: [] });
  assert.equal((await route({})).props.totalPages, 0);
  await assert.rejects(route({ searchParams: Promise.resolve({ page: "2" }) }), /NOT_FOUND/);
});
test("the last real page loads with its API offset parameters, category and sort", async () => {
  const route = makeRoute(options => {
    assert.deepEqual(options, { page: 2, limit: 6, category: "History", sort: "Oldest" });
    return { total: 7, blogs: [{ slug: "last-post" }], categories: [], popularPosts: [] };
  });
  const result = await route({ searchParams: Promise.resolve({ page: "2", category: "History", sort: "Oldest" }) });
  assert.equal(result.props.currentPage, 2);
  assert.equal(result.props.totalPages, 2);
  const url = new URL(pagination.getBlogPageHref(2, "Art & Culture", "Oldest"), "https://example.com");
  assert.equal(url.searchParams.get("category"), "Art & Culture");
  assert.equal(url.searchParams.get("sort"), "Oldest");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(pagination.getBlogPageHref(1), "/blog");
});
