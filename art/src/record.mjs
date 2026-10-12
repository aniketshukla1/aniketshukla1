// Records a page scrolling through its sections, frame by frame on a virtual clock, so the
// video is smooth even where headless Chrome draws WebGL in software. requestAnimationFrame,
// performance.now, Date.now and every CSS animation follow the virtual clock; each frame
// advances it by 1/fps and takes a screenshot. Writes frame-00000.jpg ... and manifest.json
// ([file, seconds] per frame, then ["end", seconds]).
//
//   node tools/record.mjs <url> <outDir> [width=1440] [height=810] [scale=1.3333] [dark|light] [fps=30]
//
// Encode the frames with any encoder, for example:
//   ffmpeg -framerate 30 -i <outDir>/frame-%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 demo.mp4
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const [url, outDir, w = '1440', h = '810', scale = '1.3333', scheme = 'dark', fpsArg = '30'] = process.argv.slice(2);
if (!url || !outDir) {
  console.error('usage: node tools/record.mjs <url> <outDir> [width] [height] [scale] [dark|light] [fps]');
  process.exit(2);
}
const fps = Number(fpsArg);

// The tour: each stop is a selector (or "top"), an offset in px, how long the move there takes
// and how long to hold, in seconds. TOUR='[["top",0,0,2],["#next",0,1.4,1.5]]' replaces the default (Vesper's).
const TOUR = process.env.TOUR ? JSON.parse(process.env.TOUR) : [
  ['top', 110, 0, 2.4],
  ['#depart', 60, 1.5, 1.4],
  ['#route', 0, 1.4, 1.5],
  ['#cabin', 0, 1.3, 1.5],
  ['#pass', 0, 1.3, 1.3],
  ['#window', 0, 1.3, 1.3],
  ['#arrive', 0, 1.7, 1.3],
  ['#terminus', 0, 1.3, 1.6],
  ['#book', 0, 1.3, 2.0],
];
const PREROLL = Number(process.env.PREROLL) || 1.4; // seconds of virtual time before the first frame, so the scene has faded in
// ALPHA=1 records PNG frames on a transparent page background (for logos over any theme).
const ALPHA = process.env.ALPHA === '1';

const CLOCK = `(() => {
  let now = 0;
  let queue = [];
  let next = 0;
  const start = Date.now();
  performance.now = () => now;
  Date.now = () => start + now;
  window.requestAnimationFrame = (cb) => { queue.push([++next, cb]); return next; };
  window.cancelAnimationFrame = (n) => { queue = queue.filter(([k]) => k !== n); };
  window.__advance = (ms) => {
    now += ms;
    const run = queue;
    queue = [];
    for (const [, cb] of run) { try { cb(now); } catch (error) { console.error(error); } }
    for (const a of document.getAnimations()) {
      if (a.playState === 'running') a.pause();
      if (a.playState === 'paused') a.currentTime = (a.currentTime || 0) + ms;
    }
    return now;
  };
})();`;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const env = process.env;
  const known = {
    darwin: ['Google Chrome', 'Chromium', 'Microsoft Edge', 'Brave Browser'].map((app) => `/Applications/${app}.app/Contents/MacOS/${app}`),
    win32: [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean).flatMap((dir) => [
      join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(dir, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]),
  }[process.platform] || [];
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  const onPath = (env.PATH || '').split(delimiter).filter(Boolean).flatMap((dir) => names.map((n) => join(dir, n)));
  return [...known, ...onPath].find((p) => existsSync(p));
}

const chromePath = findChrome();
if (!chromePath) { console.error('No Chrome found; set CHROME_PATH.'); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const port = 9800 + Math.floor(Math.random() * 150);
const profile = join(tmpdir(), `murmuration-record-${port}`);
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  ...(process.env.EXTRA ? process.env.EXTRA.split(' ') : []), 'about:blank',
], { stdio: 'ignore' });
chrome.on('exit', () => rmSync(profile, { recursive: true, force: true }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets = [];
for (let i = 0; i < 75 && !targets.length; i++) {
  try { targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === 'page'); } catch { /* not up yet */ }
  if (!targets.length) await sleep(200);
}
if (!targets.length) { console.error('Chrome did not start'); chrome.kill(); process.exit(1); }
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const problems = [];
ws.addEventListener('message', (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') problems.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +scale, mobile: false });
if (ALPHA) await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
await send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK });
await send('Page.navigate', { url });
await sleep(2500); // fonts and scripts load in real time
await evaluate("document.documentElement.style.scrollBehavior = 'auto'; 1");
for (let t = 0; t < PREROLL * 1000; t += 1000 / fps) { await evaluate(`window.__advance(${1000 / fps})`); await sleep(5); }

// Resolve each stop to a scroll position, then lay out the moves and holds on a timeline.
const ys = [];
for (const [selector, offset] of TOUR) {
  const y = selector === 'top' ? 0 : await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? Math.round(el.getBoundingClientRect().top + scrollY) : 0; })()`);
  ys.push(Math.max(0, y + offset));
}
const segments = [];
let clock = 0;
TOUR.forEach(([, , move, hold], k) => {
  if (k > 0) { segments.push({ from: ys[k - 1], to: ys[k], start: clock, end: clock + move }); clock += move; }
  segments.push({ from: ys[k], to: ys[k], start: clock, end: clock + hold });
  clock += hold;
});
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const scrollAt = (t) => {
  const s = segments.find((seg) => t < seg.end) || segments[segments.length - 1];
  const k = Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start || 1)));
  return s.from + (s.to - s.from) * ease(k);
};

const total = Math.min(Math.round(clock * fps), Number(process.env.MAXFRAMES) || Infinity); // MAXFRAMES for a quick check
const manifest = [];
const started = Date.now();
for (let f = 0; f < total; f++) {
  const t = f / fps;
  await evaluate(`window.scrollTo(0, ${scrollAt(t).toFixed(1)}); window.__advance(${1000 / fps}); 1`);
  const shot = await send('Page.captureScreenshot', ALPHA ? { format: 'png' } : { format: 'jpeg', quality: 90 });
  const file = `frame-${String(f).padStart(5, '0')}.${ALPHA ? 'png' : 'jpg'}`;
  writeFileSync(join(outDir, file), Buffer.from(shot.result.data, 'base64'));
  manifest.push([file, +t.toFixed(4)]);
  if (f % 60 === 0) console.log(`frame ${f}/${total} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
manifest.push(['end', +(total / fps).toFixed(4)]);
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest));
console.log(`${total} frames, ${(total / fps).toFixed(1)} s of video`);
console.log(problems.length ? 'problems:\n' + [...new Set(problems)].join('\n') : 'no exceptions');
ws.close();
chrome.once('exit', () => process.exit(0));
chrome.kill();
setTimeout(() => process.exit(0), 3000).unref();
