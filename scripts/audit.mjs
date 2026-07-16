import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, '..', 'shots-audit');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(DIST, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(8099, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true,
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message));

const base = 'http://localhost:8099';

// ログインして auth 状態を作る
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
try { await page.getByText('ログイン', { exact: true }).click({ timeout: 4000 }); } catch {}
await page.waitForTimeout(1400);

const routes = [
  ['home', '/'],
  ['board', '/board'],
  ['harvest-tab', '/harvest'],
  ['premium', '/premium'],
  ['mypage', '/mypage'],
  ['search', '/search'],
  ['item-detail', '/item/switch'],
  ['item-root', '/item/root/switch'],
  ['plant-seed', '/plant/seed'],
  ['board-detail', '/board/p1'],
  ['board-new', '/board/new'],
  ['exchange-list', '/exchange'],
  ['exchange-chat', '/exchange/t1'],
  ['rating', '/exchange/t1/rating'],
  ['harvest-root', '/harvest/switch'],
  ['notifications', '/notifications'],
  ['fertilizer', '/fertilizer'],
  ['mypage-edit', '/mypage/edit'],
  ['mypage-account', '/mypage/account'],
  ['mypage-items', '/mypage/items'],
  ['mypage-posts', '/mypage/posts'],
  ['mypage-blocks', '/mypage/blocks'],
];

let n = 0;
for (const [name, route] of routes) {
  n++;
  const tag = String(n).padStart(2, '0') + '-' + name;
  try {
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1300);
    await page.screenshot({ path: path.join(OUT, tag + '.png') });
    console.log('shot', tag);
  } catch (e) {
    console.log('FAIL', tag, e.message);
  }
}

await browser.close();
server.close();
console.log('done');
