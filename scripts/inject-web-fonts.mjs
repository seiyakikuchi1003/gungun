#!/usr/bin/env node
/**
 * Web ビルド後の dist を Cloudflare Pages で配信できる形に直す。
 *
 * ■ 直している問題
 * @expo/vector-icons の Ionicons.ttf は書き出し後も
 *   dist/assets/node_modules/@expo/vector-icons/.../Ionicons.<hash>.ttf
 * という **node_modules を含むパス**に置かれる。
 * Cloudflare Pages はアップロード時に node_modules 配下を除外するため、
 * このファイルだけ 404 になり、アイコンが全部「⊠」で表示される。
 * （日本語フォントは assets/assets/fonts/ 配下なので影響なし）
 *
 * ■ 対処（二重の保険）
 *  1. node_modules 配下のフォントを dist/fonts/ にコピーし、
 *     JS バンドル内のパス参照も書き換える → 実ファイルとして配信される
 *  2. さらに全フォントの @font-face を index.html の head に注入し、
 *     アイコンフォントだけは base64 で直接埋め込む
 *     → CDN の挙動に関係なく初回描画からアイコンが出る
 *
 * 使い方:
 *   npx expo export --platform web
 *   node scripts/inject-web-fonts.mjs            # 出力先を変えたときは第1引数で指定
 *   npx wrangler pages deploy dist --project-name=... --branch=...
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';

// 出力先はコマンドライン引数で切り替えられる（既定は dist）
//   node scripts/inject-web-fonts.mjs dist-live
const DIST = process.argv[2] ?? 'dist';
const HTML = `${DIST}/index.html`;
const SAFE_DIR = `${DIST}/fonts`;

function walk(dir, out = [], filter = () => true) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out, filter);
    else if (filter(p)) out.push(p);
  }
  return out;
}

/** ファイル名 → コード側で使っている font-family 名 */
const FAMILY = {
  'MPLUSRounded1c-Regular': 'MPLUSRounded1c_400Regular',
  'MPLUSRounded1c-Medium': 'MPLUSRounded1c_500Medium',
  'MPLUSRounded1c-Bold': 'MPLUSRounded1c_700Bold',
  'MPLUSRounded1c-ExtraBold': 'MPLUSRounded1c_800ExtraBold',
};

// ── 1. node_modules 配下のフォントを安全なパスへ逃がす ──────────────
mkdirSync(SAFE_DIR, { recursive: true });
const relocated = new Map(); // 旧URL → 新URL

for (const abs of walk(`${DIST}/assets`, [], (p) => p.endsWith('.ttf'))) {
  if (!abs.includes('node_modules')) continue;
  const name = basename(abs);
  copyFileSync(abs, join(SAFE_DIR, name));
  relocated.set('/' + abs.slice(DIST.length + 1), `/fonts/${name}`);
}

// JS バンドル内の参照も新しいパスに置き換える
if (relocated.size > 0) {
  for (const js of walk(`${DIST}/_expo`, [], (p) => p.endsWith('.js'))) {
    let src = readFileSync(js, 'utf8');
    let changed = false;
    for (const [oldUrl, newUrl] of relocated) {
      if (src.includes(oldUrl)) {
        src = src.split(oldUrl).join(newUrl);
        changed = true;
      }
    }
    if (changed) writeFileSync(js, src);
  }
}

// ── 2. @font-face を head に注入（アイコンフォントは base64 埋め込み）──
const rules = [];
let inlined = 0;

for (const abs of walk(`${DIST}/assets`, [], (p) => p.endsWith('.ttf'))) {
  const base = basename(abs).split('.')[0];
  const family = FAMILY[base] ?? base.toLowerCase();

  if (abs.includes('node_modules')) {
    const b64 = readFileSync(abs).toString('base64');
    rules.push(
      `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${b64}) format("truetype");font-display:block;}`
    );
    inlined++;
  } else {
    const url = '/' + abs.slice(DIST.length + 1);
    rules.push(
      `@font-face{font-family:"${family}";src:url("${url}") format("truetype");font-display:block;}`
    );
  }
}

let html = readFileSync(HTML, 'utf8');
// 既存の注入は入れ替える（再実行しても二重にならない）
html = html.replace(/\s*<style id="prewire-fonts">[\s\S]*?<\/style>/, '');

const style = `<style id="prewire-fonts">${rules.join('')}</style>`;
html = html.replace('<style id="expo-reset">', `${style}\n    <style id="expo-reset">`);
writeFileSync(HTML, html);

console.log(
  `フォント ${relocated.size} 件を /fonts/ へ再配置、@font-face ${rules.length} 件を注入（うち ${inlined} 件は base64）`
);
