#!/usr/bin/env bash
# 実DB（Supabase gungun-dev）に接続する版をビルドして Cloudflare Pages に出す。
#
#   ・接続先は .env の EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
#   ・先方デモ用のモック版（gungun-preview）とは別URLに出すので、
#     デモ中にテストデータが混ざる心配がない
#
# 使い方:  bash scripts/deploy-live.sh
set -euo pipefail

[ -f .env ] || { echo ".env がありません。EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を入れてください"; exit 1; }
grep -q 'EXPO_PUBLIC_SUPABASE_URL=.\+' .env || { echo ".env の EXPO_PUBLIC_SUPABASE_URL が空です"; exit 1; }

rm -rf dist-live
# --clear は必須。Metro のキャッシュには前回ビルド時に埋め込まれた
# EXPO_PUBLIC_* の値が残るため、付けないと .env の変更が反映されない。
npx expo export --platform web --output-dir dist-live --clear
node scripts/inject-web-fonts.mjs dist-live

# シークレットキーが混ざっていないか最後に確認（publishable キーだけが入るのが正しい）
#
# supabase-js 自身がキー形式の判定コードとして `startsWith("sb_secret_")` という
# 文字列を持っているため、"sb_secret_" の有無だけでは判定できない。
# 実キーの形（プレフィックス＋10文字以上のキー文字列）に一致するものだけを探す。
if grep -rqE 'sb_secret_[A-Za-z0-9_-]{10,}' dist-live/_expo 2>/dev/null; then
  echo "⚠ ビルド成果物に secret key が含まれています。中止します。"
  echo "   .env に sb_secret_... を入れていないか確認してください（アプリ側は publishable key だけ）。"
  exit 1
fi

npx wrangler pages deploy dist-live --project-name=gungun-dev-app --branch=main --commit-dirty=true
