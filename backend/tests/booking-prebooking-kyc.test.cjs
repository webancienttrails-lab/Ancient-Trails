const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { signPrebookingKycUpload, resolvePrebookingKycUploads } = require("../src/services/booking/booking.prebooking-kyc.ts");
const { isTravellerTcsExempt } = require("../src/services/booking/booking.kyc.ts");
const { Booking } = require("../src/models/booking.model.ts");
const { User, UserRole } = require("../src/models/user.model.ts");
const { signAuthToken } = require("../src/utils/jwt.ts");
const { authorizePrebookingKycUpload, uploadPrebookingKycDocument } = require("../src/controllers/booking.controller.ts");
process.env.JWT_SECRET = "prebooking-kyc-test-secret-for-isolated-tests-only";
const document = { id: "doc-1", documentType: "visa", documentLabel: "Visa", fileName: "visa.pdf",
  fileUrl: "/uploads/booking-kyc/visa.pdf", mimeType: "application/pdf", uploadedBy: "traveller", uploadedAt: new Date() };

test("signed Visa and OCI uploads persist in bookings and remain unverified until eligibility review", () => {
  const tokens = [document, { ...document, id: "oci-1", documentType: "oci" }]
    .map((doc) => signPrebookingKycUpload(doc, "adult-1", "919000000000"));
  const documents = resolvePrebookingKycUploads(tokens, "adult-1", "919000000000");
  const booking = new Booking({ travellers: [{ id: "adult-1", type: "adult", isNri: true, kycDocuments: documents }] });
  const restored = new Booking(booking.toObject());
  assert.equal(restored.travellers[0].kycDocuments.length, 2);
  assert.equal(isTravellerTcsExempt(restored.travellers[0]), false);
  assert.ok(documents[0].uploadedAt instanceof Date);
});

test("upload tokens reject tampering, other travellers, other leads, expiry and unrelated JWTs", () => {
  const token = signPrebookingKycUpload(document, "adult-1", "919000000000");
  assert.throws(() => resolvePrebookingKycUploads([token], "adult-2", "919000000000"), /invalid or expired/);
  assert.throws(() => resolvePrebookingKycUploads([token], "adult-1", "918000000000"), /invalid or expired/);
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ ...jwt.decode(token), travellerId: "adult-2" })).toString("base64url");
  assert.throws(() => resolvePrebookingKycUploads([parts.join(".")], "adult-2", "919000000000"), /invalid or expired/);
  const expired = jwt.sign({ purpose: "prebooking_kyc", document, travellerId: "adult-1", leadPhone: "919000000000" }, process.env.JWT_SECRET, { expiresIn: -1 });
  assert.throws(() => resolvePrebookingKycUploads([expired], "adult-1", "919000000000"), /invalid or expired/);
  assert.throws(() => resolvePrebookingKycUploads([jwt.sign({ purpose: "auth" }, process.env.JWT_SECRET)], "adult-1", "919000000000"), /invalid or expired/);
});

test("prebooking uploads require a verified traveller before receiving the file", async (t) => {
  await assert.rejects(authorizePrebookingKycUpload({ headers: {} }, { locals: {} }, () => assert.fail("Unauthorized")), /session|sign in|token|authorization/i);
  const user = new User({ roles: [UserRole.TRAVELLER], status: "active", mobileNumber: "919000000000", isMobileVerified: false });
  t.mock.method(User, "findById", async () => user);
  const request = { headers: { authorization: `Bearer ${signAuthToken(user)}` } };
  await assert.rejects(authorizePrebookingKycUpload(request, { locals: {} }, () => assert.fail("Unverified")), /Verify your mobile/);
  user.isMobileVerified = true;
  const response = { locals: {} };
  let allowed = false;
  await authorizePrebookingKycUpload(request, response, () => { allowed = true; });
  assert.equal(allowed, true);
  assert.equal(response.locals.prebookingLeadPhone, "919000000000");
});

test("upload response supplies the server-signed document reference for the selected traveller", async () => {
  let result;
  const response = { locals: { prebookingLeadPhone: "919000000000" }, status(code) { assert.equal(code, 201); return this; }, json(body) { result = body; } };
  const request = { body: { travellerId: "child-1", documentType: "oci" },
    file: { originalname: "oci.pdf", filename: "stored-oci.pdf", mimetype: "application/pdf" } };
  await uploadPrebookingKycDocument(request, response);
  const docs = resolvePrebookingKycUploads([result.data.token], "child-1", "919000000000");
  assert.equal(docs[0].documentType, "oci");
  assert.equal(docs[0].fileUrl, "/uploads/booking-kyc/stored-oci.pdf");
  assert.equal(docs[0].fileName, "oci.pdf");
  await assert.rejects(uploadPrebookingKycDocument({ ...request, body: { ...request.body, documentType: "pan_card" } }, response), /Visa or OCI/);
});
