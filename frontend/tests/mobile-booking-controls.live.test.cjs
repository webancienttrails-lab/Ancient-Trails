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
        const timeout = setTimeout(() => { pending.delete(id); reject(Error(`Browser timed out: ${method}`)); }, 90000);
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

test("phone controls use readable text, large touch targets and full-width booking fields", { timeout: 240000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-phone-controls-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-phone-controls-")) {
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
  const visible = el => el.getBoundingClientRect().width>0 && el.getBoundingClientRect().height>0 && getComputedStyle(el).visibility!=='hidden';
  async function inspectControls(scope) {
    return evaluate(`(() => {
      const root=${scope},visible=${visible.toString()};
      const smallText=[...root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]),select,textarea,[role=combobox]')].filter(visible).filter(el=>parseFloat(getComputedStyle(el).fontSize)<16).map(el=>({label:el.getAttribute('aria-label')||el.placeholder,font:getComputedStyle(el).fontSize,role:el.getAttribute("role"),html:el.outerHTML.slice(0,700)}));
      const smallTargets=[...root.querySelectorAll('button,select,textarea,input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]),[role=button],[role=combobox]')].filter(visible).map(el=>({label:el.getAttribute('aria-label')||el.textContent.trim(),r:el.getBoundingClientRect()})).filter(item=>item.r.width<43.9||item.r.height<43.9).map(item=>({label:item.label,width:item.r.width,height:item.r.height}));
      const smallChoices=[...root.querySelectorAll('input[type=radio],input[type=checkbox]')].filter(visible).map(el=>({label:el.closest('label'),input:el})).filter(item=>!item.label||item.label.getBoundingClientRect().height<43.9||item.label.getBoundingClientRect().width<43.9).map(item=>item.input.outerHTML);
      return {smallText,smallTargets,smallChoices};
    })()`);
  }
  for (const width of [373,390]) {
    await client.send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:true});
    await navigateBookingTour(client,evaluate,waitFor,origin+"/tours/enigmatic-khajuraho");
    await waitFor("document.body?.innerText.includes('40,000')","tour");
    const header=await inspectControls("document.querySelector('header')");
    assert.deepEqual(header.smallTargets,[],JSON.stringify(header));
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Book Now').click()");
    await waitFor("Boolean(document.querySelector('[data-mobile-booking-bar]'))","phone booking");
    const auth=await inspectControls("document.querySelector('.booking-mobile-form')");
    assert.deepEqual(auth.smallText,[],JSON.stringify(auth));
    assert.deepEqual(auth.smallTargets,[],JSON.stringify(auth));
    await advanceBookingTo(evaluate,waitFor,1);
    const counts=await inspectControls("document.querySelector('.booking-mobile-form')");
    assert.deepEqual(counts.smallTargets,[],JSON.stringify(counts));
    await advanceBookingTo(evaluate,waitFor,3);
    const details=await inspectControls("document.querySelector('.booking-mobile-form')");
    assert.deepEqual(details.smallText,[],JSON.stringify(details));
    assert.deepEqual(details.smallTargets,[],JSON.stringify(details));
    assert.deepEqual(details.smallChoices,[],JSON.stringify(details));
    const widths=await evaluate(`['Lead Traveller first name','Lead Traveller last name','Lead Traveller email','Lead Traveller address','Booking emergency contact name','Booking emergency contact mobile number'].map(label=>({label,width:document.querySelector('[aria-label="'+label+'"]').getBoundingClientRect().width,viewport:innerWidth}))`);
    for(const item of widths) assert.ok(item.width>=item.viewport*.9,JSON.stringify(item));
    await evaluate("const button=document.querySelector('[aria-label=\"Lead Traveller date of birth\"]');button.scrollIntoView({block:'start',behavior:'instant'});button.click()");
    await waitFor("Boolean(document.querySelector('[data-booking-calendar]'))","calendar");
    const calendar=await inspectControls("document.querySelector('[data-booking-calendar]')");
    assert.deepEqual(calendar.smallText,[],JSON.stringify(calendar));
    assert.deepEqual(calendar.smallTargets,[],JSON.stringify(calendar));
    const bounds=await evaluate("({left:document.querySelector('[data-booking-calendar]').getBoundingClientRect().left,right:document.querySelector('[data-booking-calendar]').getBoundingClientRect().right,page:document.documentElement.scrollWidth,viewport:innerWidth})");
    assert.ok(bounds.left>=0&&bounds.right<=bounds.viewport+1,JSON.stringify(bounds));
    assert.ok(bounds.page<=bounds.viewport,JSON.stringify(bounds));
    t.diagnostic(`${width}px: text >=16px, button/choice hit areas >=44px, fields >=90% viewport, and calendar fits.`);
  }
  // The same mobile rules apply to the search overlay and filter drawer.
  await navigateBookingTour(client,evaluate,waitFor,origin+"/tours");
  await waitFor("document.body?.innerText.includes('Filter Tours')","tour listing");
  await waitFor("Object.keys(document.querySelector('button[aria-label=\"Search Ancient Trails\"]')||{}).some(key=>key.startsWith('__reactProps'))","hydrated header");
  await evaluate("document.querySelector('button[aria-label=\"Search Ancient Trails\"]').click()");
  await waitFor("Boolean(document.querySelector('input[placeholder=\"Search tours, destinations, experiences...\"]'))","search");
  assert.ok(await evaluate("parseFloat(getComputedStyle(document.querySelector('input[placeholder=\"Search tours, destinations, experiences...\"]')).fontSize)>=16"));
  await evaluate("document.querySelector('button[aria-label=\"Search Ancient Trails\"]').click()");
  await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Filter Tours')).click()");
  await waitFor("Boolean(document.querySelector('[data-slot=\"sheet-content\"]'))","filters");
  const filters=await inspectControls("document.querySelector('[data-slot=\"sheet-content\"]')");
  assert.deepEqual(filters.smallText,[],JSON.stringify(filters));
  assert.deepEqual(filters.smallTargets,[],JSON.stringify(filters));
  assert.deepEqual(filters.smallChoices,[],JSON.stringify(filters));
  await client.send("Emulation.setDeviceMetricsOverride",{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await navigateBookingTour(client,evaluate,waitFor,origin+"/tours/enigmatic-khajuraho");
  await waitFor("document.body?.innerText.includes('40,000')","desktop tour");
  await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Book Now').click()");
  await waitFor("Boolean(document.querySelector('[aria-label=\"Lead Traveller first name\"]'))","desktop details");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[aria-label=\"Lead Traveller first name\"]')).fontSize"),"14px","Desktop input typography is unchanged");
});
