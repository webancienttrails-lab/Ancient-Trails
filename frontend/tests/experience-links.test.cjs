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
const routes = load("../lib/routes.ts");
class ApiError extends Error { constructor(statusCode) { super("API error"); this.statusCode = statusCode; } }
const tours = [{ tourId: "TOUR1", tourName: "Renamed Heritage Tour" }];
const records = Array.from({ length: 48 }, (_, index) => ({
  id: (index + 1).toString(16).padStart(24, "0"), experienceId: `EXP-${index + 1}`,
  tourId: "TOUR1", tourName: tours[0].tourName, title: index % 2 ? "Duplicate title" : "",
  status: "Published", writtenReview: `Traveller review ${index + 1}`,
}));
function makeLoader({ experiences = records, publicTours = tours, directError } = {}) {
  return load("../lib/experience-page.ts", {
    "./api": { ApiError }, "./routes": routes,
    "./home-travel": {
      async getPublicExperience(reference) {
        if (directError) throw directError;
        const experience = experiences.find(item => item.id === reference || item.experienceId === reference.toUpperCase());
        if (!experience) throw new ApiError(404);
        return { data: { experience } };
      },
      async listPublicTours() { return { data: { tours: publicTours } }; },
      async listPublicExperiences(tourId = "") { return { data: { experiences: experiences.filter(item => !tourId || item.tourId === tourId) } }; },
    },
  }).loadExperiencePage;
}
function makeRoute(loader) {
  return load("../app/experiences/[experienceId]/page.tsx", {
    "@/lib/home-travel": { getHomeMediaUrl: value => value },
    "@/lib/routes": routes,
    "@/lib/seo": load("../lib/seo.ts", { "./site-origin": { getSiteOrigin: () => "https://ancienttrails.tech" } }),
    "react": { cache: fn => fn },
    "next/navigation": { notFound() { throw Error("NOT_FOUND"); } },
    "@/lib/experience-page": { loadExperiencePage: loader },
    "../_components/experiences-page": { SingleExperiencePage: () => null },
  }).default;
}

test("all 48 API records without slugs open their own detail page, including duplicate and blank titles", async () => {
  const route = makeRoute(makeLoader());
  for (const record of records) {
    const href = routes.getExperienceHref(record);
    const experienceId = decodeURIComponent(href.split("/").pop());
    const result = await route({ params: Promise.resolve({ experienceId }) });
    assert.equal(result.props.detail.experiences[0].id, record.id, href);
  }
});

test("editing a review title, tour name or experience code does not change its ID link", async () => {
  const original = records[0];
  const changed = { ...original, title: "New title", tourName: "New tour name", experienceId: "EDITED-CODE" };
  assert.equal(routes.getExperienceHref(changed), routes.getExperienceHref(original));
  const detail = await makeLoader({ experiences: [changed] })(original.id);
  assert.equal(detail.experiences[0].title, "New title");
});

test("a published review remains readable if its linked tour is no longer listed", async () => {
  const detail = await makeLoader({ publicTours: [] })(records[0].id);
  assert.equal(detail.tour, null);
  assert.equal(detail.experiences[0].id, records[0].id);
});

test("old tour-name URLs and stable tour ID URLs still resolve", async () => {
  const loader = makeLoader();
  assert.equal((await loader("renamed-heritage-tour")).tour.tourId, "TOUR1");
  assert.equal((await loader("TOUR1")).tour.tourId, "TOUR1");
  assert.equal(routes.getTourExperiencesHref(tours[0]), "/experiences/TOUR1");
});

test("unknown slugs and unknown IDs invoke server notFound", async () => {
  const route = makeRoute(makeLoader());
  for (const experienceId of ["unknown-review", "ffffffffffffffffffffffff"]) {
    await assert.rejects(route({ params: Promise.resolve({ experienceId }) }), /NOT_FOUND/);
  }
});

test("an unavailable API propagates its failure instead of claiming a review does not exist", async () => {
  await assert.rejects(makeLoader({ directError: new ApiError(503) })(records[0].id), error => error.statusCode === 503);
});
