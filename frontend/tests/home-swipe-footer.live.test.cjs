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

test("mobile feature cards swipe and footer styling preserves desktop", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-home-swipe-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-home-swipe-")) {
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
  let port;
  for (let i = 0; i < 30 && !port; i++) {
    try { [port] = fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/); }
    catch (error) { if (!["EBUSY", "ENOENT"].includes(error.code)) throw error; }
    if (!port) await pause(100);
  }
  assert.ok(port, "Chrome debugging port becomes readable");
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


  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await client.send("Page.navigate", { url: process.env.HOME_HERO_SITE_URL || "http://localhost:3001/" });
  await waitFor(`document.querySelector('#why-choose-us button[aria-pressed="true"]') && [...document.querySelectorAll('button[aria-controls="plan-trip-panel"]')].some(b => !b.closest('main'))`, "hydrated Home page");
  const activeIndex = `[...document.querySelectorAll('#why-choose-us button[data-slot="carousel-dot"]')].findIndex(b => b.getAttribute('aria-pressed') === 'true')`;
  async function swipe(direction) {
    const point = await evaluate(`(() => { const r = document.querySelector('#why-choose-us .touch-pan-y').getBoundingClientRect(); return {x: innerWidth / 2, y: r.top + 80}; })()`);
    const from = point.x + (direction === "left" ? 70 : -70);
    const to = point.x + (direction === "left" ? -70 : 70);
    await client.send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[{x:from,y:point.y}]});
    for (let i = 1; i <= 5; i++) {
      await client.send("Input.dispatchTouchEvent", {type:"touchMove",touchPoints:[{x:from + (to-from)*i/5,y:point.y}]});
    }
    await client.send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
  }
  for (const width of [390, 412]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate(`document.querySelector('#why-choose-us .touch-pan-y').scrollIntoView({block:'center',behavior:'instant'})`);
    await evaluate(`document.querySelector('#why-choose-us button[data-slot="carousel-dot"]').click()`);
    await pause(750);
    await swipe("left");
    await waitFor(`(${activeIndex}) === 1`, "left swipe advances one card");
    await swipe("right");
    await waitFor(`(${activeIndex}) === 0`, "right swipe returns one card");
    await swipe("right");
    await waitFor(`(${activeIndex}) === 4`, "right swipe wraps to the last card");
    const footer = await evaluate(`(() => {
      const trust = [...document.querySelectorAll('footer section')].find(s => s.textContent.includes('Best Price Guarantee'));
      const logo = document.querySelector('footer a[aria-label="Ancient Trails home"] img');
      const footer = document.querySelector('footer').getBoundingClientRect();
      const background = document.querySelector('footer > img').getBoundingClientRect();
      return {trustDisplay:getComputedStyle(trust).display, logoPosition:getComputedStyle(logo).objectPosition,
        darkBackgroundCoversText: background.top + background.height * 0.69 >= footer.bottom,
        backgroundPosition: getComputedStyle(document.querySelector('footer > img')).objectPosition};
    })()`);
    assert.equal(footer.trustDisplay, "none");
    assert.equal(footer.logoPosition, "0% 50%");
    assert.equal(footer.darkBackgroundCoversText, true, "The light band is cropped outside the mobile footer");
    assert.equal(footer.backgroundPosition, "50% 0%");
    t.diagnostic(`${width}px: left/right swipes and wrap work; mobile footer benefits hidden and logo aligned left.`);
  }
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const desktop = await evaluate(`(() => {
    const trust = [...document.querySelectorAll('footer section')].find(s => s.textContent.includes('Best Price Guarantee'));
    const logo = document.querySelector('footer a[aria-label="Ancient Trails home"] img');
    return {trustDisplay:getComputedStyle(trust).display, logoPosition:getComputedStyle(logo).objectPosition,
      layout:getComputedStyle(document.querySelector('#why-choose-us .touch-pan-y > div')).display};
  })()`);
  assert.notEqual(desktop.trustDisplay, "none");
  assert.equal(desktop.logoPosition, "50% 50%");
  assert.equal(desktop.layout, "grid");
});

