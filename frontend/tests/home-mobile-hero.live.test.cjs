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

test("mobile Home hero uses the portrait image and docks its planner until the footer", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-home-hero-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-home-hero-")) {
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
  await client.send("Page.navigate", { url: process.env.HOME_HERO_SITE_URL || "http://localhost:3001/" });
  await waitFor(`document.querySelector('picture img')?.complete && [...document.querySelectorAll('button[aria-controls="plan-trip-panel"]')].some(button => !button.closest('main'))`, "hero image and hydrated planner");
  const inspect = `(() => {
    const inline = document.querySelector('main button[aria-controls="plan-trip-panel"]');
    const dock = [...document.querySelectorAll('button[aria-controls="plan-trip-panel"]')].find(button => !button.closest('main'));
    const image = document.querySelector('picture img');
    const rect = inline.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    return { source: decodeURIComponent(image.currentSrc), inlineLeft: rect.left,
      descriptionLeft: document.querySelector('main section p.text-description').getBoundingClientRect().left,
      logoHeight: document.querySelector('header a[aria-label="Ancient Trails home"] img').getBoundingClientRect().height,
      width: innerWidth, inlineTop: rect.top, descriptionBottom: document.querySelector('main section p.text-description').getBoundingClientRect().bottom,
      dockHidden: dock.parentElement.inert, dockOpacity: getComputedStyle(dock.parentElement).opacity,
      dockTop: dockRect.top, dockBottom: dockRect.bottom, height: innerHeight };
  })()`;
  async function checkPlannerLayout() {
    await pause(900);
    const layout = await evaluate(`(() => {
      const panel = document.querySelector('#plan-trip-panel');
      const fields = [...panel.querySelectorAll('[data-plan-trip-field]')].map(field => {
        const r = field.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
      const rect = panel.getBoundingClientRect();
      const dock = [...document.querySelectorAll('button[aria-controls="plan-trip-panel"]')].find(b => !b.closest('main'));
      return { fields, top: rect.top, bottom: rect.bottom, height: innerHeight,
        dockHidden: dock.parentElement.inert && getComputedStyle(dock.parentElement).visibility === 'hidden' };
    })()`);
    assert.equal(layout.dockHidden, true, "Floating launcher cannot overlap the open planner");
    assert.ok(layout.top >= 0 && layout.bottom <= layout.height, "Planner fits the mobile viewport");
    assert.equal(layout.fields.length, 3);
    for (let i = 1; i < layout.fields.length; i++) {
      assert.ok(layout.fields[i].top >= layout.fields[i - 1].bottom, "Planner fields do not overlap");
    }
  }
  for (const [width, height] of [[390, 844], [412, 915], [360, 640]]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await evaluate("scrollTo({top:0,behavior:'instant'})");
    await waitFor(`document.querySelector('main button[aria-controls="plan-trip-panel"]').getBoundingClientRect().top > 0`, "inline hero button");
    await pause(700);
    const hero = await evaluate(inspect);
    assert.match(hero.source, /Mobile_banner.webp/);
    assert.ok(Math.abs(hero.inlineLeft - hero.descriptionLeft) <= 1, "Hero button aligns with the description");
    assert.equal(hero.logoHeight, 18, "Mobile header logo is 18px tall");
    assert.ok(hero.inlineTop > hero.descriptionBottom, "Hero button follows the description");
    assert.equal(hero.dockHidden, true, "Dock is inert while on the hero");

    await evaluate("scrollTo({top:document.querySelector('main section').offsetHeight + 60,behavior:'instant'})");
    await waitFor(`(() => { const dock = [...document.querySelectorAll('button[aria-controls="plan-trip-panel"]')].find(b => !b.closest('main')); return !dock.parentElement.inert && getComputedStyle(dock.parentElement).opacity === '1'; })()`, "revealed bottom dock");
    const dock = await evaluate(inspect);
    assert.ok(dock.dockTop > 0 && dock.dockBottom < height, "Dock fits within the viewport");
    await evaluate(`[...document.querySelectorAll('button[aria-controls="plan-trip-panel"]')].find(b => !b.closest('main')).click()`);
    await waitFor("!!document.querySelector('#plan-trip-panel input')", "planner opens from the dock");
    await checkPlannerLayout();
    await evaluate(`document.querySelector('button[aria-label="Close trip planner"]').click()`);
    await waitFor("!document.querySelector('#plan-trip-panel')", "planner closes");
    await evaluate("document.querySelector('footer').scrollIntoView({behavior:'instant'})");
    await waitFor(`(() => { const dock = [...document.querySelectorAll('button[aria-controls="plan-trip-panel"]')].find(b => !b.closest('main')); return dock.parentElement.inert && getComputedStyle(dock.parentElement).opacity === '0'; })()`, "dock hides at footer");
    await evaluate("scrollTo({top:0,behavior:'instant'})");
    await pause(700);
    assert.equal((await evaluate(inspect)).dockHidden, true, "Returning to hero restores the inline button");
    await evaluate(`document.querySelector('main button[aria-controls="plan-trip-panel"]').click()`);
    await waitFor("!!document.querySelector('#plan-trip-panel input')", "planner opens from the inline button");
    await checkPlannerLayout();
    await evaluate(`document.querySelector('button[aria-label="Close trip planner"]').click()`);
    await waitFor("!document.querySelector('#plan-trip-panel')", "inline planner closes");
    t.diagnostic(`Mobile hero and planner passed at ${width} x ${height}`);
  }
  // Static deployments disable optimization; exercise the raw mobile URL too.
  await evaluate(`document.querySelector('picture source').srcset = '/home%20assets/Mobile_banner.webp'`);
  await waitFor(`decodeURIComponent(document.querySelector('picture img').currentSrc).endsWith('/home assets/Mobile_banner.webp') && document.querySelector('picture img').naturalWidth > 0`, "unoptimized mobile hero");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await waitFor(`decodeURIComponent(document.querySelector('picture img').currentSrc).includes('Briddeshwara')`, "unchanged desktop hero");
  await waitFor(`(() => { const button = [...document.querySelectorAll('main button[aria-controls="plan-trip-panel"]')].find(b => getComputedStyle(b.parentElement).position === 'relative'); return button && !button.parentElement.inert; })()`, "unchanged desktop launcher");
  assert.equal(await evaluate(`document.querySelector('header a[aria-label="Ancient Trails home"] img').getBoundingClientRect().height`), 86, "Desktop logo retains its original height");
});

