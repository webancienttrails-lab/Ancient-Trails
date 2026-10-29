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

test("required booking terms are visible and usable beside Pay Now at 375, 768 and 1280 px", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-booking-terms-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-booking-terms-")) {
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
  for (const width of [375, 768, 1280]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await navigateBookingTour(client, evaluate, waitFor, origin + "/tours/enigmatic-khajuraho");
    await waitFor("document.body?.innerText.includes('40,000') && Boolean(document.querySelector('[data-booking-terms]'))", "live tour and terms checkbox");
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Book Now')?.click()");
    await waitFor("Boolean(document.querySelector('input[name=\"tour-accommodation\"]:checked'))", "opened booking panel");
    if (width < 1024) await advanceBookingTo(evaluate, waitFor, 3);
    // Fill the remaining booking details locally using the verified fixture profile.
    for (const [label,value] of [
      ["Lead Traveller address","Fixture address"],
      ["Booking emergency contact name","Emergency Fixture"],
      ["Booking emergency contact mobile number","8000000000"],
    ]) {
      await waitFor(`Boolean(document.querySelector('[aria-label="${label}"]:not(:disabled)'))`,label+" is editable");
      await evaluate(`(() => {
        const input=document.querySelector('[aria-label="${label}"]');
        const prototype=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});
        input.dispatchEvent(new Event('input',{bubbles:true}));
      })()`);
    }
    await waitFor("!document.querySelector('[data-booking-terms]').disabled", "required checkbox becomes usable after traveller details are complete");
    if (width < 1024) await advanceBookingTo(evaluate, waitFor, 4);
    const terms = await evaluate(`(() => {
      const input=document.querySelector('[data-booking-terms]'),card=input.closest('article'),link=card.querySelector('a');
      return {count:document.querySelectorAll('[data-booking-terms]').length,hidden:!!input.closest('.hidden'),display:getComputedStyle(card).display,
        label:input.closest('label').textContent,href:link.getAttribute('href'),target:link.target,
        nextButton:card.nextElementSibling.querySelector('button').textContent.trim()};
    })()`);
    assert.equal(terms.count,1,"A single required checkbox at every width");
    assert.equal(terms.hidden,false,"No hidden responsive ancestor");
    assert.notEqual(terms.display,"none");
    assert.match(terms.label,/read and agreed.*Terms & Conditions/s);
    assert.equal(terms.href,"/terms-and-conditions");
    assert.equal(terms.target,"_blank");
    assert.equal(terms.nextButton,"Pay Now","Terms sit directly above the payment action");
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Pay Now').click()");
    await waitFor("document.activeElement===document.getElementById('booking-form-errors')", "Pay Now announces the validation summary");
    assert.equal(await evaluate("Boolean(document.querySelector('button[aria-label=\"Close payment options\"]'))"),false);
    await pause(800);
    await evaluate("document.querySelector('[data-booking-terms]').scrollIntoView({block:'center',behavior:'instant'})");
    await pause(250);
    const point = await waitFor(`(() => {
      const input=document.querySelector('[data-booking-terms]');
      const r=input.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return x>0 && x<innerWidth && y>0 && y<innerHeight && document.elementFromPoint(x,y)===input ? {x,y} : false;
    })()`, "a visible, unobstructed terms checkbox");
    await client.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,...point});
    await client.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,...point});
    await waitFor("document.querySelector('[data-booking-terms]').checked", "visible checkbox accepts the terms");
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Pay Now').click()");
    await waitFor("Boolean(document.querySelector('button[aria-label=\"Close payment options\"]'))", "accepted terms allow payment options");
    assert.deepEqual(await evaluate("window.__blockedTestWrites"),[],"Opening payment options needs no real API write");
    await evaluate("document.querySelector('button[aria-label=\"Close payment options\"]').click()");
    t.diagnostic(`${width}px: terms visible beside Pay Now, unchecked terms block payment, checked terms allow payment options.`);
  }
});
