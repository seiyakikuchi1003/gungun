import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, '..', 'docs', 'design-preview');
const OUT = path.join(__dirname, '..', 'scratch-gallery.html');

const enc = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64');

const screens = [
  { f: '01-login.png', title: 'ログイン', note: 'メール＋パスワード。ロゴ・マスコット・下部の葉の装飾まで再現', src: '画像②' },
  { f: '02-signup.png', title: '新規登録', note: 'ニックネーム／メール／パスワード＋規約同意', src: '画像③' },
  { f: '03-home.png', title: 'ホーム', note: '肥料残高・みんなの種・楽しみ方3ステップ・5タブ（中央みかん）', src: 'existing-01' },
  { f: '04-plant-seed.png', title: 'タネを植える', note: '写真追加・商品名・説明・カテゴリー・状態', src: '画像④' },
  { f: '05-item-detail.png', title: '商品詳細', note: '画像カルーセル・出品者・元の種（木全体の件数）', src: '画像⑤' },
  { f: '06-water-confirm.png', title: '水やり確認', note: 'じょうろマスコット・肥料計算・水やりする', src: '画像⑤' },
];

const cards = screens.map((s, i) => `
      <figure class="device" style="--i:${i}">
        <div class="screen"><img src="${enc(s.f)}" alt="${s.title} の画面" loading="lazy" /></div>
        <figcaption>
          <div class="cap-head"><h3>${s.title}</h3><span class="src">${s.src}</span></div>
          <p>${s.note}</p>
        </figcaption>
      </figure>`).join('');

const html = `<main>
  <header class="masthead">
    <div class="brand">
      <span class="logo">ぐんぐん</span>
      <span class="sprout" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="30" height="30"><path d="M32 54c0-10 0-20 0-28" stroke="#82BF4B" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M32 32C22 32 12 26 8 16 20 12 31 18 33 30Z" fill="#82BF4B"/><path d="M32 30c10-2 20-10 23-20-12-2-22 5-23 18Z" fill="#82BF4B"/></svg>
      </span>
      <span class="mikan" aria-hidden="true">
        <svg viewBox="0 0 200 200" width="34" height="34"><path d="M104 62C112 30 150 12 178 18 182 46 168 82 132 86 116 88 106 78 104 62Z" fill="#82BF4B"/><ellipse cx="98" cy="122" rx="94" ry="72" fill="#EF8E2A"/><circle cx="72" cy="120" r="9" fill="#fff"/><circle cx="112" cy="120" r="9" fill="#fff"/><path d="M68 142c10 16 36 16 46 0" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none"/></svg>
      </span>
    </div>
    <p class="tagline">いらないものが、ほしいものに。</p>
    <h1>デザイン方向性レビュー — UIモック</h1>
    <p class="lede">提供されたモック画像を <strong>Expo / React Native</strong> のネイティブ構成で再現しました。バックエンドは未接続（ダミーデータ）で、まずは<strong>見た目と動きの方向性を確認</strong>いただくためのモックです。</p>
    <div class="tokens" role="list" aria-label="デザイントークン">
      <span role="listitem"><i style="background:#F7F1E0;border-color:#e6ddc7"></i>背景 クリーム</span>
      <span role="listitem"><i style="background:#2E9E5B"></i>メイン グリーン</span>
      <span role="listitem"><i style="background:#F5A623"></i>アクセント オレンジ</span>
      <span role="listitem"><i style="background:#EF8E2A"></i>マスコット みかん</span>
    </div>
  </header>

  <section class="gallery">${cards}
  </section>

  <section class="notes">
    <h2>実装メモ（要件との対応）</h2>
    <ul>
      <li><b>ネイティブ前提の構成</b>：Expo Router・デザイントークン集約・共通コンポーネント化。ネイティブ化をそのまま継続できます。</li>
      <li><b>マスコットはベクター自作</b>：みかん・双葉・じょうろ・葉を SVG で描画（画像を貼らず再現）。</li>
      <li><b>動き</b>：ボタンの押下スケール、画面のフェードイン、モーダルのスプリング表示。</li>
      <li><b>課金の金額は未確定のためハードコードせず</b>設定に集約（後から差し替え可能）。</li>
      <li><b>ランク表示は入れていません</b>（v1対象外）。評価数・出品数のみ表示。</li>
      <li>商品画像は著作物を貼らず、ブランドカラーのプレースホルダー（みかん透かし）を表示。実機では実写真が載ります。</li>
    </ul>
    <p class="foot">掲示板・収穫・取引・評価・検索・マイページ詳細などは、この方向性の確定後に実装します。</p>
  </section>
</main>`;

const doc = `<style>
  :root{
    --bg:#F2EAD6; --paper:#FBF6EC; --ink:#33302a; --muted:#7C776B;
    --green:#2E9E5B; --green-deep:#2C8547; --orange:#F5A623; --mikan:#EF8E2A;
    --line:#e6ddc7; --shadow:0 18px 40px -20px rgba(120,90,40,.45);
    --frame:#20242a;
  }
  @media (prefers-color-scheme:dark){
    :root{ --bg:#191b16; --paper:#22261f; --ink:#ece7da; --muted:#a49f90;
      --line:#33372c; --shadow:0 20px 50px -22px rgba(0,0,0,.7); --frame:#0c0e0b; }
  }
  :root[data-theme="light"]{ --bg:#F2EAD6; --paper:#FBF6EC; --ink:#33302a; --muted:#7C776B; --line:#e6ddc7; --shadow:0 18px 40px -20px rgba(120,90,40,.45); --frame:#20242a; }
  :root[data-theme="dark"]{ --bg:#191b16; --paper:#22261f; --ink:#ece7da; --muted:#a49f90; --line:#33372c; --shadow:0 20px 50px -22px rgba(0,0,0,.7); --frame:#0c0e0b; }

  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--bg); color:var(--ink);
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,-apple-system,sans-serif;
    line-height:1.7; -webkit-font-smoothing:antialiased; }
  main{ max-width:1180px; margin:0 auto; padding:clamp(28px,5vw,64px) clamp(18px,4vw,40px) 80px; }

  .masthead{ text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom:clamp(32px,5vw,56px); animation:rise .6s ease both; }
  .brand{ display:flex; align-items:center; gap:8px; }
  .logo{ font-size:clamp(38px,7vw,60px); font-weight:900; color:var(--green); letter-spacing:1px; }
  .sprout,.mikan{ display:inline-flex; }
  .tagline{ margin:2px 0 0; font-weight:700; font-size:clamp(15px,2.4vw,19px); color:var(--ink); }
  h1{ margin:14px 0 4px; font-size:clamp(20px,3.2vw,27px); font-weight:800; text-wrap:balance; }
  .lede{ max-width:60ch; margin:6px auto 0; color:var(--muted); font-size:15.5px; }
  .lede strong{ color:var(--ink); font-weight:700; }

  .tokens{ display:flex; flex-wrap:wrap; justify-content:center; gap:8px 14px; margin-top:20px; }
  .tokens span{ display:inline-flex; align-items:center; gap:7px; background:var(--paper); border:1px solid var(--line);
    padding:6px 13px 6px 8px; border-radius:999px; font-size:12.5px; font-weight:600; color:var(--muted); }
  .tokens i{ width:15px; height:15px; border-radius:5px; border:1px solid transparent; display:inline-block; }

  .gallery{ display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:clamp(20px,3vw,34px); }
  .device{ margin:0; display:flex; flex-direction:column; gap:14px; animation:rise .6s ease both; animation-delay:calc(var(--i)*.06s + .1s); }
  .screen{ background:var(--frame); border-radius:30px; padding:8px; box-shadow:var(--shadow); border:1px solid rgba(255,255,255,.06); }
  .screen img{ display:block; width:100%; border-radius:23px; }
  figcaption{ padding:0 4px; }
  .cap-head{ display:flex; align-items:baseline; gap:10px; }
  .cap-head h3{ margin:0; font-size:17px; font-weight:800; }
  .src{ font-size:11.5px; font-weight:700; color:var(--green); background:color-mix(in srgb, var(--green) 12%, transparent);
    padding:2px 9px; border-radius:999px; white-space:nowrap; }
  figcaption p{ margin:5px 0 0; font-size:13px; color:var(--muted); line-height:1.6; }

  .notes{ margin-top:clamp(44px,6vw,72px); background:var(--paper); border:1px solid var(--line); border-radius:20px;
    padding:clamp(22px,3vw,34px); }
  .notes h2{ margin:0 0 14px; font-size:19px; font-weight:800; }
  .notes ul{ margin:0; padding-left:0; list-style:none; display:flex; flex-direction:column; gap:11px; }
  .notes li{ position:relative; padding-left:26px; font-size:14.5px; color:var(--muted); }
  .notes li b{ color:var(--ink); font-weight:700; }
  .notes li::before{ content:""; position:absolute; left:4px; top:9px; width:9px; height:9px; border-radius:50%;
    background:var(--orange); }
  .foot{ margin:18px 0 0; padding-top:16px; border-top:1px solid var(--line); font-size:13.5px; color:var(--muted); }

  @keyframes rise{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
  @media (prefers-reduced-motion:reduce){ *{ animation:none!important; } }
</style>
${html}`;

fs.writeFileSync(OUT, doc);
console.log('wrote', OUT, (fs.statSync(OUT).size/1024).toFixed(0)+'KB');
