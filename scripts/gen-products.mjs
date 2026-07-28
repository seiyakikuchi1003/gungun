import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets', 'products');
fs.mkdirSync(OUT, { recursive: true });

// 貼付写真の差し替え用スロット。実写真を同じファイル名で上書きすればそのまま反映される。
const products = [
  { file: 'books.jpg', label: '本のセット' },
  { file: 'airpods.jpg', label: 'AirPods Pro' },
  { file: 'controller.jpg', label: 'ワイヤレスコントローラー' },
  { file: 'iphone.jpg', label: 'iPhone 15' },
  { file: 'bag.jpg', label: 'ルイヴィトン バッグ' },
];

const mikan = `<svg width="120" height="120" viewBox="0 0 200 200" opacity="0.14">
  <path d="M104 62C112 30 150 12 178 18 182 46 168 82 132 86 116 88 106 78 104 62Z" fill="#82BF4B"/>
  <ellipse cx="98" cy="122" rx="94" ry="72" fill="#EF8E2A"/></svg>`;

const html = (label) => `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0}
  #c{width:800px;height:800px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;
     background:linear-gradient(135deg,#F1E6D2,#E7D8BE);
     font-family:"Hiragino Sans","Noto Sans JP",sans-serif;position:relative}
  .mark{position:absolute;top:60px;right:60px}
  .name{font-size:44px;font-weight:800;color:#4A4130}
  .cap{font-size:22px;color:#8A7C5E;font-weight:600}
  .pill{margin-top:8px;background:#2E9E5B;color:#fff;font-weight:700;font-size:20px;padding:10px 24px;border-radius:999px}
</style></head><body><div id="c">
  <div class="mark">${mikan}</div>
  <div class="name">${label}</div>
  <div class="cap">商品写真スロット</div>
  <div class="pill">ここに実写真を差し替え</div>
</div></body></html>`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});
for (const p of products) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html(p.label), { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT, p.file), type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 800, height: 800 } });
  await ctx.close();
  console.log('wrote', p.file);
}
await browser.close();
console.log('done');
