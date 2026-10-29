const test = require("node:test");
const assert = require("node:assert/strict");
const api = (process.env.EXPERIENCE_TEST_API_URL || "http://localhost:5000").replace(/\/$/, "");
const site = (process.env.EXPERIENCE_TEST_SITE_URL || "http://localhost:3001").replace(/\/$/, "");

test("open every published record from /api/experiences and reject an unknown slug over HTTP", { timeout: 600000 }, async t => {
  const index = await fetch(`${api}/api/experiences`, { signal: AbortSignal.timeout(15000) });
  assert.equal(index.status, 200, "The experience API must be running");
  const { data } = await index.json();
  assert.ok(data.experiences.length > 0, "Seed at least one published experience to exercise links");
  for (const record of data.experiences) {
    await t.test(`open ${record.id}`, async () => {
      const response = await fetch(`${site}/experiences/${encodeURIComponent(record.id)}`, { signal: AbortSignal.timeout(60000) });
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(record.id), "The requested record must be included in the rendered page");
      assert.equal(html.includes("Experience not found"), false);
    });
  }
  const missing = await fetch(`${site}/experiences/unknown-review-${Date.now()}`, { signal: AbortSignal.timeout(60000) });
  assert.equal(missing.status, 404);
});
