const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) pending.get(message.id)?.(message);
  };
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timeout = setTimeout(() => { pending.delete(id); reject(Error(`Browser timed out: ${method}`)); }, 30000);
        pending.set(id, message => {
          clearTimeout(timeout);
          pending.delete(id);
          message.error ? reject(Error(JSON.stringify(message.error))) : resolve(message.result);
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

test("mobile search at 390 px is visible, opens, and finds a Khajuraho tour and destination", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-mobile-search-"));
  const browser = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], {
    windowsHide: true, stdio: ["ignore", "ignore", "pipe"],
  });
  let launchError;
  let logs = "";
  browser.on("error", error => { launchError = error; });
  browser.stderr.on("data", data => { logs = (logs + data).slice(-2000); });
  let client;
  t.after(async () => {
    if (client) { await client.send("Browser.close").catch(() => {}); client.close(); }
    for (let i = 0; i < 20 && browser.exitCode === null; i++) await pause(100);
    if (browser.exitCode === null) browser.kill();
    // Only remove the unique temporary profile created by this test.
    const resolved = path.resolve(profile);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-mobile-search-")) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
  const portFile = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) {
    if (launchError) throw launchError;
    assert.equal(browser.exitCode, null, `Browser exited before starting: ${logs}`);
    await pause(100);
  }
  assert.ok(fs.existsSync(portFile), `Browser did not start: ${logs}`);
  const [port] = fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  client = await connect(targets.find(target => target.type === "page").webSocketDebuggerUrl);
  async function evaluate(expression) {
    const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function waitFor(expression, description) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const value = await evaluate(expression);
      if (value) return value;
      await pause(200);
    }
    assert.fail(`Timed out waiting for ${description}`);
  }
  async function tap(point) {
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await client.send("Page.navigate", { url: process.env.MOBILE_SEARCH_SITE_URL || "http://localhost:3001/" });
  const searchPoint = await waitFor(`(() => {
    const button = document.querySelector('button[aria-label="Search Ancient Trails"]');
    if (!button || innerWidth !== 390) return false;
    const r = button.getBoundingClientRect(), style = getComputedStyle(button);
    if (r.width <= 0 || r.height <= 0 || r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight || style.visibility === 'hidden' || style.display === 'none') return false;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return button.contains(document.elementFromPoint(x, y)) ? { x, y } : false;
  })()`, "a visible, tappable search icon inside the 390 px viewport");
  await tap(searchPoint);
  const inputPoint = await waitFor(`(() => {
    const input = document.querySelector('input[placeholder="Search tours, destinations, experiences..."]');
    const button = document.querySelector('button[aria-label="Search Ancient Trails"]');
    if (!input || button?.getAttribute('aria-expanded') !== 'true') return false;
    const r = input.getBoundingClientRect();
    return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : false;
  })()`, "the opened search overlay");
  await tap(inputPoint);
  await client.send("Input.insertText", { text: "khaj" });
  const matches = await waitFor(`(() => {
    const input = document.querySelector('input[placeholder="Search tours, destinations, experiences..."]');
    if (!input || input.value !== 'khaj') return false;
    const popup = input.closest('label').parentElement.parentElement;
    const links = [...popup.querySelectorAll('a')].map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() }));
    const tour = links.find(a => a.href.startsWith('/tours/') && /khaj/i.test(a.text));
    const destination = links.find(a => a.href.startsWith('/destinations/') && /khaj/i.test(a.text));
    return tour && destination ? { tour, destination } : false;
  })()`, '"khaj" results containing both a tour and a destination');
  assert.ok(matches.tour.href.startsWith("/tours/"));
  assert.ok(matches.destination.href.startsWith("/destinations/"));
  t.diagnostic(`390 px search passed: ${matches.tour.href} and ${matches.destination.href}`);
});
