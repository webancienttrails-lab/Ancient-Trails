const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const events = [];
  socket.onmessage = event => { const result = JSON.parse(event.data); if (result.method?.startsWith("Network.")) events.push(result); if (result.id) pending.get(result.id)?.(result); };
  return { events, close: () => socket.close(), send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => { pending.delete(requestId); reject(Error(`Browser timed out: ${method}`)); }, 30000);
      pending.set(requestId, result => { clearTimeout(timeout); pending.delete(requestId); result.error ? reject(Error(JSON.stringify(result.error))) : resolve(result.result); });
      socket.send(JSON.stringify({ id: requestId, method, params, ...(sessionId ? {sessionId} : {}) }));
    });
  } };
}

test('reference destination layout is responsive and attraction previews work', { timeout: 180000 }, async t => {
  const executable = [process.env.BROWSER_BIN, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].filter(Boolean).find(file => fs.existsSync(file));
  assert.ok(executable, 'A Chrome or Chromium browser is required for the visual check.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ancient-trails-destination-preview-'));
  const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let client, launchError;
  browser.on('error', error => { launchError = error; });
  browser.stderr.resume();
  t.after(async () => {
    if (client) { await client.send('Browser.close').catch(() => {}); client.close(); }
    for (let i = 0; i < 20 && browser.exitCode === null; i++) await pause(100);
    if (browser.exitCode === null) browser.kill();
    const resolved = path.resolve(profile);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('ancient-trails-destination-preview-')) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) { if (launchError) throw launchError; await pause(100); }
  assert.ok(fs.existsSync(portFile), 'Browser did not start.');
  const port = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  client = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  async function evaluate(expression) {
    const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function waitFor(expression, label) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) { const value = await evaluate(expression); if (value) return value; await pause(200); }
    assert.fail(`Timed out waiting for ${label}`);
  }
  await client.send('Page.enable');
  await client.send('Network.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      const method = (args[1]?.method || 'GET').toUpperCase();
      if (String(args[0]).includes('/api/') && method !== 'GET') return Promise.resolve(new Response(JSON.stringify({success:false,message:'Visual test writes blocked'}),{status:400,headers:{'Content-Type':'application/json'}}));
      return originalFetch(...args);
    };` });
  const origin = process.env.DESTINATION_TEST_SITE_URL || 'http://localhost:3001';
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url: `${origin}/destinations/hampi` });
  await waitFor("document.getElementById('destination-reference-title')?.textContent === 'Hampi'", 'destination page');
  await evaluate('document.fonts.ready');
  await waitFor("[...document.querySelectorAll('img[alt=\"Hampi heritage landscape\"]')].some(image=>image.complete&&image.naturalWidth>0)", 'hero image');
  await waitFor("![...document.querySelectorAll('[role=status]')].some(node=>node.textContent.includes('Loading Ancient Trails'))", 'finished page loader');
  const output = path.join(__dirname, '../.next/destination-review');
  fs.mkdirSync(output, { recursive: true });
  for (const width of [1920, 1440, 1024, 768, 390, 360]) {
    await client.send('Emulation.setDeviceMetricsOverride', { width, height: 1080, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate('window.scrollTo(0,0)'); await pause(180);
    const measured = await evaluate(`(() => {
      const hero=document.getElementById('destination-reference-title').closest('section');
      const page=hero.parentElement, overview=page.querySelector('section[aria-label^="Discover "]');
      return { viewport:innerWidth, pageWidth:document.documentElement.scrollWidth,
        bannerTop:hero.getBoundingClientRect().top+scrollY,
        galleryColumns:(()=>{const viewport=document.querySelector('[data-destination-gallery-viewport]');return Math.round(viewport.getBoundingClientRect().width/viewport.querySelector('[aria-roledescription=slide]').getBoundingClientRect().width);})(),
        galleryCustomise:document.querySelector('[aria-label="Destination photo gallery"] [data-slot="dialog-trigger"]')!==null,
        columns:getComputedStyle(overview).gridTemplateColumns.split(' ').length,
        aligned:(()=>{const target=document.getElementById('destination-tours').getBoundingClientRect();return [overview,page.querySelector('[class*=heroAlignedContent]'),page.querySelector('[class*=reachGrid]'),page.querySelector('[class*=experienceCtaInner]')].every(section=>{const bounds=section.getBoundingClientRect();return Math.abs(bounds.left-target.left)<1&&Math.abs(bounds.right-target.right)<1});})(),
        sections:['Key Attractions','Best Time to Visit','Things to Know','How to Reach','Experiences in Hampi'].every(text=>page.innerText.includes(text)),
        experienceHref:page.querySelector('[aria-label=\"Experiences in Hampi\"] a')?.getAttribute('href'),
        reordered:page.querySelector('[class*=reachBand]').compareDocumentPosition(page.querySelector('[aria-label="Experiences in Hampi"]')) & Node.DOCUMENT_POSITION_FOLLOWING,
        simplified:!page.innerText.includes('Quick Facts')&&!page.querySelector('h2')?.textContent.includes('Where Stone'),
        visibleCards:(()=>{const viewport=page.querySelector('[class*=attractionViewport]').getBoundingClientRect();return Math.round(viewport.width/page.querySelector('article').getBoundingClientRect().width);})(),
        map:page.querySelector('iframe')?.src, anchor:page.querySelector('a[href="#destination-tours"]')?.getAttribute('href'),
        rect:(()=>{const r=page.getBoundingClientRect();return{x:r.left,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})() };
    })()`);
    assert.ok(measured.pageWidth <= measured.viewport + 1, `${width}px: no page overflow (${measured.pageWidth})`);
    assert.equal(measured.sections, true);
    assert.ok(Math.abs(measured.bannerTop)<1, "Header overlays the banner without a separate top strip");
    assert.equal(measured.galleryColumns,width>=1024?5:width>=640?3:2);
    assert.equal(measured.galleryCustomise,false);
    assert.equal(measured.aligned,true, `${width}px: content edges align with Tours in Hampi`);
    assert.equal(measured.simplified,true);
    assert.ok(measured.reordered);
    assert.ok(measured.experienceHref?.startsWith('/experiences?destination='));
    assert.equal(measured.visibleCards,width>=900?3:width>=540?2:1);
    assert.equal(measured.columns, width >= 900 ? 2 : 1);
    assert.equal(measured.anchor, '#destination-tours');
    assert.match(measured.map, /maps\.google\.com/);
    if (width === 1920 || width === 390) {
      await client.send('Emulation.setDeviceMetricsOverride', {width,height:Math.ceil(measured.rect.y+measured.rect.height+10),deviceScaleFactor:1,mobile:width<600});
      await client.send('Page.bringToFront');
      await evaluate("document.querySelector('iframe[title=\"Hampi location map\"]')?.scrollIntoView({block:'center'})");
      await pause(4000);
      const targets = (await client.send('Target.getTargets')).targetInfos.filter(target=>target.type==='iframe'&&target.url.includes('google.com/maps/embed'));
      assert.ok(targets.some(target=>target.url.includes('google.com/maps/embed')), 'Google Maps frame loads');
      for (const target of targets) {
        const {sessionId}=await client.send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
        let frame;
        for(let attempt=0;attempt<30;attempt++) {
          frame=await client.send('Runtime.evaluate',{expression:'({text:document.body?.innerText,state:document.readyState})',returnByValue:true},sessionId);
          if(/Map data|Google/.test(frame.result.value?.text||'')) break;
          await pause(500);
        }
        assert.equal(frame.result.value.state,'complete');
        assert.match(frame.result.value.text,/Map data|Google/, 'Map attribution renders');
      }
      await evaluate('window.scrollTo(0,0)');
      await pause(400);
      const screenshot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: measured.rect });
      fs.writeFileSync(path.join(output, width === 1920 ? 'desktop.png' : 'mobile.png'), Buffer.from(screenshot.data, 'base64'));
    }
    t.diagnostic(`${width}px: reference sections present; responsive columns and no horizontal overflow.`);
  }
  await evaluate("document.querySelector('section[aria-label^=\"Discover \"] [data-slot=dialog-trigger]').click()");
  await waitFor("Boolean(document.querySelector('[role=dialog] input[name=destination]'))",'custom tour form');
  assert.equal(await evaluate("document.querySelector('[role=dialog] input[name=destination]').value"),'Hampi');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  await waitFor("!document.querySelector('[role=dialog]')",'closed custom tour form');
  assert.equal(await evaluate("document.querySelectorAll('[aria-label^=\"Show attraction \"]').length"),0,'slider pagination removed');
  const before=await evaluate("getComputedStyle(document.querySelector('[class*=attractionGrid]')).transform");
  await waitFor("getComputedStyle(document.querySelector('[class*=attractionGrid]')).transform!=="+JSON.stringify(before),'slider autoplay');
  await evaluate("document.querySelector('button[aria-label^=\"View \" ][class*=\"attractionPhoto\"]')?.click()");
  await waitFor("Boolean(document.querySelector('[role=dialog][aria-modal=true]'))", 'attraction preview');
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await waitFor("!document.querySelector('[role=dialog][aria-modal=true]')", 'closed attraction preview');
  await evaluate("document.querySelector('[aria-label=\"Destination photo gallery\"]').scrollIntoView({block:'center'})");
  await waitFor("!document.querySelector('[aria-label=\"Next gallery photos\"]').disabled",'gallery next arrow');
  const galleryTransform=await evaluate("getComputedStyle(document.querySelector('[data-destination-gallery-viewport] > div')).transform");
  await evaluate("document.querySelector('[aria-label=\"Next gallery photos\"]').click()");
  await waitFor("getComputedStyle(document.querySelector('[data-destination-gallery-viewport] > div')).transform!=="+JSON.stringify(galleryTransform),'next gallery slide');
  await pause(500);
  const nextTransform=await evaluate("getComputedStyle(document.querySelector('[data-destination-gallery-viewport] > div')).transform");
  await evaluate("document.querySelector('[aria-label=\"Previous gallery photos\"]').click()");
  await waitFor("getComputedStyle(document.querySelector('[data-destination-gallery-viewport] > div')).transform!=="+JSON.stringify(nextTransform),'previous gallery slide');
  await evaluate("document.querySelector('[aria-label=\"View Hampi photo 2\"]').click()");
  await waitFor("Boolean(document.querySelector('[role=dialog][aria-modal=true]'))",'gallery lightbox');
  await client.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await client.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  await waitFor("!document.querySelector('[role=dialog][aria-modal=true]')",'closed gallery lightbox');
  t.diagnostic(`Screenshots: ${output}`);
});
