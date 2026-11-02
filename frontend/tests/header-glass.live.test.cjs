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

test("header glass follows page scrolling on desktop and mobile", { timeout: 120000 }, async t => {
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
  for(const route of ['/','/tours','/destinations']) {
  for(const width of [1440,390]) {
    await client.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await client.send('Page.navigate',{url:origin+route});
    await waitFor('Boolean(document.querySelector("#site-header-slot header"))','mounted header');
    await pause(1500);
    const inspect='(()=>{const el=document.querySelector("#site-header-slot header"),s=getComputedStyle(el);return{bg:s.backgroundColor,blur:s.backdropFilter,top:el.getBoundingClientRect().top,opacity:s.opacity};})()';
    async function checkGlass(message) {
      await pause(500);
      const result=await evaluate(inspect);
      assert.match(result.blur,/blur\(24px\)/,message);
      assert.match(result.bg,/0\.78/,message);
      assert.ok(result.top>=0,message+' is visible');
      assert.equal(result.opacity,'1');
    }
    await evaluate('window.scrollTo(0,0)');await pause(500);
    assert.equal((await evaluate(inspect)).blur,'none');
    await evaluate('window.scrollTo(0,350)');await pause(500);
    await checkGlass('scrolling down');
    await evaluate('window.scrollTo(0,300)');
    await checkGlass('window scroll');
    await evaluate('window.scrollTo(0,0)');await pause(500);
    assert.equal((await evaluate(inspect)).blur,'none');
    await evaluate('(()=>{const main=document.getElementById("main-content"),host=document.createElement("div");host.id="test-page-scroller";host.style.cssText="height:100vh;overflow-y:auto";main.parentNode.insertBefore(host,main);host.append(main);const filler=document.createElement("div");filler.style.height="1500px";main.append(filler);})()');
    await evaluate('document.getElementById("test-page-scroller").scrollTop=350');await pause(500);
    await checkGlass('page container scrolling down');
    await evaluate('document.getElementById("test-page-scroller").scrollTop=300');
    await checkGlass('page container scroll');
    assert.equal(await evaluate('window.scrollY'),0,'container scroll is independent of window');
    await evaluate('document.getElementById("test-page-scroller").scrollTop=0');await pause(500);
    assert.equal((await evaluate(inspect)).blur,'none');
    await evaluate('(()=>{const pane=document.createElement("div");pane.id="test-inner-pane";pane.style.cssText="height:50px;overflow:auto";pane.innerHTML="<div style=height:500px>Dropdown content</div>";document.getElementById("main-content").prepend(pane);pane.scrollTop=100;})()');await pause(500);
    assert.equal((await evaluate(inspect)).blur,'none','inner panels do not change page scroll state');
    t.diagnostic(route+' '+width+'px: window and page container scrolling activate glass; returning to top clears it; inner panels are ignored.');
  }
  }
});
