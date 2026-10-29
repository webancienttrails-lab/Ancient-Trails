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

test("all published tours default to the next departure and changing dates updates the offer", { timeout: 300000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-departures-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-departures-")) {
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
  const ts = require("typescript");
  const Module = require("node:module");
  const selectorFile = path.resolve(__dirname, "../lib/tour-departures.ts");
  const selectorModule = new Module(selectorFile, module);
  selectorModule._compile(ts.transpileModule(fs.readFileSync(selectorFile, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, selectorFile);
  const { getBookableDepartures, getDepartureSeatsLeft } = selectorModule.exports;
  const origin = process.env.TOUR_TEST_SITE_URL || "http://localhost:3001";
  const api = process.env.TOUR_TEST_API_URL || "http://localhost:5000";
  const tours = (await (await fetch(api + "/api/tours")).json()).data.tours;
  const departures = (await (await fetch(api + "/api/tours/departures")).json()).data.departures;
  const slug = name => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const highlight = "[...document.querySelectorAll('article')].find(el=>el.querySelector('h2')?.textContent.trim()==='Tour Highlight')";
  const tourCard = tour => `[...document.querySelectorAll('article h3')].find(el=>el.textContent.trim()===${JSON.stringify(tour.tourName)})?.closest('article')`;
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  for (const tour of tours) {
    const eligible = getBookableDepartures(departures.filter(d => d.tourId === tour.tourId));
    const next = eligible[0];
    await client.send("Page.navigate", { url: origin + "/tours/" + slug(tour.tourName) });
    const expected = next ? getDepartureSeatsLeft(next) + " " + (getDepartureSeatsLeft(next) === 1 ? "Seat" : "Seats") : "Seats on Request";
    await waitFor(`document.body?.innerText.includes(${JSON.stringify(tour.tourName)}) && (${highlight})?.innerText.includes(${JSON.stringify(expected)})`, tour.tourName + " seats");
    if (next) {
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Book Now')?.click()");
      const dates = await waitFor("document.querySelectorAll('[data-booking-departure]').length && [...document.querySelectorAll('[data-booking-departure]')].map(el=>el.innerText)", "bookable dates");
      assert.equal(dates.length, eligible.length, tour.tourName + " excludes unavailable dates");
      assert.match(dates[0], /Selected departure/);
      const day = new Date(next.departureDate).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
      for (const digit of day.match(/\d+/g)) assert.ok(dates[0].includes(String(Number(digit))), tour.tourName + " next date: " + dates[0]);
      assert.ok((await evaluate("document.body.innerText")).includes(next.priceAdult.toLocaleString("en-IN")), tour.tourName + " selected price");
    }
    t.diagnostic(tour.tourName + ": " + (next?.departureDate || "no bookable departures") + ", " + expected);
  }

  await client.send("Page.navigate", { url: origin + "/tours" });
  for (const tour of tours) {
    const next = getBookableDepartures(departures.filter(d => d.tourId === tour.tourId))[0];
    if (!next) continue;
    const text = await waitFor(`(${tourCard(tour)})?.innerText.includes(${JSON.stringify(String(new Date(next.departureDate).getUTCFullYear()))}) && (${tourCard(tour)}).innerText`, tour.tourName + " listing date");
    const date = new Date(next.departureDate);
    assert.ok(text.includes(String(date.getUTCDate())) && text.includes(String(date.getUTCFullYear())), tour.tourName + " listing date");
    assert.ok(text.includes(date.toLocaleDateString("en-GB", {month:"short",timeZone:"Asia/Kolkata"})), tour.tourName + " listing month");
  }
  for (const tour of tours) {
    const next = getBookableDepartures(departures.filter(d => d.tourId === tour.tourId))[0];
    if (!next) continue;
    await client.send("Page.navigate", { url: origin + "/tour-calendar?tour=" + slug(tour.tourName) });
    const text = await waitFor(`(${tourCard(tour)})?.innerText.includes(${JSON.stringify(getDepartureSeatsLeft(next) + " seats left")}) && (${tourCard(tour)}).innerText`, tour.tourName + " calendar seats");
    assert.ok(text.includes(String(new Date(next.departureDate).getUTCDate())), tour.tourName + " calendar date");
    assert.ok(text.includes(new Date(next.departureDate).toLocaleDateString("en-GB", {month:"short",timeZone:"Asia/Kolkata"})), tour.tourName + " calendar month");
  }

  // Different prices prove selection controls the offer, even when the later date costs less.
  const badami = tours.find(t => /Flavours/i.test(t.tourName));
  assert.ok(badami);
  const eligible = getBookableDepartures(departures.filter(d => d.tourId === badami.tourId));
  assert.ok(eligible.length >= 2, "Date switching needs two bookable departures");
  const fixtures = departures.map(d => d.id === eligible[0].id
    ? { ...d, priceAdult: 47000, totalSeats: 25, filledSeats: 1, seatsAvailable: 15 }
    : d.id === eligible[1].id ? { ...d, priceAdult: 39000, totalSeats: 25, filledSeats: 0, seatsAvailable: 25 } : d);
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `const originalFetch=window.fetch;window.fetch=async(...args)=>String(args[0]).includes('/api/tours/departures')?new Response(JSON.stringify({data:{departures:${JSON.stringify(fixtures)}}}),{headers:{'Content-Type':'application/json'}}):originalFetch(...args);`,
  });
  await client.send("Page.navigate", { url: origin + "/tours/" + slug(badami.tourName) });
  await waitFor(`document.body?.innerText.includes('47,000') && (${highlight})?.innerText.includes('24 Seats')`, "first departure price and 24 seats");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Book Now')?.click()");
  await waitFor("document.querySelectorAll('[data-booking-departure]').length===2", "two dates");
  await evaluate("document.querySelectorAll('[data-booking-departure]')[1].click()");
  await waitFor(`document.body?.innerText.includes('39,000') && !document.body?.innerText.includes('47,000') && (${highlight})?.innerText.includes('25 Seats')`, "updated price and 25 seats");
  const selectedDate = await evaluate("document.querySelectorAll('[data-booking-departure]')[1].querySelector('strong').textContent.trim()");
  assert.ok((await evaluate(`(${highlight}).innerText`)).includes(selectedDate), "sidebar includes selected departure date");
});
