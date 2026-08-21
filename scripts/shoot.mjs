import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { browserPath } from './lib/browser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(DIST, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // SPA fallback
    file = path.join(DIST, 'index.html');
  }
  const ext = path.extname(file);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

await new Promise((r) => server.listen(8099, r));
console.log('serving dist on :8099');

const browser = await chromium.launch({
  executablePath: browserPath(),
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
// iPhone 13/14 サイズ相当
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message));

const base = 'http://localhost:8099';
const shot = async (name) => {
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
};

// 1) ログイン（初期表示）
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await shot('01-login');

// 2) 新規登録
await page.goto(base + '/signup', { waitUntil: 'networkidle' });
await shot('02-signup');

// 3) ログイン → ホーム
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
try {
  await page.getByText('ログイン', { exact: true }).click({ timeout: 4000 });
} catch (e) { console.log('login click failed', e.message); }
await page.waitForTimeout(1600);
await shot('03-home');

// 4) タネを植える
await page.goto(base + '/plant/seed', { waitUntil: 'networkidle' });
await shot('04-plant-seed');

// 5) 商品詳細
await page.goto(base + '/item/switch', { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await shot('05-item-detail');

// 6) 水やり確認モーダル
try {
  await page.getByText('この商品に水やりする').click({ timeout: 4000 });
  await page.waitForTimeout(900);
  await shot('06-water-confirm');
} catch (e) { console.log('water click failed', e.message); }

await browser.close();
server.close();
console.log('done');
