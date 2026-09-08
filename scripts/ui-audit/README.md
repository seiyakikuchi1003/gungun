# 画面幅・文字サイズの崩れ検査

2026-08-21 の指摘「どの端末幅・文字サイズでも崩れないか」を確かめるための道具。

## 使い方

`.env` を退避してモックでビルドしないと、ログイン画面しか見られない。
（`.env` があると Supabase に繋ぎに行き、全ルートがログインへ飛ばされる）

```bash
mv .env .env.stash
npx expo export --platform web --clear --output-dir /tmp/webmock   # --clear は必須
mv .env.stash .env
npx serve -s -l 4600 /tmp/webmock &

CP="$HOME/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
CHROME_PATH="$CP" node scripts/ui-audit/overflow-check.mjs  http://localhost:4600
CHROME_PATH="$CP" node scripts/ui-audit/fontscale-check.mjs http://localhost:4600 1.3
CHROME_PATH="$CP" node scripts/ui-audit/shot.mjs            http://localhost:4600 2.0 /tmp/shots 320
```

## 落とし穴

- **`--clear` を付けないと `.env` を消してもキャッシュから URL が焼き込まれる。**
  ビルド後に `grep -l vrgpbtyflrtsmxonmuwg dist/_expo/static/js/web/*.js` が
  0 件になっていることを必ず確認する。
- `maxFontSizeMultiplier` は Web では効かない。バッジの数字が溢れて見えても
  実機では抑えられている。逆に言うと、Web の検査は実機より厳しめに出る。
- 自動検出だけでは足りない。`shot.mjs` で撮った画像を必ず目で見る。
