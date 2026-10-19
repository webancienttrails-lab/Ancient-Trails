const test = require("node:test");
const assert = require("node:assert/strict");
const { BlogPost } = require("../dist/models/blog.model");
const { Tour } = require("../dist/models/tour.model");
const { createBlog, updateBlog, getPublishedBlog } = require("../dist/controllers/blog.controller");
const payload = { title: "A heritage journey", category: "Heritage", status: "Published" };
const response = () => ({ body: null, statusCode: 0, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });
function post(values = {}) { return new BlogPost({ ...payload, blogId: "BLOG-TEST", slug: "heritage-journey", ...values }); }
function detailMocks(t, blog) {
  t.mock.method(BlogPost, "findOne", async filter => { assert.equal(filter.status, "Published"); return blog; });
  t.mock.method(BlogPost, "find", () => ({ sort() { return this; }, limit: async () => [] }));
}

test("creating a blog stores unique selected dashboard tour IDs", async t => {
  t.mock.method(Tour, "find", filter => ({ select: async () => {
    assert.deepEqual(filter, { tourId: { $in: ["TOUR-1", "TOUR-2"] } }); return [{ tourId: "TOUR-1" }, { tourId: "TOUR-2" }];
  } }));
  let saved;
  t.mock.method(BlogPost, "create", async data => { saved = post(data); return saved; });
  const res = response(); await createBlog({ body: { ...payload, relatedTourIds: ["tour-1", "TOUR-1", "TOUR-2"] } }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(Array.from(saved.relatedTourIds), ["TOUR-1", "TOUR-2"]);
  assert.deepEqual(Array.from(res.body.data.blog.relatedTourIds), ["TOUR-1", "TOUR-2"]);
});

test("unknown tour IDs are rejected before a blog is saved", async t => {
  t.mock.method(Tour, "find", () => ({ select: async () => [] }));
  const write = t.mock.method(BlogPost, "create", () => { throw Error("Invalid selection must not be saved"); });
  await assert.rejects(createBlog({ body: { ...payload, relatedTourIds: ["UNKNOWN"] } }, response()), error => error.statusCode === 400);
  assert.equal(write.mock.callCount(), 0);
});

test("editing another blog field without a related-tour field preserves previous associations", async t => {
  const existing = post({ relatedTourIds: ["TOUR-1"] });
  t.mock.method(BlogPost, "findById", async () => existing);
  t.mock.method(BlogPost, "findByIdAndUpdate", async (id, data) => { assert.deepEqual(Array.from(data.relatedTourIds), ["TOUR-1"]); return post(data); });
  const query = t.mock.method(Tour, "find", () => { throw Error("Existing associations need no new lookup"); });
  await updateBlog({ params: { id: existing.id }, body: { ...payload, title: "Updated story" } }, response());
  assert.equal(query.mock.callCount(), 0);
});

test("an explicit empty selection clears related tours", async t => {
  const existing = post({ relatedTourIds: ["TOUR-1"] });
  t.mock.method(BlogPost, "findById", async () => existing);
  t.mock.method(BlogPost, "findByIdAndUpdate", async (id, data) => post(data));
  const res = response(); await updateBlog({ params: { id: existing.id }, body: { ...payload, relatedTourIds: [] } }, res);
  assert.equal(res.body.data.blog.relatedTourIds.length, 0);
});

test("a blog detail returns only its selected existing tours, in selected order, using live tour content", async t => {
  const blog = post({ relatedTourIds: ["TOUR-2", "DELETED", "TOUR-1"] }); detailMocks(t, blog);
  t.mock.method(Tour, "find", filter => ({ select: async fields => {
    assert.deepEqual(filter.tourId.$in, ["TOUR-2", "DELETED", "TOUR-1"]);
    assert.equal(fields, "tourId tourName durationDn thumbnailImage bannerImage");
    return [{ tourId: "TOUR-1", tourName: "Updated Hampi Tour", durationDn: "6 Days", thumbnailImage: "/uploads/hampi.png", notes: "private" },
      { tourId: "TOUR-2", tourName: "Ajanta Tour", durationDn: "3 Days", bannerImage: "/uploads/ajanta.png", notes: "private" }];
  } }));
  const res = response(); await getPublishedBlog({ params: { slug: blog.slug } }, res);
  assert.deepEqual(res.body.data.relatedTours.map(tour => tour.tourId), ["TOUR-2", "TOUR-1"]);
  assert.equal(res.body.data.relatedTours[1].tourName, "Updated Hampi Tour");
  assert.equal(res.body.data.relatedTours[0].bannerImage, "/uploads/ajanta.png");
  assert.equal(res.body.data.relatedTours[0].notes, undefined);
});

test("blogs without selected tours do not fetch or substitute unrelated tours", async t => {
  const blog = post(); detailMocks(t, blog);
  const tours = t.mock.method(Tour, "find", () => { throw Error("No related tours should be fetched"); });
  const res = response(); await getPublishedBlog({ params: { slug: blog.slug } }, res);
  assert.deepEqual(res.body.data.relatedTours, []); assert.equal(tours.mock.callCount(), 0);
});

test("new tour selections on an edited blog are validated while stale existing associations remain editable", async t => {
  const existing = post({ relatedTourIds: ["DELETED"] });
  t.mock.method(BlogPost, "findById", async () => existing);
  t.mock.method(Tour, "find", filter => ({ select: async () => { assert.deepEqual(filter.tourId.$in, ["TOUR-1"]); return [{ tourId: "TOUR-1" }]; } }));
  t.mock.method(BlogPost, "findByIdAndUpdate", async (id, data) => post(data));
  const res = response(); await updateBlog({ params: { id: existing.id }, body: { ...payload, relatedTourIds: ["DELETED", "TOUR-1"] } }, res);
  assert.deepEqual(Array.from(res.body.data.blog.relatedTourIds), ["DELETED", "TOUR-1"]);
});

test("related tour limits and malformed IDs are rejected without changing existing blog content", async t => {
  const write = t.mock.method(BlogPost, "create", () => { throw Error("Invalid selection must not be saved"); });
  for (const relatedTourIds of [Array.from({ length: 21 }, (_, i) => "TOUR-" + i), [" "], ["a".repeat(41)], "TOUR-1"]) {
    await assert.rejects(createBlog({ body: { ...payload, relatedTourIds } }, response()), error => error.statusCode === 400);
  }
  assert.equal(write.mock.callCount(), 0);
});
