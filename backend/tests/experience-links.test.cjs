const test = require("node:test");
const assert = require("node:assert/strict");
const { Experience } = require("../dist/models/experience.model");
const { Tour } = require("../dist/models/tour.model");
const { listPublishedExperiences, getPublishedExperience } = require("../dist/controllers/experience.controller");
const response = () => ({ statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });

test("every record returned by the public experience index resolves by its stable database ID", async t => {
  const records = Array.from({ length: 48 }, (_, index) => new Experience({ experienceId: `EXP-${index}`, tourId: "TOUR1", travellerName: "Traveller", title: index % 2 ? "Same title" : "", writtenReview: "A review", status: "Published" }));
  t.mock.method(Tour, "find", () => ({ select() { return this; }, lean: async () => [{ tourId: "TOUR1", tourName: "Renamed tour" }] }));
  t.mock.method(Experience, "find", filter => ({ sort() { assert.equal(filter.status, "Published"); return this; }, limit: async () => records }));
  t.mock.method(Experience, "findOne", async filter => {
    assert.equal(filter.status, "Published");
    return records.find(item => filter.$or.some(match => match._id === item.id || match.experienceId === item.experienceId)) || null;
  });
  const index = response();
  await listPublishedExperiences({ query: {} }, index);
  assert.equal(index.body.data.experiences.length, 48);
  for (const record of index.body.data.experiences) {
    const res = response();
    await getPublishedExperience({ params: { reference: record.id } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.experience.id, record.id);
  }
  const byCode = response();
  await getPublishedExperience({ params: { reference: records[0].experienceId.toLowerCase() } }, byCode);
  assert.equal(byCode.body.data.experience.id, records[0].id);
});

test("unknown and unpublished references return 404 without revealing draft records", async t => {
  t.mock.method(Experience, "findOne", async filter => { assert.equal(filter.status, "Published"); return null; });
  for (const reference of ["unknown-slug", "ffffffffffffffffffffffff", "DRAFT-REVIEW"]) {
    await assert.rejects(getPublishedExperience({ params: { reference } }, response()), error => error.statusCode === 404);
  }
});
