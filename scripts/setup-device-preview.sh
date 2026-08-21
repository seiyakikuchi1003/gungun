#!/usr/bin/env bash
# 実機（Expo Go）で、実データ（Supabase）につないだ状態のアプリを開くための準備。
#
#   bash scripts/setup-device-preview.sh          # 実データにつなぐ
#   bash scripts/setup-device-preview.sh --mock   # モックで動かす（DBを触らない）
#
# やること
#   1. 依存関係の確認
#   2. .env を作る（無ければ対話で聞く）
#   3. 接続先を表示して確認させる
#   4. Metro のキャッシュを捨てて expo start
#
# ★ このスクリプトは菊池さんの Mac で実行してください。
#   クラウドの作業環境からは Expo のホストへ出られないため、実機配信ができません。
set -euo pipefail
cd "$(dirname "$0")/.."

MOCK=0
[ "${1:-}" = "--mock" ] && MOCK=1

echo "── ぐんぐん 実機プレビューの準備 ─────────────────────"
echo ""

# ── 1. 依存関係 ──────────────────────────────────────────
if [ ! -d node_modules ]; then
  echo "▶ npm install を実行します（初回は数分かかります）"
  npm install
else
  echo "✓ node_modules あり"
fi

# ── 2. .env ──────────────────────────────────────────────
if [ "$MOCK" = "1" ]; then
  if [ -f .env ]; then
    mv .env .env.mock-stash
    echo "✓ .env を .env.mock-stash に退避しました（モードを戻すときは元に戻してください）"
  fi
  echo "✓ モックモード：DB には一切書き込みません"
else
  if [ ! -f .env ]; then
    echo ""
    echo "接続情報がありません。Supabase の Project Settings → API Keys から入れてください。"
    echo "（publishable キー＝ sb_publishable_... を使います。secret キーは入れないこと）"
    echo ""
    read -r -p "  EXPO_PUBLIC_SUPABASE_URL      : " SB_URL
    read -r -p "  EXPO_PUBLIC_SUPABASE_ANON_KEY : " SB_KEY

    case "$SB_KEY" in
      sb_secret_*)
        echo ""
        echo "⛔ secret キーが入力されました。これはアプリに入れてはいけません（全権限のキーです）。"
        echo "   publishable キー（sb_publishable_...）を使ってください。"
        exit 1
        ;;
    esac

    cat > .env <<EOF
EXPO_PUBLIC_SUPABASE_URL=$SB_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SB_KEY
EXPO_PUBLIC_SKIP_EMAIL_VERIFICATION=true
EOF
    echo "✓ .env を作成しました（.gitignore 済み）"
  else
    echo "✓ .env あり"
  fi

  # secret キーが紛れ込んでいないか毎回チェックする
  if grep -q 'sb_secret_[A-Za-z0-9_-]\{10,\}' .env; then
    echo ""
    echo "⛔ .env に secret キーが入っています。publishable キーに置き換えてください。"
    exit 1
  fi

  echo ""
  echo "── 接続先 ──"
  grep '^EXPO_PUBLIC_SUPABASE_URL=' .env | sed 's/^/  /'
  grep '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' .env | sed 's/\(sb_publishable_.\{0,8\}\).*/\1…/' | sed 's/^/  /'
  echo ""
  echo "  ⚠ ここが gungun-dev（開発用）であることを確認してください。"
  echo "    お客様の本番プロジェクトを指していると、テストデータが本番に入ります。"
fi

echo ""
echo "── 起動します ─────────────────────────────────────"
echo ""
echo "  1. iPhone に Expo Go を入れて、同じ Wi-Fi につないでください"
echo "  2. 出てくる QR コードを iPhone のカメラで読み取ります"
echo "  3. ログイン画面に「● 実データ（Supabase）に接続中」が出ていれば成功です"
if [ "$MOCK" = "1" ]; then
  echo "     （モードモードではバッジは出ません）"
fi
echo ""
echo "  ※ プッシュ通知だけは Expo Go では確認できません（SDK 53 以降の制限）。"
echo "    docs/PUSH.md の手順で development build を作る必要があります。"
echo ""

# --clear は必須。前回のビルドで埋め込まれた EXPO_PUBLIC_* がキャッシュに残るため、
# .env を変えても反映されないことがある。
npx expo start --clear
