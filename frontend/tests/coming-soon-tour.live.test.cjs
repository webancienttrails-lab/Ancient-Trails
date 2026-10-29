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

test("coming-soon tours hide prices and offer enquiry on desktop and mobile", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-coming-soon-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-coming-soon-")) {
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
  const origin = process.env.TOUR_TEST_SITE_URL || "http://localhost:3001";
  await client.send("Page.enable");
  for (const width of [1440, 390]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await client.send("Page.navigate", { url: origin + "/tours/leisurely-hampi" });
    await waitFor("document.querySelector('h1')?.textContent.includes('Leisurely Hampi') && document.body.innerText.includes('Dates and prices will be announced soon.')", "the unavailable tour's enquiry state");
    const state = await evaluate(`({
      buttons: [...document.querySelectorAll('main button')].filter(button=>/^(Book Now|Pay Now)$/.test(button.textContent.trim())).length,
      price: document.body.innerText.includes('36,000'),
      priceCaption: document.body.innerText.includes('per person on twin sharing'),
      bookingFields: document.querySelectorAll('[data-booking-departure],input[name="tour-accommodation"]').length,
      enquireButtons: [...document.querySelectorAll('main button')].filter(button=>button.textContent.trim()==='Enquire Now').length,
    })`);
    assert.equal(state.buttons, 0, "No booking or payment action, including in the hidden desktop/mobile layouts");
    assert.equal(state.price, false, "Coming-soon price is hidden");
    assert.equal(state.priceCaption, false, "No price caption without an offer");
    assert.equal(state.bookingFields, 0, "No booking form for an unavailable tour");
    assert.ok(state.enquireButtons >= 3);
    // Exercise every replaced CTA, including the mobile bar and pricing panel.
    for (let index = 0; index < state.enquireButtons; index++) {
      await evaluate(`[...document.querySelectorAll('main button')].filter(button=>button.textContent.trim()==='Enquire Now')[${index}].click()`);
      await waitFor("[...document.querySelectorAll('[role=dialog]')].some(dialog=>dialog.querySelector('h2')?.textContent.trim()==='Enquire Now' && dialog.innerText.includes('Leisurely Hampi'))", "the existing enquiry form with the correct tour");
      await evaluate("document.querySelector('button[aria-label=\"Close enquiry form\"]').click()");
      await waitFor("!document.querySelector('button[aria-label=\"Close enquiry form\"]')", "closed enquiry form");
    }
    t.diagnostic(`${width}px: no price or Book Now; every enquiry CTA opens the tour form.`);
  }
  await client.send("Page.navigate", { url: origin + "/tours/enigmatic-khajuraho" });
  await waitFor("document.body?.innerText.includes('40,000') && [...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Book Now')", "bookable tours retain their price and booking actions");
});
