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

test("traveller counters disable at the booking or seat limit and offer group enquiry", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-traveller-limit-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-traveller-limit-")) {
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
  const increase = label => `document.querySelector('button[aria-label="Increase ${label} count"]')`;
  const adultCount = `${increase("Adult")}.parentElement.querySelector('strong').textContent`;
  await client.send("Page.enable");
  const { installBookingFixture, advanceBookingTo, navigateBookingTour } = require("./helpers/booking-fixture.cjs");
  await installBookingFixture(client, true);
  for (const width of [1440, 390]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await navigateBookingTour(client, evaluate, waitFor, origin + "/tours/enigmatic-khajuraho");
    await waitFor("document.body?.innerText.includes('40,000')", "bookable tour");
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Book Now')?.click()");
    await waitFor(`Boolean(${increase("Adult")})`, "traveller counters");
    await advanceBookingTo(evaluate, waitFor, 1);
    for (let count = 2; count <= 6; count++) {
      await evaluate(`${increase("Adult")}.click()`);
      await waitFor(`${adultCount} === '${count}'`, `${count} adults`);
    }
    assert.equal(await evaluate("document.body.innerText.includes('Maximum 6 adults per booking. For larger groups, enquire.')"), true);
    for (const label of ["Adult", "Child", "Infant"]) assert.equal(await evaluate(`${increase(label)}.disabled`), true, `${label} + disabled at the shared limit`);
    await evaluate(`${increase("Adult")}.click()`);
    assert.equal(await evaluate(adultCount), "6", "Disabled button cannot increase the count");
    await evaluate("document.querySelector('button[aria-label=\"Decrease Adult count\"]').click()");
    await waitFor(`!${increase("Adult")}.disabled && ${adultCount} === '5'`, "decreasing re-enables the + button");
    assert.equal(await evaluate("document.body.innerText.includes('Maximum 6 adults per booking.')"), false);
    await evaluate(`${increase("Child")}.click()`);
    await waitFor("document.body.innerText.includes('Maximum 6 travellers per booking. For larger groups, enquire.')", "mixed groups share the same six-traveller limit");
    await evaluate("[...document.querySelectorAll('#departure-pricing button')].find(button=>button.textContent.trim()==='Enquire Now').click()");
    const dialog = "[...document.querySelectorAll('[role=dialog]')].find(el=>el.querySelector('h2')?.textContent.trim()==='Enquire Now')";
    await waitFor(`Boolean(${dialog})`, "group enquiry form");
    assert.equal(await evaluate(`(${dialog}).querySelector('button[aria-label="Increase Adult count"]').disabled`), false, "Enquiries allow larger groups");
    await evaluate(`(${dialog}).querySelector('button[aria-label="Increase Adult count"]').click()`);
    assert.equal(await evaluate(`(${dialog}).querySelector('button[aria-label="Increase Adult count"]').parentElement.querySelector('strong').textContent`), "6");
    await evaluate("document.querySelector('button[aria-label=\"Close enquiry form\"]').click()");
    await waitFor("!document.querySelector('button[aria-label=\"Close enquiry form\"]')", "closed enquiry form");
    assert.equal(await evaluate(adultCount), "5", "Enquiry counts do not alter the booking");
    t.diagnostic(`${width}px: six adults disable all + buttons and show the enquiry message; mixed groups and larger enquiries work.`);
  }
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `
    const originalFetch=window.fetch;
    window.fetch=async(...args)=>{
      const response=await originalFetch(...args);
      if(!String(args[0]).includes('/api/tours/departures')) return response;
      const body=await response.json();
      body.data.departures=body.data.departures.map(d=>d.departureId==='DEP014'?{...d,totalSeats:3,filledSeats:1,seatsAvailable:2}:d);
      return new Response(JSON.stringify(body),{status:response.status,headers:{'Content-Type':'application/json'}});
    };` });
  await navigateBookingTour(client, evaluate, waitFor, origin + "/tours/enigmatic-khajuraho");
  await waitFor("document.body?.innerText.includes('2 Seats')", "two available seats");
  await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Book Now')?.click()");
  await waitFor(`Boolean(${increase("Adult")})`, "seat-limited counter");
  await advanceBookingTo(evaluate, waitFor, 1);
  await evaluate(`${increase("Adult")}.click()`);
  await waitFor("document.body.innerText.includes('Only 2 seats are available for this departure.')", "seat availability explains a lower limit");
  assert.equal(await evaluate(`${increase("Adult")}.disabled`), true);
});
