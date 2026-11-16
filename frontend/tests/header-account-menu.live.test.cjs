/* eslint-disable @typescript-eslint/no-require-imports -- This browser test runs directly in Node as CommonJS. */
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
          if (message.error) reject(Error(JSON.stringify(message.error)));
          else resolve(message.result);
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

test("desktop account icon opens the signed-in profile popup", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-mobile-search-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-mobile-search-")) {
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
  await client.send('Page.enable');
  const origin=process.env.TOUR_TEST_SITE_URL || 'http://localhost:3001';
  await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await client.send('Page.navigate',{url:origin});
  await waitFor('Boolean(document.querySelector("#site-header-slot header a[aria-label=Login]"))','logged-out header');
  assert.equal(await evaluate('document.querySelector("#traveller-account-menu")'),null);
  assert.match(await evaluate('document.querySelector("header a[aria-label=Login]").getAttribute("href")'),/^\/login/);
  await evaluate(`(() => {
    localStorage.setItem('ancient_trails_session_id','header-test-session');
    localStorage.setItem('ancient_trails_user',JSON.stringify({id:'header-test-user',firstName:'Test',lastName:'Traveller',email:'test@example.com',mobileNumber:'9999999999',roles:['traveller'],status:'active',isMobileVerified:true}));
    window.dispatchEvent(new Event('ancient-trails-session-change'));
  })()`);
  await waitFor(`Boolean(document.querySelector('header button[aria-label="Account menu"]'))`,'signed-in account icon');
  async function clickAccount() {
    const rect = await evaluate(`(()=>{const r=document.querySelector('header button[aria-label="Account menu"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await client.send('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',clickCount:1});
    await client.send('Input.dispatchMouseEvent',{type:'mouseReleased',...rect,button:'left',clickCount:1});
    await pause(400);
  }
  await clickAccount();
  assert.equal(await evaluate('document.querySelector("#traveller-account-menu").getAttribute("aria-hidden")'),'false','click opens profile popup');
  assert.equal(await evaluate('location.pathname'),'/','opening popup keeps the current page');
  assert.match(await evaluate('document.querySelector("#traveller-account-menu").innerText'),/Hello, Test Traveller/);
  const menu = await evaluate(`(() => {
    const el=document.querySelector('#traveller-account-menu'),r=el.getBoundingClientRect();
    const hit=document.elementFromPoint(r.x+r.width/2,r.y+40);
    return {height:r.height,visible:el.contains(hit),links:[...el.querySelectorAll('a')].map(a=>a.getAttribute('href'))};
  })()`);
  assert.ok(menu.height>100);
  assert.ok(menu.visible,'profile popup is visible above the page');
  assert.deepEqual(menu.links,['/me/wishlist','/me/account','/me/bookings']);
  await clickAccount();
  assert.equal(await evaluate('document.querySelector("#traveller-account-menu").getAttribute("aria-hidden")'),'true','second click closes popup');
  await clickAccount();
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  await pause(100);
  assert.equal(await evaluate('document.querySelector("#traveller-account-menu").getAttribute("aria-hidden")'),'true','Escape closes popup');
});

