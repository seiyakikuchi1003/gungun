/**
 * Web版のアイコンが「□」になる問題を直す（2026-08-21）。
 *
 * expo export はアイコンフォントを dist/assets/node_modules/@expo/vector-icons/... に置くが、
 * wrangler pages deploy は node_modules という名前のディレクトリを問答無用で除外する。
 * 結果 .ttf が配信されず、SPA のフォールバック HTML が返り、
 * フォント読み込みが失敗して全アイコンが豆腐になっていた。
 *
 * ディレクトリ名から node_modules を消し、バンドル内の参照も書き換える。
 * export のたびに必要なので、export:web のあとに必ず通すこと。
 */
import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const FROM = 'assets/node_modules';
const TO = 'assets/vendor';

const src = join(DIST, FROM);
if (!existsSync(src)) {
  console.log('assets/node_modules がありません（すでに処理済みか、export していない）');
  process.exit(0);
}
renameSync(src, join(DIST, TO));

let touched = 0;
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html|json|map)$/.test(e.name)) {
      const s = readFileSync(p, 'utf8');
      if (s.includes(FROM)) {
        writeFileSync(p, s.split(FROM).join(TO));
        touched++;
      }
    }
  }
};
walk(DIST);
console.log(`assets/node_modules → assets/vendor に変更、参照を ${touched} ファイル書き換えました`);
