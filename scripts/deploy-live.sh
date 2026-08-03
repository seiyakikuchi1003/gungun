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
npx expo export --platform web --output-dir dist-live
node scripts/inject-web-fonts.mjs dist-live

# シークレットキーが混ざっていないか最後に確認（publishable キーだけが入るのが正しい）
if grep -rq "sb_secret_" dist-live/_expo 2>/dev/null; then
  echo "⚠ ビルド成果物に secret key が含まれています。中止します。"
  exit 1
fi

npx wrangler pages deploy dist-live --project-name=gungun-dev-app --branch=main --commit-dirty=true
