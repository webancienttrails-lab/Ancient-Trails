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

test("phone booking launcher scrolls without losing its anchor and never covers footer or payment", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-booking-dock-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-booking-dock-")) {
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
    assert.fail(`Timed out waiting for ${description}: ${JSON.stringify(await evaluate("(() => { const i=document.querySelector('[data-booking-terms]'); const r=i?.getBoundingClientRect(); return {width:innerWidth,height:innerHeight,scrollY,rect:r?.toJSON(),aside:i?.closest('aside')?.getBoundingClientRect().toJSON(),hit:r?document.elementFromPoint(r.left+8,r.top+8)?.outerHTML.slice(0,350):null};})()"))}`);
  }
  const origin = process.env.TOUR_TEST_SITE_URL || "http://localhost:3001";
  await client.send("Page.enable");
  // A verified fixture session avoids sending OTPs. Never send test writes to the real API.
  const { installBookingFixture, advanceBookingTo, navigateBookingTour } = require("./helpers/booking-fixture.cjs");
  await installBookingFixture(client, true);
  const padding = "parseFloat(getComputedStyle(document.body).paddingBottom)";
  async function fill(label, value) {
    await evaluate(`(() => {
      const input=document.querySelector('[aria-label="${label}"]');
      Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
  }
  for (const width of [375,390,768]) {
    await client.send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await navigateBookingTour(client,evaluate,waitFor,origin+"/tours/enigmatic-khajuraho");
    await waitFor("document.body?.innerText.includes('40,000') && Boolean(document.querySelector('[data-mobile-booking-launcher]'))","launcher");
    await waitFor(`Math.abs(${padding}-document.querySelector('[data-mobile-booking-launcher]').getBoundingClientRect().height)<1.1`,"measured bottom spacing");
    await evaluate("document.getElementById('departure-pricing').scrollIntoView({block:'center',behavior:'instant'})");
    await waitFor("getComputedStyle(document.querySelector('[data-mobile-booking-launcher]')).visibility==='hidden'","launcher hides when the booking block is visible");
    assert.equal(await evaluate("document.querySelector('[data-mobile-booking-launcher] button').disabled"),true);
    await evaluate("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");
    await waitFor("getComputedStyle(document.querySelector('[data-mobile-booking-launcher]')).visibility==='visible'","launcher returns away from the block");
    await evaluate("window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");
    const footer = await evaluate(`(() => {
      const bar=document.querySelector('[data-mobile-booking-launcher]').getBoundingClientRect();
      return {bottom:document.querySelector('footer').getBoundingClientRect().bottom,barTop:bar.top,padding:${padding},height:bar.height};
    })()`);
    assert.ok(footer.bottom<=footer.barTop+2,JSON.stringify(footer));
    assert.ok(Math.abs(footer.padding-footer.height)<1.1);
    await evaluate("window.__bookingScrollCalls=[];window.__originalScrollTo=window.scrollTo.bind(window);window.scrollTo=(...args)=>{window.__bookingScrollCalls.push(args[0]);return window.__originalScrollTo(...args)};document.querySelector('[data-mobile-booking-launcher] button').click()");
    await waitFor("Boolean(document.querySelector('[data-mobile-booking-bar]')) && Math.abs(document.getElementById('departure-pricing').getBoundingClientRect().top-76)<5","booking stays at its viewport anchor after opening");
    assert.equal(await evaluate("Boolean(document.querySelector('[data-mobile-booking-launcher]'))"),false,"The Book Now launcher is replaced inside the booking flow");
    assert.equal(await evaluate("window.__bookingScrollCalls.filter(call=>call.behavior==='smooth').length"),1,"One smooth transition into booking");
    await advanceBookingTo(evaluate,waitFor,3);
    await fill("Lead Traveller address","Fixture street");
    await fill("Booking emergency contact name","Emergency Fixture");
    await fill("Booking emergency contact mobile number","8000000000");
    await waitFor("!document.querySelector('[data-booking-terms]').disabled","complete booking");
    await advanceBookingTo(evaluate,waitFor,4);
    await evaluate("document.querySelector('[data-booking-terms]').click()");
    await waitFor("document.querySelector('[data-booking-terms]').checked","accepted terms");
    const before = await evaluate(`({padding:${padding},scroll:scrollY})`);
    await evaluate("document.querySelector('[data-mobile-booking-bar] button').click()");
    await waitFor("Boolean(document.querySelector('button[aria-label=\"Close payment options\"]'))","payment options");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-mobile-booking-bar]')).visibility"),"hidden","The dock is hidden during payment");
    assert.equal(await evaluate("document.querySelector('[data-mobile-booking-bar]').inert"),true);
    assert.equal(await evaluate("document.querySelector('[data-mobile-booking-bar] button').disabled"),true);
    assert.equal(await evaluate(padding),before.padding,"Payment overlays keep the reserved spacing stable");
    await evaluate("document.querySelector('button[aria-label=\"Close payment options\"]').click()");
    await waitFor("getComputedStyle(document.querySelector('[data-mobile-booking-bar]')).visibility==='visible'","dock returns when payment options close");
    assert.deepEqual(await evaluate("window.__blockedTestWrites"),[]);
    await evaluate("[...document.querySelectorAll('main a')].find(link=>link.getAttribute('href')==='/tours').click()");
    await waitFor(`location.pathname==='/tours' && ${padding}===0`,"tour-only bottom spacing is cleaned up on navigation");
    t.diagnostic(`${width}px: booking anchor retained, launcher hides at booking, footer clears the bar, and payment hides the dock without shifting spacing.`);
  }
});
