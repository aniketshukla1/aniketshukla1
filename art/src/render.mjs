// Renders the header, project cards and link strips to WebP in both themes: serves the repo, opens each page in
// headless Chrome at twice its size, and takes a screenshot on a transparent background.
//
//   node art/src/render.mjs [names...]      (needs Node 22+, Chrome and Python 3 with Pillow)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { PROJECTS } from './projects.js';

const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = join(process.cwd(), decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!existsSync(path)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }).end(readFileSync(path));
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/art/src`;

const port = 9700 + Math.floor(Math.random() * 200);
const profile = join(tmpdir(), `profile-render-${port}`);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 75 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  if (!target) await sleep(200);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

const shoot = async (url, width, height, out) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url });
  for (let i = 0; i < 100; i++) {
    await sleep(60);
    const r = await send('Runtime.evaluate', { expression: 'window.__ready === true', returnByValue: true });
    if (r.result.result?.value) break;
    if (i === 99) throw new Error(`${url} never became ready`);
  }
  const problem = (await send('Runtime.evaluate', { expression: 'window.__problem || null', returnByValue: true })).result.result?.value;
  if (problem) throw new Error(`${url}: ${problem}`);
  await sleep(60);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const png = join(tmpdir(), `profile-${port}.png`);
  writeFileSync(png, Buffer.from(shot.result.data, 'base64'));
  const py = spawnSync('python3', ['-c', `
import sys
from PIL import Image
Image.open(sys.argv[1]).save(sys.argv[2], 'WEBP', quality=90, alpha_quality=100, method=6)`, png, out]);
  if (py.status !== 0) throw new Error(py.stderr.toString());
  rmSync(png);
};

const wanted = process.argv.slice(2);
const want = (n) => !wanted.length || wanted.includes(n);
mkdirSync('art/cards', { recursive: true });
mkdirSync('art/links', { recursive: true });
for (const theme of ['dark', 'light']) {
  if (want('header')) await shoot(`${base}/header.html?theme=${theme}`, 846, 300, `art/header-${theme}.webp`);
  for (const name of Object.keys(PROJECTS)) {
    if (!want(name)) continue;
    await shoot(`${base}/card.html?p=${name}&theme=${theme}`, 418, 332, `art/cards/${name}-${theme}.webp`);
    await shoot(`${base}/link.html?p=${name}&theme=${theme}`, 418, 40, `art/links/${name}-${theme}.webp`);
  }
}
ws.close();
chrome.kill();
server.close();
await sleep(200);
rmSync(profile, { recursive: true, force: true });
process.exit(0);
