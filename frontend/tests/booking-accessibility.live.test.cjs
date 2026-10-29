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

test("booking announces every error and links to invalid fields across travellers and steps", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-booking-errors-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-booking-errors-")) {
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
  let activePort = "";
  for (let attempt = 0; attempt < 30; attempt++) {
    try { activePort = fs.readFileSync(portFile, "utf8").trim(); if (/^\d+/.test(activePort)) break; }
    catch (error) { if (!["EBUSY", "EACCES", "EPERM", "ENOENT"].includes(error.code)) throw error; }
    await pause(100);
  }
  assert.ok(activePort, "Chrome wrote its debugging port");
  const [port] = activePort.split(/\r?\n/);
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
  async function fill(label, value) {
    await evaluate(`(() => {
      const input=document.querySelector('[aria-label="${label}"]');
      Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
  }
  for (const width of [375, 1280]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await navigateBookingTour(client,evaluate,waitFor,origin+"/tours/enigmatic-khajuraho");
    await waitFor("document.body?.innerText.includes('40,000')","tour");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Book Now').click()");
    if (width < 1024) await advanceBookingTo(evaluate,waitFor,3);
    await waitFor("Boolean(document.querySelector('[aria-label=\"Lead Traveller first name\"]:not(:disabled)'))","editable details");
    assert.equal(await evaluate("document.querySelector('[data-booking-traveller-fields]').getAttribute('aria-disabled')"),"false");
    assert.equal(await evaluate("Boolean(document.querySelector('[data-booking-group-details-note]'))"),false,"A single traveller has no group-details reminder");
    await fill("Lead Traveller first name","   ");
    await fill("Lead Traveller last name","");
    await fill("Lead Traveller email","not-an-email");
    if (width < 1024) await evaluate("document.querySelector('[data-mobile-booking-bar] button').click()");
    else await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Pay Now').click()");
    await waitFor("document.activeElement===document.getElementById('booking-form-errors')","focused error summary");
    const errors=await evaluate(`(() => {
      const box=document.getElementById('booking-form-errors');
      return {role:box.getAttribute('role'),live:box.getAttribute('aria-live'),messages:[...box.querySelectorAll('li')].map(li=>li.textContent.trim()),links:[...box.querySelectorAll('a')].map(a=>a.getAttribute('href'))};
    })()`);
    assert.equal(errors.role,"alert");
    assert.equal(errors.live,"polite");
    assert.equal(errors.messages.length,7,JSON.stringify(errors));
    for (const term of ["first name","last name","valid email","address","emergency contact name","emergency contact number","Terms & Conditions"]) assert.ok(errors.messages.some(message=>message.includes(term)),term);
    assert.equal(new Set(errors.links).size,errors.links.length,"Each problem has its own field link");
    const metadata=await evaluate(`['first name','last name','email','address'].map(field=>{
      const input=document.querySelector('[aria-label="Lead Traveller '+field+'"]');
      return {field,id:input.id,required:input.required,autocomplete:input.autocomplete,invalid:input.getAttribute('aria-invalid'),description:input.getAttribute('aria-describedby'),message:document.getElementById(input.getAttribute('aria-describedby'))?.textContent};
    })`);
    for (const input of metadata) {
      assert.equal(input.required,true,input.field);
      assert.equal(input.invalid,"true",input.field);
      assert.ok(input.id && input.description && input.message,input.field+" has a real linked error");
    }
    assert.match(metadata[0].autocomplete,/given-name/);
    assert.match(metadata[1].autocomplete,/family-name/);
    assert.match(metadata[2].autocomplete,/email/);
    assert.match(metadata[3].autocomplete,/street-address/);
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Lead traveller mobile number\"]').required"),true);
    assert.match(await evaluate("document.querySelector('[aria-label=\"Lead traveller mobile number\"]').autocomplete"),/tel-national/);
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Lead Traveller date of birth\"]').getAttribute('aria-required')"),"true");
    const tree=await client.send("Accessibility.getFullAXTree");
    assert.ok(tree.nodes.some(node=>node.role?.value==='alert' && node.properties?.some(property=>property.name==='live' && property.value.value==='polite')),"The error summary is exposed as a live alert in the accessibility tree");
    await evaluate("document.querySelector('#booking-form-errors a[href=\"#booking-adult-1-email\"]').click()");
    await waitFor("document.activeElement?.id==='booking-adult-1-email'","error link focuses the actual email field");
    await fill("Lead Traveller email","fixed@example.test");
    await waitFor("document.querySelector('[aria-label=\"Lead Traveller email\"]').getAttribute('aria-invalid')==='false'","corrected field clears its invalid state");
    assert.equal(await evaluate("Boolean(document.getElementById('booking-adult-1-email-error'))"),false);
    assert.deepEqual(await evaluate("window.__blockedTestWrites"),[],"Invalid form sends no booking or payment request");
    t.diagnostic(`${width}px: seven errors shown together, live alert exposed, required/autocomplete present, and corrected errors clear.`);
  }
  // An error for another traveller must open that traveller's panel before focusing.
  await navigateBookingTour(client,evaluate,waitFor,origin+"/tours/enigmatic-khajuraho");
  await waitFor("document.body?.innerText.includes('40,000')","fresh desktop tour");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Book Now').click()");
  await waitFor("Boolean(document.querySelector('button[aria-label=\"Increase Adult count\"]'))","counter");
  await evaluate("document.querySelector('button[aria-label=\"Increase Adult count\"]').click()");
  await waitFor("Boolean(document.getElementById('traveller-tab-adult-2'))","second traveller");
  assert.equal(await evaluate("document.querySelector('[data-booking-group-details-note]').textContent.trim()"),"Complete each traveller's details before payment.");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Pay Now').click()");
  await waitFor("Boolean(document.querySelector('#booking-form-errors a[href=\"#booking-adult-2-first-name\"]'))","all travellers are validated");
  await evaluate("document.querySelector('#booking-form-errors a[href=\"#booking-adult-2-first-name\"]').click()");
  await waitFor("document.activeElement?.id==='booking-adult-2-first-name'","link opens the second traveller's field");
  assert.equal(await evaluate("document.getElementById('traveller-tab-adult-2').getAttribute('aria-selected')"),"true");
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-invalid')"),"true");
  await evaluate("document.querySelector('button[aria-label=\"Decrease Adult count\"]').click()");
  await waitFor("!document.querySelector('[data-booking-group-details-note]')","group reminder removed when returning to one traveller");
  // A guest sees an explicit, accessible locked state; restoring a verified
  // fixture session unlocks the same controls without an OTP or API write.
  await evaluate("window.__savedBookingSession=[localStorage.getItem('ancient_trails_token'),localStorage.getItem('ancient_trails_user')];localStorage.removeItem('ancient_trails_token');localStorage.removeItem('ancient_trails_user');window.dispatchEvent(new Event('ancient-trails-session-change'))");
  await waitFor("Boolean(document.getElementById('booking-traveller-lock-hint'))","verification lock explanation");
  const locked=await evaluate(`(() => {
    const fields=document.querySelector('[data-booking-traveller-fields]'),hint=document.getElementById('booking-traveller-lock-hint');
    const input=fields.querySelector('input'),emergency=document.querySelector('[data-booking-emergency]');
    return {disabled:fields.disabled,aria:fields.getAttribute('aria-disabled'),description:fields.getAttribute('aria-describedby'),hint:hint.textContent,icon:Boolean(hint.querySelector('svg')),inputDisabled:input.matches(':disabled'),background:getComputedStyle(input).backgroundColor,emergencyBackground:getComputedStyle(emergency.querySelector('input')).backgroundColor,emergencyDisabled:emergency.disabled,emergencyAria:emergency.getAttribute('aria-disabled'),emergencyDescription:emergency.getAttribute('aria-describedby')};
  })()`);
  assert.equal(locked.disabled,true);
  assert.equal(locked.inputDisabled,true);
  assert.equal(locked.aria,"true");
  assert.equal(locked.description,"booking-traveller-lock-hint");
  assert.match(locked.hint,/locked.*Verify the lead traveller mobile number/);
  assert.equal(locked.icon,true);
  assert.notEqual(locked.background,"rgb(255, 255, 255)","Locked inputs have a shaded background");
  assert.equal(locked.emergencyBackground,locked.background);
  assert.equal(locked.emergencyDisabled,true);
  assert.equal(locked.emergencyAria,"true");
  assert.equal(locked.emergencyDescription,locked.description);
  await evaluate("localStorage.setItem('ancient_trails_token',window.__savedBookingSession[0]);localStorage.setItem('ancient_trails_user',window.__savedBookingSession[1]);window.dispatchEvent(new Event('ancient-trails-session-change'))");
  await waitFor("!document.getElementById('booking-traveller-lock-hint') && !document.querySelector('[data-booking-traveller-fields]').disabled","verified session unlocks details");
  assert.equal(await evaluate("document.querySelector('[data-booking-traveller-fields]').getAttribute('aria-describedby')"),null);
  assert.equal(await evaluate("document.querySelector('[data-booking-emergency]').disabled"),false);
  assert.deepEqual(await evaluate("window.__blockedTestWrites"),[]);
  t.diagnostic("Single/group copy updates with traveller count; guest fields show grey styling, lock icon and linked aria-disabled state; verified sessions unlock them.");
});
