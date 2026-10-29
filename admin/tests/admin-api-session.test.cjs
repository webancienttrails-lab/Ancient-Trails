const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function createClient(status, token = "expired-token") {
  let session = { sessionId: token };
  let clearCount = 0;
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "../lib/api.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;

  vm.runInNewContext(compiled, {
    module, exports: module.exports, Headers, AbortController, setTimeout, clearTimeout,
    process: { env: {} },
    require(name) {
      assert.equal(name, "@/lib/admin-auth");
      return {
        getAdminSession: () => session,
        clearAdminSession() { session = null; clearCount++; },
      };
    },
    async fetch() {
      return new Response(JSON.stringify({ message: "Auth session expired. Please sign in again." }), {
        status, headers: { "Content-Type": "application/json" },
      });
    },
  });

  return { api: module.exports, clearCount: () => clearCount };
}

test("authenticated 401 clears the session so the dashboard guard redirects to login", async () => {
  const client = createClient(401);
  await assert.rejects(client.api.apiRequest("/api/admin/dashboard", {
    headers: { "X-Session-Id": "expired-token" },
  }), { statusCode: 401 });
  assert.equal(client.clearCount(), 1);
});

test("failed login does not clear a session", async () => {
  const client = createClient(401);
  await assert.rejects(client.api.apiRequest("/api/auth/admin/login", { method: "POST" }), { statusCode: 401 });
  assert.equal(client.clearCount(), 0);
});

test("an older request cannot clear a newly signed-in session", async () => {
  const client = createClient(401, "new-token");
  await assert.rejects(client.api.apiRequest("/api/admin/dashboard", {
    headers: { "X-Session-Id": "expired-token" },
  }), { statusCode: 401 });
  assert.equal(client.clearCount(), 0);
});

test("other API failures keep the admin signed in", async () => {
  const client = createClient(500);
  await assert.rejects(client.api.apiRequest("/api/admin/dashboard", {
    headers: { "X-Session-Id": "expired-token" },
  }), { statusCode: 500 });
  assert.equal(client.clearCount(), 0);
});
