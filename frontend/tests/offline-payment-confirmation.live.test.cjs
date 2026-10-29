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

test("offline booking requires confirmation and duplicate confirmation sends one request", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-offline-confirm-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-offline-confirm-")) {
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
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const originalFetch=window.fetch;
    window.__offlineRequests=[];
    window.fetch=async(...args)=>{
      if(String(args[0]).includes('/api/bookings/offline')) {
        window.__offlineRequests.push(JSON.parse(args[1].body));
        return new Promise(resolve=>{window.__finishOffline=()=>resolve(new Response(JSON.stringify({success:false,message:'Synthetic offline error'}),{status:400,headers:{'Content-Type':'application/json'}}));});
      }
      return originalFetch(...args);
    };
  })();` });
  for (const width of [390, 1280]) {
    await client.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await navigateBookingTour(client,evaluate,waitFor,origin + "/tours/enigmatic-khajuraho");
    await waitFor("document.body?.innerText.includes('40,000')","tour data");
    await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Book Now')?.click()");
    await waitFor("Boolean(document.querySelector('input[name=\"tour-accommodation\"]:checked'))","booking panel");
    if (width < 1024) await advanceBookingTo(evaluate,waitFor,3);
    for (const [label,value] of [["Lead Traveller address","Fixture street"],["Booking emergency contact name","Emergency Fixture"],["Booking emergency contact mobile number","8000000000"]]) {
      await evaluate(`(() => {
        const input=document.querySelector('[aria-label="${label}"]');
        Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
        input.dispatchEvent(new Event('input',{bubbles:true}));
      })()`);
    }
    await waitFor("!document.querySelector('[data-booking-terms]').disabled","complete booking details");
    if (width < 1024) await advanceBookingTo(evaluate,waitFor,4);
    await evaluate("document.querySelector('[data-booking-terms]').click()");
    await waitFor("document.querySelector('[data-booking-terms]').checked","accepted terms");
    const openMethods = async () => {
      await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Pay Now').click()");
      await waitFor("document.getElementById('payment-choice-title')?.textContent.trim()==='Choose Payment Method'","payment methods");
    };
    const chooseOffline = async () => {
      await evaluate("[...document.querySelectorAll('[aria-labelledby=\"payment-choice-title\"] button')].find(button=>button.textContent.includes('Offline Payment')).click()");
      await waitFor("document.getElementById('payment-choice-title')?.textContent.trim()==='Confirm Offline Payment'","offline confirmation");
    };
    await openMethods();
    await chooseOffline();
    assert.equal(await evaluate("window.__offlineRequests.length"),0,"Selecting Offline Payment sends no booking request");
    assert.equal(await evaluate("document.body.innerText.includes('Reserve without paying online? Our team will contact you.')"),true);
    assert.deepEqual(await evaluate("window.__blockedTestWrites"),[],"Selecting a payment method sends no API mutations");
    await evaluate("[...document.querySelectorAll('[aria-labelledby=\"payment-choice-title\"] button')].find(button=>button.textContent.trim()==='Cancel').click()");
    assert.equal(await evaluate("window.__offlineRequests.length"),0,"Cancel creates no booking");
    await openMethods();
    await chooseOffline();
    await evaluate("window.__confirmOfflineButton=[...document.querySelectorAll('[aria-labelledby=\"payment-choice-title\"] button')].find(button=>button.textContent.trim()==='Confirm Offline Request');window.__confirmOfflineButton.click();window.__confirmOfflineButton.click();window.__confirmOfflineButton.click()");
    await waitFor("window.__offlineRequests.length===1","one confirmed request");
    assert.equal(await evaluate("!window.__confirmOfflineButton.isConnected || window.__confirmOfflineButton.disabled"),true,"The submit control cannot be pressed again");
    await evaluate("window.__confirmOfflineButton.click()");
    await pause(100);
    assert.equal(await evaluate("window.__offlineRequests.length"),1,"Rapid or detached clicks cannot duplicate a submission");
    await evaluate("window.__finishOffline()");
    await waitFor("document.body.innerText.includes('Synthetic offline error')","a failed request reports the error");
    await openMethods();
    await chooseOffline();
    assert.equal(await evaluate("window.__offlineRequests.length"),1,"Retry also waits for explicit confirmation");
    await evaluate("[...document.querySelectorAll('[aria-labelledby=\"payment-choice-title\"] button')].find(button=>button.textContent.trim()==='Confirm Offline Request').click()");
    await waitFor("window.__offlineRequests.length===2","an explicit retry works after failure");
    await evaluate("window.__finishOffline()");
    await waitFor("document.body.innerText.includes('Synthetic offline error')","retry finishes without a real booking");
    t.diagnostic(`${width}px: selection and cancellation send zero requests; confirmation sends one, rapid repeats are ignored, and a failed request can be retried.`);
  }
});
