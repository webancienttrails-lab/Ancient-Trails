const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const { SiteSettings } = require("../dist/models/siteSettings.model");
const { User } = require("../dist/models/user.model");
const { getSiteSettings, updateSiteSettings, resetSiteLogo } = require("../dist/controllers/siteSettings.controller");
const { adminSiteSettingsRoutes } = require("../dist/routes/siteSettings.routes");
const { signAuthToken } = require("../dist/utils/jwt");
const { validLogoImage } = require("../dist/services/site-logo-upload");
const contact = { emailId: "test@example.com", landline: "1234", officeAddress: "Pune", primaryCalling: "9000000000", secondaryCalling: "", whatsapp: "" };
const response = () => ({ status() { return this; }, json(value) { this.body = value; } });

test("older settings fall back to the default logo and contact saves preserve a custom logo", async t => {
  let saved = new SiteSettings({ key: "site", contact, logo: "/uploads/site-logos/company.png" });
  t.mock.method(SiteSettings, "findOneAndUpdate", async (filter, update) => {
    if (update.$set) { assert(!Object.hasOwn(update.$set, "logo")); Object.assign(saved, update.$set); }
    return saved;
  });
  const res = response(); await updateSiteSettings({ body: { contact } }, res);
  assert.equal(res.body.data.settings.logo, "/uploads/site-logos/company.png");
  saved = { _id: "site", contact }; await getSiteSettings({}, res); assert.equal(res.body.data.settings.logo, "");
});
test("resetting a logo preserves contact information and social links", async t => {
  const saved = new SiteSettings({ key: "site", contact, logo: "/uploads/site-logos/company.png", socialLinks: { facebook: "https://facebook.com/company" } });
  t.mock.method(SiteSettings, "findOneAndUpdate", async (filter, update) => { assert.deepEqual(update.$set, { logo: "" }); saved.logo = ""; return saved; });
  const res = response(); await resetSiteLogo({}, res);
  assert.equal(res.body.data.settings.logo, ""); assert.deepEqual(res.body.data.settings.contact, contact); assert.equal(res.body.data.settings.socialLinks.facebook, "https://facebook.com/company");
});
test("image validation rejects SVG or text disguised as an image", () => {
  assert(!validLogoImage(Buffer.from("<svg><script>alert(1)</script></svg>"), "image/png"));
  assert(!validLogoImage(Buffer.from("<svg/>"), "image/svg+xml"));
  assert(validLogoImage(Buffer.from("GIF89a"), "image/gif"));
});
test("logo uploads require an admin, persist a unique public file, and reject oversized or disguised files", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ancient-trails-logo-"));
  const oldUpload = process.env.UPLOAD_PATH, oldSecret = process.env.JWT_SECRET;
  process.env.UPLOAD_PATH = directory; process.env.JWT_SECRET = "site-logo-test-secret";
  t.after(async () => {
    if (oldUpload === undefined) delete process.env.UPLOAD_PATH; else process.env.UPLOAD_PATH = oldUpload;
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
    const images = path.join(directory, "site-logos");
    for (const name of await fs.readdir(images).catch(() => [])) await fs.unlink(path.join(images, name));
    await fs.rmdir(images).catch(() => {}); await fs.rmdir(directory);
  });
  let saved = new SiteSettings({ key: "site", contact });
  t.mock.method(User, "findById", async () => ({ status: "active", roles: ["super_admin"] }));
  t.mock.method(SiteSettings, "findOneAndUpdate", async (filter, update) => { Object.assign(saved, update.$set || {}); return saved; });
  const app = express(); app.use("/settings", adminSiteSettingsRoutes); app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = "http://127.0.0.1:" + server.address().port + "/settings/logo";
  assert.equal((await fetch(url, { method: "POST" })).status, 401);
  const token = signAuthToken({ _id: "111111111111111111111111", roles: ["super_admin"] });
  const headers = { Authorization: "Bearer " + token };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXY4AAAAASUVORK5CYII=", "base64");
  const body = new FormData(); body.append("logo", new Blob([png], { type: "image/png" }), "../../company.png");
  const result = await fetch(url, { method: "POST", headers, body }); assert.equal(result.status, 200);
  const logo = (await result.json()).data.settings.logo; assert.match(logo, /^\/uploads\/site-logos\/[a-f0-9-]+\.png$/);
  assert.deepEqual(await fs.readFile(path.join(directory, "site-logos", path.basename(logo))), png);
  assert.deepEqual(saved.contact.toObject(), contact);
  for (const bytes of [Buffer.from("<svg/>"), Buffer.alloc(5 * 1024 * 1024 + 1)]) {
    const invalid = new FormData(); invalid.append("logo", new Blob([bytes], { type: "image/png" }), "bad.png");
    assert.equal((await fetch(url, { method: "POST", headers, body: invalid })).status, 400);
  }
  assert.equal((await fs.readdir(path.join(directory, "site-logos"))).length, 1);
});
