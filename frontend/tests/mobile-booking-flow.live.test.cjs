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

test("phone booking uses short steps, preserves details, and keeps the total and payment reachable", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-booking-flow-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-booking-flow-")) {
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
  const dock = "document.querySelector('[data-mobile-booking-bar]')";
  const visibleStage = stage => `getComputedStyle(document.querySelector('[data-booking-stage="${stage}"]')).display !== 'none'`;
  async function fill(label, value) {
    await evaluate(`(() => {
      const input=document.querySelector('[aria-label="${label}"]');
      Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
  }
  for (const width of [373, 390, 768]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
    await navigateBookingTour(client, evaluate, waitFor, origin + "/tours/enigmatic-khajuraho");
    await waitFor("document.body?.innerText.includes('40,000')", "live tour");
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Book Now')?.click()");
    await waitFor(`Boolean(${dock}) && ${visibleStage(0)}`, "sign in comes first");
    assert.equal(await evaluate("getComputedStyle(document.getElementById('itinerary')).display"),"none","Tour information does not lengthen the booking flow");
    const total = await evaluate(`(() => {
      const bar=${dock},amount=bar.querySelector('[data-booking-total]'),r=bar.getBoundingClientRect(),s=getComputedStyle(amount);
      return {text:amount.textContent,whiteSpace:s.whiteSpace,height:amount.clientHeight,lineHeight:parseFloat(s.lineHeight),width:amount.clientWidth,scrollWidth:amount.scrollWidth,bottom:r.bottom,top:r.top,viewport:innerHeight};
    })()`);
    assert.match(total.text,/42,000/);
    assert.equal(total.whiteSpace,"nowrap");
    assert.ok(total.height <= total.lineHeight + 1 && total.scrollWidth <= total.width,JSON.stringify(total));
    assert.ok(total.top >= 0 && total.bottom <= total.viewport+1,"Total and Continue remain inside the viewport");
    await advanceBookingTo(evaluate,waitFor,1);
    assert.equal(await evaluate(visibleStage(1)),true);
    assert.equal(await evaluate(visibleStage(2)),false);
    await evaluate("document.querySelector('button[aria-label=\"Increase Adult count\"]').click()");
    await waitFor("document.querySelector('[data-booking-total]').textContent.includes('84,000')","selected total updates with travellers");
    await evaluate("document.querySelector('button[aria-label=\"Decrease Adult count\"]').click()");
    await evaluate("document.querySelector('button[aria-label=\"Increase Child count\"]').click()");
    await evaluate(`${dock}.querySelector('button').click()`);
    assert.equal(await evaluate(visibleStage(1)),true,"Child birth dates are required before room pricing");
    await evaluate("document.querySelector('button[aria-label=\"Decrease Child count\"]').click()");
    await advanceBookingTo(evaluate,waitFor,2);
    assert.match(await evaluate("document.querySelector('input[name=\"tour-accommodation\"]:checked').closest('label').innerText"),/Twin Sharing/);
    await evaluate("[...document.querySelectorAll('input[name=\"tour-accommodation\"]')].find(input=>input.closest('label').innerText.includes('Single Occupancy')).click()");
    await waitFor("document.querySelector('[data-booking-total]').textContent.includes('54,600')","single-room total includes GST");
    await evaluate("[...document.querySelectorAll('nav[aria-label=\"Booking steps\"] button')].find(button=>button.textContent==='Back').click()");
    await advanceBookingTo(evaluate,waitFor,2);
    assert.match(await evaluate("document.querySelector('input[name=\"tour-accommodation\"]:checked').closest('label').innerText"),/Single Occupancy/,"Back preserves the selected room");
    await evaluate("[...document.querySelectorAll('input[name=\"tour-accommodation\"]')].find(input=>input.closest('label').innerText.includes('Twin Sharing')).click()");
    await advanceBookingTo(evaluate,waitFor,3);
    assert.equal(await evaluate(visibleStage(0)),false,"Sign-in is not repeated in the details step");
    await evaluate(`${dock}.querySelector('button').click()`);
    assert.equal(await evaluate(visibleStage(3)),true,"Incomplete details cannot skip to payment");
    await fill("Lead Traveller address","Fixture street");
    await fill("Booking emergency contact name","Emergency Fixture");
    await fill("Booking emergency contact mobile number","8000000000");
    await waitFor("!document.querySelector('[data-booking-terms]').disabled","valid booking details");
    await evaluate("[...document.querySelectorAll('nav[aria-label=\"Booking steps\"] button')].find(button=>button.textContent==='Back').click()");
    await advanceBookingTo(evaluate,waitFor,3);
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Lead Traveller address\"]').value"),"Fixture street","Back preserves entered details");
    const lastField = await evaluate(`(() => {
      const input=document.querySelector('[aria-label="Booking emergency contact mobile number"]');input.scrollIntoView({block:'center',behavior:'instant'});
      const button=${dock}.querySelector('button'),r=button.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight,page:document.documentElement.scrollHeight};
    })()`);
    assert.ok(lastField.top>=0 && lastField.bottom<=lastField.height,"Continue remains visible at the last field");
    assert.ok(lastField.page<6000,"The phone booking no longer includes the long tour-information page");
    await advanceBookingTo(evaluate,waitFor,4);
    await waitFor("document.querySelector('[data-mobile-booking-bar] button').textContent.trim()==='Pay Now'","Pay Now in the fixed bottom bar");
    await evaluate(`${dock}.querySelector('button').click()`);
    await waitFor("document.activeElement===document.getElementById('booking-form-errors')","unchecked terms are announced in the summary");
    assert.equal(await evaluate("Boolean(document.querySelector('button[aria-label=\"Close payment options\"]'))"),false);
    await evaluate("document.querySelector('[data-booking-terms]').click()");
    await waitFor("document.querySelector('[data-booking-terms]').checked","accepted terms");
    await evaluate(`${dock}.querySelector('button').click()`);
    await waitFor("Boolean(document.querySelector('button[aria-label=\"Close payment options\"]'))","payment options open");
    assert.deepEqual(await evaluate("window.__blockedTestWrites"),[],"No real OTP, booking or payment request");
    await evaluate("document.querySelector('button[aria-label=\"Close payment options\"]').click()");
    t.diagnostic(`${width}px: ordered steps, single-line ₹42,000 total, preserved details, and reachable Pay Now passed.`);
  }
  // A guest must sign in before the date/room/details stages become available.
  await evaluate("document.querySelector('nav[aria-label=\"Booking steps\"] li button').click();localStorage.removeItem('ancient_trails_token');localStorage.removeItem('ancient_trails_user');window.dispatchEvent(new Event('ancient-trails-session-change'))");
  await waitFor(`${dock}.querySelector('button').disabled`,"guest must verify mobile before continuing");
  assert.equal(await evaluate(visibleStage(0)),true);
  await evaluate("[...document.querySelectorAll('nav[aria-label=\"Booking steps\"] button')].find(button=>button.textContent==='View tour').click()");
  await waitFor("!document.querySelector('[data-mobile-booking-bar]') && getComputedStyle(document.getElementById('itinerary')).display!=='none'", "return to the full tour page");
});
