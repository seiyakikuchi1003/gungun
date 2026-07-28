import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets', 'avatars');
fs.mkdirSync(OUT, { recursive: true });

// 各ユーザーのアバター（グラデ円＋イニシャル）。実写真に差し替え可。
const users = [
  { file: 'takusan.png', initial: 'た', c1: '#3FA96B', c2: '#2C8547' },
  { file: 'sakura.png', initial: 'さ', c1: '#F08AA6', c2: '#E0637F' },
  { file: 'yu.png', initial: 'ゆ', c1: '#5FA8DB', c2: '#3B7AB0' },
  { file: 'haru.png', initial: 'は', c1: '#4FC0B0', c2: '#2E9E8B' },
  { file: 'metan.png', initial: 'め', c1: '#F3A94E', c2: '#E8901C' },
  { file: 'kenta.png', initial: 'け', c1: '#A98AD6', c2: '#8A5AC2' },
];

const html = (u) => `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0}
  #c{width:256px;height:256px;display:flex;align-items:center;justify-content:center;
     background:linear-gradient(135deg,${u.c1},${u.c2});
     font-family:"Hiragino Sans","Noto Sans JP",sans-serif}
  span{font-size:120px;font-weight:800;color:#fff}
</style></head><body><div id="c"><span>${u.initial}</span></div></body></html>`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});
for (const u of users) {
  const ctx = await browser.newContext({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html(u), { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT, u.file), clip: { x: 0, y: 0, width: 256, height: 256 } });
  await ctx.close();
  console.log('wrote', u.file);
}
await browser.close();
console.log('done');
