/* eslint-disable @typescript-eslint/no-require-imports */
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

test("brand contrast and responsive pages", { timeout: 600000 }, async t => {
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
  const origin = process.env.TOUR_TEST_SITE_URL || "http://localhost:3001";
  await client.send("Page.enable");
  const report = [];
  const scan = () => {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
    const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
    const lum=c=>{const v=c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
    const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const failures=[],uncertain=[];let checked=0;
    for(const el of document.querySelectorAll('body *')){
      if(['SCRIPT','STYLE','NOSCRIPT','OPTION'].includes(el.tagName)||el.closest('nextjs-portal')||el.matches(':disabled')||el.closest('[disabled]'))continue;
      const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ')||(el.matches('input,textarea')?el.value||el.placeholder:'');
      if(!text||!el.getClientRects().length)continue;
      const style=getComputedStyle(el);if(style.visibility!=='visible')continue;
      let opacity=1,image=false,stack=[];
      for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);opacity*=Number(s.opacity);stack.unshift(rgba(s.backgroundColor));if(s.backgroundImage!=='none')image=true;if(stack[0][3]===1)break;}
      if(opacity<.99)continue;
      const bg=stack.reduce((b,a)=>over(a,b),[255,255,255,1]);
      const fg=over(rgba(el.matches('input,textarea')&&!el.value?getComputedStyle(el,'::placeholder').color:style.color),bg);
      const required=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.6667&&Number(style.fontWeight)>=700)?3:4.5;
      const item={tag:el.tagName,text:text.slice(0,90),color:style.color,bg:bg.slice(0,3).map(Math.round),ratio:+ratio(fg,bg).toFixed(3),required,classes:typeof el.className==='string'?el.className:''};
      if(image){uncertain.push(item);continue;}checked++;
      if(ratio(fg,bg)<required)failures.push(item);
    }
    return {checked,failures,uncertain,overflow:document.documentElement.scrollWidth>innerWidth+1};
  };
  for(const width of [1440,390]){
    await client.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    for(const route of ['/','/login','/contact','/tours','/tours/enigmatic-khajuraho','/destinations','/experiences','/experts','/specialised-tours','/about','/blog','/faq','/tour-calendar','/privacy-policy','/terms-and-conditions']){
      await client.send('Page.navigate',{url:origin+route});
      await waitFor("document.readyState==='complete' && Boolean(document.querySelector('main'))",route);
      await pause(1000);
      await evaluate("window.scrollTo(0,document.body.scrollHeight)");await pause(700);
      await evaluate("window.scrollTo(0,0)");await pause(700);
      const result=await evaluate('('+scan.toString()+')()');
      report.push({width,route,...result});
      t.diagnostic(width+' '+route+': '+result.checked+' checked, '+result.failures.length+' low contrast, '+result.uncertain.length+' image backgrounds');
    }
  }
  const output=process.env.BRAND_AUDIT_REPORT || path.join(os.tmpdir(),'ancient-trails-brand-contrast.json');
  fs.writeFileSync(output,JSON.stringify(report,null,2));t.diagnostic('Report: '+output);
  assert.equal(report.reduce((sum,r)=>sum+r.failures.length,0),0,'Known solid-background text pairs pass contrast; see report');
  assert.equal(report.filter(r=>r.overflow).length,0,'No horizontal overflow');
});

