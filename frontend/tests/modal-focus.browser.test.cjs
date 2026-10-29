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

test("modal keyboard focus stays inside, blocks background interaction, and returns to each opener", { timeout: 120000 }, async t => {
  const candidates = [process.env.BROWSER_BIN,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, "Install Chrome/Chromium or set BROWSER_BIN to run this browser test.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ancient-trails-modal-focus-"));
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
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith("ancient-trails-modal-focus-")) {
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

  const ts = require('typescript');
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/modal-focus.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  await evaluate('document.body.innerHTML=' + JSON.stringify('<button id="enquiry">Enquire Now</button><button id="search">Search</button><button id="menu">Menu</button><button id="behind">Background</button><dialog id="popup" aria-label="Test popup"><input id="first" aria-label="Name"><button id="last">Close</button><button style="display:none">Hidden</button><button disabled>Disabled</button><div hidden><a href="#">Collapsed submenu</a></div></dialog>'));
  await evaluate('(() => { const exports={}; const require=()=>({}); ' + compiled + '; window.activateModal=exports.activateModal; })()');
  const key = async (name, modifiers = 0) => {
    const code = name === 'Tab' ? 9 : name === 'Enter' ? 13 : 27;
    await client.send('Input.dispatchKeyEvent', {type:'keyDown',key:name,code:name,windowsVirtualKeyCode:code,modifiers});
    await client.send('Input.dispatchKeyEvent', {type:'keyUp',key:name,code:name,windowsVirtualKeyCode:code,modifiers});
    await pause(50);
  };
  for (const opener of ['enquiry', 'search', 'menu']) {
    await evaluate('(() => { const trigger=document.getElementById(' + JSON.stringify(opener) + '); trigger.focus(); window.cleanup=window.activateModal(document.getElementById("popup"),()=>window.cleanup(),"#first",trigger); })()');
    assert.equal(await evaluate('document.activeElement.id'), 'first');
    assert.equal(await evaluate('document.body.style.overflow'), 'hidden');
    await evaluate('document.getElementById("behind").focus()');
    assert.equal(await evaluate('document.activeElement.id'), 'first', 'background is inert');
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.id'), 'last');
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.id'), 'first', 'Tab wraps inside the dialog');
    await key('Tab', 8);
    assert.equal(await evaluate('document.activeElement.id'), 'last', 'Shift+Tab wraps inside the dialog');
    await key('Escape');
    assert.equal(await evaluate('document.getElementById("popup").open'), false);
    assert.equal(await evaluate('document.activeElement.id'), opener, 'Escape returns to the correct opener');
    assert.equal(await evaluate('document.body.style.overflow'), '');
  }
  await evaluate('(() => { const trigger=document.getElementById("search"); trigger.focus(); window.cleanup=window.activateModal(document.getElementById("popup"),()=>window.cleanup(),"#first",trigger); document.getElementById("last").onclick=()=>window.cleanup(); document.getElementById("last").click(); })()');
  assert.equal(await evaluate('document.activeElement.id'), 'search', 'close button restores focus');
  await evaluate('(() => { const trigger=document.getElementById("menu"); trigger.focus(); window.cleanup=window.activateModal(document.getElementById("popup"),()=>window.cleanup(),"#first",trigger); const d=document.getElementById("popup"),r=d.getBoundingClientRect(); d.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:r.left-10,clientY:r.top-10})); })()');
  assert.equal(await evaluate('document.activeElement.id'), 'menu', 'backdrop restores focus');
  assert.equal(await evaluate('document.body.style.overflow'), '');
  await evaluate('(() => { const trigger=document.getElementById("menu"),d=document.getElementById("popup"); trigger.focus(); window.cleanup=window.activateModal(d,()=>window.cleanup(),"#first",trigger); window.cleanup(); window.cleanup=window.activateModal(d,()=>window.cleanup(),"#first",trigger); })()');
  await pause(100);
  assert.equal(await evaluate('document.getElementById("popup").open'), true, 'queued cleanup close events cannot close a reopened dialog');
  await key('Escape');
  assert.equal(await evaluate('document.activeElement.id'), 'menu');

  await t.test('header popovers leave sibling controls clickable and preserve outside focus', async () => {
    const popoverCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/header-popover.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    await evaluate('(() => { const exports={}; const require=()=>({}); ' + popoverCode + '; window.activateHeaderPopover=exports.activateHeaderPopover; })()');
    await evaluate('document.body.innerHTML=' + JSON.stringify('<header style="position:fixed;inset:0 0 auto;height:60px;transform:translateY(0)"><button id="menu">Menu</button><button id="search">Search</button></header><button id="behind" style="margin-top:160px">Page</button><dialog id="popup" style="position:fixed;left:20px;top:80px;margin:0"><input id="first"><button id="last">Close</button></dialog>'));
    const open = () => evaluate('(() => { const trigger=document.getElementById("menu"); trigger.focus(); window.cleanup=window.activateHeaderPopover(document.getElementById("popup"),()=>window.cleanup(),"#first",trigger); })()');
    await open();
    assert.equal(await evaluate('document.querySelector("dialog:modal")'), null);
    assert.equal(await evaluate('document.body.style.overflow'), '');
    assert.equal(await evaluate('document.activeElement.id'), 'first');
    await evaluate('window.searchClicks=0;document.getElementById("search").onclick=()=>window.searchClicks++');
    const point = await evaluate('(() => { const r=document.getElementById("search").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}; })()');
    assert.equal(await evaluate(`document.elementFromPoint(${point.x},${point.y}).id`), 'search');
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    assert.equal(await evaluate('window.searchClicks'), 1, 'the first click reaches the other header control');
    assert.equal(await evaluate('document.getElementById("popup").open'), false);
    assert.equal(await evaluate('document.activeElement.id'), 'search');
    await open();
    await key('Escape');
    assert.equal(await evaluate('document.getElementById("popup").open'), false);
    assert.equal(await evaluate('document.activeElement.id'), 'menu');
    await open();
    await evaluate('document.getElementById("behind").focus()');
    assert.equal(await evaluate('document.activeElement.id'), 'behind', 'nonmodal dropdowns do not trap page focus');
    await key('Escape');
    assert.equal(await evaluate('document.activeElement.id'), 'behind', 'closing does not steal focus from an outside control');
  });

  await t.test('skip link is visible on first Tab, precedes the header, and bypasses navigation', async () => {
    const css = fs.readFileSync(path.join(__dirname, '../app/globals.css'), 'utf8').split('@keyframes')[0].replace(/@import[^;]+;/g, '');
    const { frameTree } = await client.send('Page.getFrameTree');
    await client.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: '<!doctype html><html><head><style>' + css + '.test-reveal{opacity:0;filter:blur(1px)}</style></head><body><a href="#main-content" class="skip-link">Skip to main content</a><div id="site-header-slot"><header style="position:fixed;inset:0 0 auto;z-index:2147483647;height:72px;background:white"><button id="open-menu">Open menu</button><button inert>Hidden account action</button></header></div><main id="main-content" tabindex="-1" style="padding-top:100px"><a id="content-link" href="#tour">Browse tours</a><div data-reveal class="test-reveal"><a id="revealed-link" href="#destination">A destination</a></div></main></body></html>' });
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.className'), 'skip-link');
    assert.equal(await evaluate('(() => { const a=document.activeElement,r=a.getBoundingClientRect(); return r.top>=0 && document.elementFromPoint(r.left+10,r.top+10)===a; })()'), true, 'skip link is visible above the fixed header');
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.id'), 'open-menu', 'menu follows the skip link');
    await key('Tab', 8);
    await key('Enter');
    assert.equal(await evaluate('document.activeElement.id'), 'main-content', 'skip activation focuses main');
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.id'), 'content-link', 'next Tab reaches content instead of navigation');
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.id'), 'revealed-link');
    assert.equal(await evaluate('getComputedStyle(document.activeElement.parentElement).opacity'), '1', 'keyboard focus reveals animated content immediately');
  });
});
