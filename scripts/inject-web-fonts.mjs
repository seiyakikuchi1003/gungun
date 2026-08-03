#!/usr/bin/env node
// Web ビルド後に dist/index.html へ @font-face を注入する。
// Ionicons / MPLUSRounded 系フォントを HTML の head で先読みし、
// アイコンが「⊠」で表示される問題（JSでのFont.loadAsync遅延）を回避する。
//
// 使い方: `npx expo export --platform web && node scripts/inject-web-fonts.mjs`
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const HTML = `${DIST}/index.html`;

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.ttf')) out.push(p);
  }
  return out;
}

const fonts = new Map();
for (const abs of walk(`${DIST}/assets`)) {
  const rel = '/' + abs.slice(DIST.length + 1);
  const base = abs.split('/').pop().split('.')[0];
  fonts.set(base, rel);
}

const familyMap = {
  'MPLUSRounded1c-Regular': 'MPLUSRounded1c_400Regular',
  'MPLUSRounded1c-Medium':  'MPLUSRounded1c_500Medium',
  'MPLUSRounded1c-Bold':    'MPLUSRounded1c_700Bold',
  'MPLUSRounded1c-ExtraBold': 'MPLUSRounded1c_800ExtraBold',
};

const rules = [];
for (const [name, path] of fonts) {
  const family = familyMap[name] || name.toLowerCase();
  rules.push(`@font-face { font-family: "${family}"; src: url("${path}") format("truetype"); font-display: block; }`);
}

let html = readFileSync(HTML, 'utf8');
if (html.includes('prewire-fonts')) {
  console.log('font-face 注入済み。スキップ');
  process.exit(0);
}
const style = `<style id="prewire-fonts">${rules.join('\n')}</style>`;
html = html.replace('<style id="expo-reset">', `${style}\n    <style id="expo-reset">`);
writeFileSync(HTML, html);
console.log(`font-face を ${rules.length} 件注入しました`);
