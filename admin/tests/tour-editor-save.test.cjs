const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../app/tours/page.tsx"), "utf8");
const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = {};
function visit(node) {
  if (ts.isFunctionDeclaration(node) && /^handleSave(Tour|Departure|Itinerary)$/.test(node.name?.text || "")) {
    handlers[node.name.text] = ts.transpileModule(node.getText(parsed), {
      compilerOptions: { target: ts.ScriptTarget.ES2020 },
    }).outputText;
  }
  ts.forEachChild(node, visit);
}
visit(parsed);

for (const kind of ["Tour", "Departure", "Itinerary"]) {
  for (const mode of ["add", "edit"]) {
    for (const routed of [true, false]) {
      test(`${kind} ${mode}: ${routed ? "keep the page editor until navigation" : "close the list dialog"}`, async () => {
        const name = kind.toLowerCase();
        const resultKey = kind === "Itinerary" ? "itinerary" : name;
        const apiName = kind === "Tour" ? "Tour" : `Tour${kind}`;
        const state = {
          routeState: { mode: routed ? mode : null },
          [`${name}SheetMode`]: mode,
          [`${name}Form`]: { tourId: "TOUR1" },
          [`selected${kind}`]: { id: "saved-id" },
          [`empty${kind}Form`]: {},
          [`create${kind}Payload`]: (form) => form,
          [`set${kind}s`]: () => {},
          setItineraries: () => {},
          setDepartureErrors: () => {},
          ApiError: class ApiError extends Error {},
          getErrorMessage: (error) => error.message,
          toast: { success() {}, error() { assert.fail("Save should succeed"); } },
          isUploadingTourThumbnailImage: false, isUploadingTourBannerImage: false,
          isUploadingTourGalleryImages: false, isUploadingTourVideo: false,
        };
        for (const field of [`${name}SheetMode`, `${name}Form`, `selected${kind}`, `isSaving${kind}`]) {
          state[`set${field[0].toUpperCase()}${field.slice(1)}`] = (value) => { state[field] = value; };
        }
        let resolveSave;
        const pendingSave = new Promise((resolve) => { resolveSave = resolve; });
        let calls = 0;
        state[`${mode === "edit" ? "update" : "create"}Admin${apiName}`] = () => {
          calls++;
          return pendingSave;
        };
        let navigated = false;
        state.router = { push(url) {
          assert.equal(url, "/tours");
          assert.equal(state[`${name}SheetMode`], routed ? mode : null);
          navigated = true;
          // Deliberately leave navigation pending to expose any premature editor reset.
        } };
        vm.createContext(state);
        vm.runInContext(handlers[`handleSave${kind}`] + `\nglobalThis.save = handleSave${kind};`, state);
        const saving = state.save({ preventDefault() {} });
        assert.equal(calls, 1);
        assert.equal(state[`isSaving${kind}`], true);
        assert.equal(state[`${name}SheetMode`], mode);
        resolveSave({ data: { [resultKey]: { id: "saved-id" } }, message: "Saved" });
        await saving;
        assert.equal(navigated, true);
        assert.equal(state[`${name}SheetMode`], routed ? mode : null);
        assert.equal(state[`isSaving${kind}`], false);
        if (routed) assert.equal(state[`${name}Form`].tourId, "TOUR1");
      });
    }
  }
}
