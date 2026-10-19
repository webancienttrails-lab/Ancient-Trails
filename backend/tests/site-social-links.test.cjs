const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { SiteSettings, defaultSocialLinks } = require("../dist/models/siteSettings.model");
const { getSiteSettings, updateSiteSettings } = require("../dist/controllers/siteSettings.controller");
const contact = { emailId: "help@example.com", landline: "02012345678", officeAddress: "Pune", primaryCalling: "9000000000", secondaryCalling: "", whatsapp: "9000000001" };
const links = { facebook: "https://www.facebook.com/company", instagram: "https://www.instagram.com/company", linkedin: "https://www.linkedin.com/company/ancient-trails", youtube: "https://www.youtube.com/@company" };
const response = () => ({ statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });

test("existing settings without persisted social links retain contact data and expose editable defaults", async t => {
  t.mock.method(SiteSettings, "findOneAndUpdate", async () => ({ _id: new mongoose.Types.ObjectId(), contact }));
  const res = response(); await getSiteSettings({}, res);
  assert.deepEqual(res.body.data.settings.contact, contact);
  assert.deepEqual(res.body.data.settings.socialLinks, defaultSocialLinks);
});

test("all four social links persist and are returned by the public settings reader", async t => {
  let saved = new SiteSettings({ key: "site", contact });
  t.mock.method(SiteSettings, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { key: "site" }); assert.equal(options.new, true);
    if (update.$set) saved = new SiteSettings({ key: "site", ...update.$set });
    return saved;
  });
  const res = response(); await updateSiteSettings({ body: { contact, socialLinks: { ...links, instagram: "  " + links.instagram + "  " } } }, res);
  assert.deepEqual(res.body.data.settings.socialLinks, links);
  await getSiteSettings({}, res); assert.deepEqual(res.body.data.settings.socialLinks, links);
  assert.deepEqual(res.body.data.settings.contact, contact);
});

test("blank social URLs stay blank after saving so their footer icons can be hidden", async t => {
  t.mock.method(SiteSettings, "findOneAndUpdate", async (filter, update) => new SiteSettings({ key: "site", ...update.$set }));
  const res = response(); await updateSiteSettings({ body: { contact, socialLinks: { facebook: "", instagram: "", linkedin: "", youtube: "" } } }, res);
  assert.deepEqual(res.body.data.settings.socialLinks, { facebook: "", instagram: "", linkedin: "", youtube: "" });
});

test("contact-only settings updates preserve previously saved social URLs", async t => {
  const stored = new SiteSettings({ key: "site", contact, socialLinks: links });
  t.mock.method(SiteSettings, "findOneAndUpdate", async (filter, update) => {
    assert.equal(Object.hasOwn(update.$set, "socialLinks"), false);
    stored.contact = update.$set.contact; return stored;
  });
  const res = response(); await updateSiteSettings({ body: { contact: { ...contact, emailId: "updated@example.com" } } }, res);
  assert.deepEqual(res.body.data.settings.socialLinks, links);
  assert.equal(res.body.data.settings.contact.emailId, "updated@example.com");
});

test("unsafe or malformed social URLs are rejected without writing settings", async t => {
  const write = t.mock.method(SiteSettings, "findOneAndUpdate", () => { throw Error("Invalid URLs must not be saved"); });
  for (const linkedin of ["javascript:alert(1)", "data:text/html,hello", "not a url", "/relative-path", "https://example.com/" + "x".repeat(500)]) {
    await assert.rejects(updateSiteSettings({ body: { contact, socialLinks: { ...links, linkedin } } }, response()), error => error.statusCode === 400);
  }
  assert.equal(write.mock.callCount(), 0);
});
