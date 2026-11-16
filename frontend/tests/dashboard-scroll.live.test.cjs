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

test("dashboard scrolling recovers after loading, drawer resize and notifications", { timeout: 120000 }, async t => {
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
  await client.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    localStorage.setItem('ancient_trails_session_id','scroll-test-session');
    localStorage.setItem('ancient_trails_user',JSON.stringify({id:'scroll-test-user',firstName:'Test',lastName:'Traveller',email:'test@example.com',mobileNumber:'9999999999',roles:['traveller'],status:'active',isMobileVerified:true}));
    const originalFetch=window.fetch;
    window.fetch=(...args)=>String(args[0]).includes('/api/')
      ? Promise.resolve(new Response(JSON.stringify({success:false,message:'Offline test fixture'}),{status:503,headers:{'Content-Type':'application/json'}}))
      : originalFetch(...args);
  `});
  await client.send('Emulation.setDeviceMetricsOverride',{width:390,height:800,deviceScaleFactor:1,mobile:true});
  await client.send('Page.navigate',{url:origin+'/me'});
  await waitFor(`Boolean(document.querySelector('button[aria-label="Open dashboard menu"]'))`,'dashboard');
  await waitFor(`!document.body.style.overflow && !document.documentElement.style.overflow`,'loaders release scrolling');
  await evaluate(`(()=>{const content=document.createElement('div');content.style.height='4000px';document.getElementById('main-content').append(content);})()`);
  async function assertScrolls(description) {
    await evaluate('window.scrollTo(0,0)');
    await pause(150);
    await client.send('Input.synthesizeScrollGesture',{x:180,y:500,yDistance:-350,gestureSourceType:'mouse'});
    assert.ok(await evaluate('window.scrollY>0'),description);
  }
  for(const width of [390,1440,390]) {
    await client.send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:width<600});
    await assertScrolls(width+'px: dashboard can scroll');
    if(width<600) {
      await evaluate(`document.querySelector('button[aria-label="Open dashboard menu"]').click()`);
      await waitFor(`document.body.style.overflow==='hidden'`,'drawer locks background');
      await evaluate(`document.querySelector('button[aria-label="Close dashboard menu"]').click()`);
      await waitFor(`!document.body.style.overflow`,'closing drawer releases scrolling');
      await assertScrolls('mobile dashboard scrolls after closing its menu');
      await evaluate(`document.querySelector('button[aria-label="Open dashboard menu"]').click()`);
      await waitFor(`document.body.style.overflow==='hidden'`,'reopened drawer locks background');
      await client.send('Emulation.setDeviceMetricsOverride',{width:1440,height:800,deviceScaleFactor:1,mobile:false});
      await waitFor(`!document.body.style.overflow`,'desktop breakpoint releases hidden drawer');
      await assertScrolls('desktop scrolls after resizing with the mobile menu open');
      await client.send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
    }
    await evaluate(`document.querySelector('button[aria-label^="Notifications,"]').click()`);
    await waitFor(`document.body.style.overflow==='hidden'`,'notification panel locks background');
    await evaluate(`document.querySelector('button[aria-label="Close notifications"]').click()`);
    await waitFor(`!document.body.style.overflow`,'closing notifications releases scrolling');
    await assertScrolls('dashboard scrolls after closing notifications');
  }
});
