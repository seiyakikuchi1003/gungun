import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, '..', 'gungun-preview.html');

const MIME = { '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };

// JSバンドルを取得
const jsFile = fs.readdirSync(path.join(DIST, '_expo/static/js/web')).find((f) => f.endsWith('.js'));
let js = fs.readFileSync(path.join(DIST, '_expo/static/js/web', jsFile), 'utf8');

// バンドル内の /assets/... 参照をすべて data URI に置換（ネットワーク不要にする）
const refs = [...new Set(js.match(/\/assets\/[a-zA-Z0-9@._/-]*\.(ttf|png|ico|jpg)/g) || [])];
let inlined = 0;
for (const ref of refs) {
  const file = path.join(DIST, ref.replace(/^\/assets\//, 'assets/'));
  if (!fs.existsSync(file)) continue;
  const ext = path.extname(file);
  const dataUri = `data:${MIME[ext] || 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`;
  js = js.split(ref).join(dataUri);
  inlined++;
}
console.log(`inlined ${inlined}/${refs.length} assets into bundle`);

// Artifact 用：doctype/html/head/body は付けず、body内容として style + #root + inline script を書く
const html = `<style id="expo-reset">
  html, body { height: 100%; margin: 0; }
  body { overflow: hidden; background: #F7F1E0; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script>${js}</script>`;

fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + 'MB');
