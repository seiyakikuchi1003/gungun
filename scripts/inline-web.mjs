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
// ★重要：Artifact は非ルートのパス（/_f/xxxx/?...）で配信されるため、そのままだと
//   expo-router がルート解決できず「Unmatched Route」になる。バンドル実行前に
//   履歴をルート '/' に書き換えて回避する（全アセットは data URI 化済みなので安全）。
const html = `<style id="expo-reset">
  html, body { height: 100%; margin: 0; }
  body { overflow: hidden; background: #F7F1E0; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script>try { window.history.replaceState(null, '', '/'); } catch (e) {}</script>
<script>${js}</script>`;

fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + 'MB');

// ── Cloudflare Pages 用：単体で成立する完全なHTML ──────────────
// ★重要：viewport の meta が無いとスマホが幅980pxとして描画し、
//   レイアウトが崩れる（実際に一度やらかしている）。Artifact 用の断片は
//   配信側が head を付けてくれるが、Pages では自前で書く必要がある。
// ★ replaceState は入れない。_redirects で /login 等に直接来られるようにするため
//   （断片版と違い、ここでは URL がそのままルートとして正しい）。
const publicHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no" />
<meta name="theme-color" content="#F7F1E0" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="description" content="いらないものが、ほしいものに。わらしべ長者の物々交換アプリ「ぐんぐん」" />
<title>ぐんぐん</title>
<style id="expo-reset">
  html, body { height: 100%; margin: 0; }
  body { overflow: hidden; background: #F7F1E0; -webkit-text-size-adjust: 100%; }
  #root { display: flex; height: 100%; flex: 1; overflow: hidden; }

  /* PC で開いたときは、全幅に間延びさせずスマホ幅の枠に収める。
     アプリはスマホ前提のレイアウトなので、そのまま伸ばすと入力欄が
     画面いっぱいに広がって「壊れて見える」ため。 */
  @media (min-width: 620px) {
    body { background: #EFE7D4; display: flex; align-items: center; justify-content: center; }
    #root {
      /* expo-reset の flex:1 が width を上書きするので、伸縮を切ってから幅を指定する */
      flex: 0 0 auto;
      width: 420px;
      max-width: 100%;
      height: min(880px, 100vh);
      background: #F7F1E0;
      border-radius: 22px;
      box-shadow: 0 10px 40px rgba(60, 50, 30, .18);
      overflow: hidden;
    }
  }
</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;

const OUT_PUBLIC = path.join(__dirname, '..', 'gungun-preview-public.html');
fs.writeFileSync(OUT_PUBLIC, publicHtml);
console.log('wrote', OUT_PUBLIC, (fs.statSync(OUT_PUBLIC).size / 1024 / 1024).toFixed(2) + 'MB');
