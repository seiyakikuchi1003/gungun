import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '..', 'assets');

// アプリ内 Mikan.tsx と同一のベクター（提供画像の忠実再現）
const mikanSvg = (size, showFace = true) => `
<svg width="${size}" height="${size}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <path d="M104 62 C112 30 150 12 178 18 C182 46 168 82 132 86 C116 88 106 78 104 62 Z" fill="#82BF4B"/>
  <path d="M120 74 C132 58 150 44 166 38" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.9"/>
  <ellipse cx="98" cy="122" rx="94" ry="72" fill="#EF8E2A"/>
  ${showFace ? `
  <circle cx="72" cy="120" r="9" fill="#fff"/>
  <circle cx="112" cy="120" r="9" fill="#fff"/>
  <path d="M68 142 C78 158 104 158 114 142" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none"/>
  <circle cx="140" cy="132" r="4.5" fill="#fff"/>
  <circle cx="132" cy="146" r="4.5" fill="#fff"/>
  <circle cx="148" cy="148" r="4.5" fill="#fff"/>` : ''}
</svg>`;

const page = (bg, pad, transparent) => `<!doctype html><html><head><meta charset="utf8">
<style>html,body{margin:0;padding:0}#c{width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;
background:${transparent ? 'transparent' : bg}}</style></head>
<body><div id="c">${mikanSvg(1024 - pad * 2)}</div></body></html>`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=1'],
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
// マスコット素材（透過）：将来 Image で使う用
await shoot(page('transparent', 40, true), 'mikan.png', true);

await browser.close();
console.log('done');
