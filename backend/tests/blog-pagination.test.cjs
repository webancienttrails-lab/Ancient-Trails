const test = require("node:test");
const assert = require("node:assert/strict");
const { BlogPost } = require("../dist/models/blog.model");
const { listPublishedBlogs } = require("../dist/controllers/blog.controller");
const response = () => ({ statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });

test("published blog paging uses an offset, stable sort and the matching total", async t => {
  const post = new BlogPost({ blogId: "B7", title: "Last post", slug: "last-post", category: "History", status: "Published" });
  const queries = [];
  t.mock.method(BlogPost, "find", filter => {
    const query = { filter, sort(value) { this.order = value; return this; }, skip(value) { this.offset = value; return this; }, async limit(value) { this.limitValue = value; return this.offset === undefined ? [] : [post]; } };
    queries.push(query);
    return query;
  });
  t.mock.method(BlogPost, "countDocuments", async filter => { assert.deepEqual(filter, { status: "Published", category: "History" }); return 7; });
  t.mock.method(BlogPost, "aggregate", async () => [{ _id: "History", count: 7 }]);
  const res = response();
  await listPublishedBlogs({ query: { page: "2", limit: "6", category: "History", sort: "Oldest" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(queries[0].offset, 6);
  assert.equal(queries[0].limitValue, 6);
  assert.deepEqual(queries[0].order, { publishedAt: 1, createdAt: 1, _id: 1 });
  assert.equal(res.body.data.total, 7);
  assert.equal(res.body.data.blogs[0].slug, "last-post");
});

test("invalid API pages are rejected before any database query", async t => {
  const read = t.mock.method(BlogPost, "find", () => { throw Error("Must not query"); });
  for (const page of ["0", "-1", "1.5", "abc", "9007199254740992"]) {
    await assert.rejects(listPublishedBlogs({ query: { page } }, response()), error => error.statusCode === 400);
  }
  assert.equal(read.mock.callCount(), 0);
});
