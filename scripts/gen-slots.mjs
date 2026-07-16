import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets', 'products');

// まだ実写真がない商品の受け皿（ブランド地＋みかん透かし＋商品名）。実写真で上書き可。
const slots = [
  { file: 'wallet.jpg', label: 'ブランド財布' },
  { file: 'watch.jpg', label: '腕時計' },
  { file: 'perfume.jpg', label: '香水' },
  { file: 'sneaker.jpg', label: 'スニーカー' },
  { file: 'coffee.jpg', label: 'コーヒーメーカー' },
  { file: 'camera.jpg', label: 'ミラーレスカメラ' },
  { file: 'speaker.jpg', label: 'ワイヤレススピーカー' },
  { file: 'giftcard.jpg', label: 'ギフト券' },
];

const mikan = `<svg width="120" height="120" viewBox="0 0 200 200" opacity="0.16">
  <path d="M104 62C112 30 150 12 178 18 182 46 168 82 132 86 116 88 106 78 104 62Z" fill="#82BF4B"/>
  <ellipse cx="98" cy="122" rx="94" ry="72" fill="#EF8E2A"/></svg>`;

const html = (label) => `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0}
  #c{width:800px;height:800px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
     background:linear-gradient(135deg,#FBEBD3,#F1E1C6);position:relative;
     font-family:"Hiragino Sans","Noto Sans JP",sans-serif}
  .m{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center}
  .name{font-size:40px;font-weight:800;color:#8A7C5E;z-index:1}
  .cap{font-size:20px;font-weight:600;color:#B0A184;z-index:1}
</style></head><body><div id="c">
  <div class="m">${mikan}</div>
  <div class="name">${label}</div>
  <div class="cap">写真をここに差し替え</div>
</div></body></html>`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});
for (const s of slots) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html(s.label), { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT, s.file), type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 800, height: 800 } });
  await ctx.close();
  console.log('wrote', s.file);
}
await browser.close();
console.log('done');
