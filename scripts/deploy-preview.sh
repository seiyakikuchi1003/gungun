#!/usr/bin/env bash
# 先方デモ用のモック版をビルドして Cloudflare Pages（gungun-preview）に出す。
#
# ★ .env があるとビルドに接続情報が入り、デモ版が実DBを触ってしまう。
#   デモ中に先方の操作でテストデータが増えるのを防ぐため、
#   ここでは .env を必ず退避してからビルドする。
#
# 使い方:  bash scripts/deploy-preview.sh
set -euo pipefail

STASH=""
restore() {
  if [ -n "$STASH" ] && [ -f "$STASH" ]; then
    mv "$STASH" .env
    echo ".env を戻しました"
  fi
}
trap restore EXIT

if [ -f .env ]; then
  STASH=".env.preview-stash"
  mv .env "$STASH"
  echo ".env を一時退避（モック版として書き出すため）"
fi

rm -rf dist
# --clear は必須。Metro のキャッシュには前回ビルド時に埋め込まれた
# EXPO_PUBLIC_* の値が残るため、付けないと .env を消してもキーが混入する。
npx expo export --platform web --clear
node scripts/inject-web-fonts.mjs dist

# 接続情報が混ざっていないことを確認（モック版に入っていてはいけない）
if grep -rqE 'sb_(publishable|secret)_[A-Za-z0-9_-]{10,}' dist/_expo 2>/dev/null; then
  echo "⚠ モック版のビルドに Supabase のキーが含まれています。中止します。"
  exit 1
fi

npx wrangler pages deploy dist --project-name=gungun-preview --branch=main --commit-dirty=true
