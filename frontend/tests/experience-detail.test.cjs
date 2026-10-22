const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../lib/experience-detail.ts");
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { getExperienceGalleryImages, getExperienceMoments } = loaded.exports;
const tour = { bannerImage: "/tour-banner.jpg", thumbnailImage: "/tour-thumb.jpg", galleryImages: ["/tour-gallery.jpg"] };
const experience = values => ({ travellerPhotoGallery: [], attractionPhotoGallery: [], travellerVideos: [], travellerVideoTitles: [], ...values });

test("detail gallery uses uploaded experience photos instead of tour marketing images", () => {
  const records = [experience({ travellerPhotoGallery: [" /uploaded-1.jpg ", "/uploaded-2.jpg"], attractionPhotoGallery: [{ image: "/attraction.jpg", name: "Temple" }, {image: "/uploaded-1.jpg"}] })];
  assert.deepEqual(getExperienceGalleryImages(tour, records), ["/uploaded-1.jpg", "/uploaded-2.jpg", "/attraction.jpg"]);
});

test("tour photos are used only when the experience has no uploaded photos", () => {
  assert.deepEqual(getExperienceGalleryImages(tour, [experience({travellerPhotoGallery: [" "]})]), ["/tour-banner.jpg", "/tour-thumb.jpg", "/tour-gallery.jpg"]);
  assert.deepEqual(getExperienceGalleryImages(tour, [experience({attractionPhotoGallery:[{image:"/attraction-only.jpg"}]})]), ["/attraction-only.jpg"]);
});

test("one uploaded video produces one moment and keeps its indexed title", () => {
  const record = experience({travellerVideos:["", "/uploaded.mp4", "/uploaded.mp4"], travellerVideoTitles:["Unused", "Uploaded video title", "Duplicate"], travellerPhotoGallery:["/traveller.jpg"]});
  assert.deepEqual(getExperienceMoments([record], "Heritage Tour"), [{video:"/uploaded.mp4", image:"/traveller.jpg", title:"Uploaded video title"}]);
});

test("multiple experiences retain their own video titles and cover images", () => {
  const records = [experience({travellerVideos:["/one.mp4"], title:"First traveller", travellerPhotoGallery:["/one.jpg"]}), experience({travellerVideos:["/two.mp4"], travellerVideoTitles:["Second moment"], attractionPhotoGallery:[{image:"/two.jpg"}]})];
  assert.deepEqual(getExperienceMoments(records, "Heritage Tour"), [{video:"/one.mp4",image:"/one.jpg",title:"First traveller"},{video:"/two.mp4",image:"/two.jpg",title:"Second moment"}]);
});

test("no uploaded videos produces no placeholder video cards", () => {
  assert.deepEqual(getExperienceMoments([experience({travellerPhotoGallery:["/photo.jpg"]})], "Heritage Tour"), []);
});
