import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = path.join(ASSETS, 'brand', 'mikan.png');

// ★元画像は assets/brand/mikan.png。これを差し替えるとアイコン一式が実画像ベースになる。
const dataUri = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');

// mikan を中央に、指定padの余白＋任意の背景色で 1024x1024 に配置
const page = (bg, pad, transparent) => `<!doctype html><html><head><meta charset="utf8">
<style>html,body{margin:0}
#c{width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;background:${transparent ? 'transparent' : bg}}
img{width:${1024 - pad * 2}px;height:${1024 - pad * 2}px;object-fit:contain}
</style></head><body><div id="c"><img src="${dataUri}"/></div></body></html>`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});

async function shoot(htmlContent, outName, transparent) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(htmlContent, { waitUntil: 'networkidle' });
  await p.screenshot({ path: path.join(ASSETS, outName), omitBackground: transparent, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  await ctx.close();
  console.log('wrote', outName);
}

// アプリアイコン：クリーム地・不透明（iOS はアイコンに透過不可）
await shoot(page('#F7F1E0', 150, false), 'icon.png', false);
// スプラッシュ：透過・余白多め
await shoot(page('transparent', 300, true), 'splash-icon.png', true);
// ファビコン（web）：透過
await shoot(page('transparent', 120, true), 'favicon.png', true);

await browser.close();
console.log('done — 元画像: assets/brand/mikan.png');
