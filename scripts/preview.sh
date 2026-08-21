#!/usr/bin/env bash
# ぐんぐん：実機プレビューを1コマンドで立ち上げる。
#
#   npm run preview              # 実データ（Supabase）：DB適用 → 管理画面 → Expo Go の QR
#   npm run preview -- --mock    # モック（DBを触らない）
#   npm run preview -- --no-admin # 管理画面は立てない
#   npm run preview -- --skip-db  # DBの適用・確認を飛ばす
#
# やること
#   1. 依存関係（アプリ・管理画面）
#   2. .env（アプリ用：URL と publishable キー）
#   3. DB に未適用の SQL を流す（何度実行しても安全）
#   4. アプリ側から見えるかを確認（check:supabase）
#   5. 管理画面を http://localhost:3100 で起動（パスワード不要：localhost のみ素通し）
#   6. Expo を起動して QR を出す（iPhone の Expo Go で読む）
#
# ★ このスクリプトは菊池さんの Mac で実行してください。
#   クラウドの作業環境からは Expo のホストにも Supabase にも出られないため、
#   実機配信もDB接続もできません（組織のegressポリシーで遮断されています）。
set -euo pipefail
cd "$(dirname "$0")/.."

MOCK=0; NO_ADMIN=0; SKIP_DB=0
for a in "$@"; do
  case "$a" in
    --mock) MOCK=1 ;;
    --no-admin) NO_ADMIN=1 ;;
    --skip-db) SKIP_DB=1 ;;
    *) echo "不明なオプション: $a"; exit 1 ;;
  esac
done

b() { printf '\033[1m%s\033[0m\n' "$1"; }
dim() { printf '\033[90m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m! %s\033[0m\n' "$1"; }
good() { printf '\033[32m✓ %s\033[0m\n' "$1"; }

ADMIN_PID=""
cleanup() {
  if [ -n "$ADMIN_PID" ] && kill -0 "$ADMIN_PID" 2>/dev/null; then
    kill "$ADMIN_PID" 2>/dev/null || true
    echo ""
    dim "管理画面を停止しました。"
  fi
}
trap cleanup EXIT

echo ""
b "── ぐんぐん プレビュー ────────────────────────────────"
echo ""

# ── 1. 依存関係 ────────────────────────────────────────────
if [ ! -d node_modules ]; then
  b "1. アプリの依存関係をインストールします（初回は数分）"
  npm install
else
  good "アプリの依存関係あり"
fi

if [ "$NO_ADMIN" = "0" ] && [ ! -d admin/node_modules ]; then
  b "1-2. 管理画面の依存関係をインストールします"
  npm --prefix admin install
fi

# ── 2. アプリの .env ───────────────────────────────────────
if [ "$MOCK" = "1" ]; then
  if [ -f .env ]; then
    mv .env .env.mock-stash
    warn ".env を .env.mock-stash に退避しました（実データに戻すときは名前を戻す）"
  fi
  good "モックモード：DB には一切書き込みません"
  SKIP_DB=1; NO_ADMIN=1
else
  if [ ! -f .env ]; then
    echo ""
    b "2. アプリの接続情報を入れてください"
    dim "Supabase ダッシュボード → Project Settings → API Keys"
    dim "使うのは publishable キー（sb_publishable_...）です。secret キーは入れないこと。"
    echo ""
    read -r -p "  EXPO_PUBLIC_SUPABASE_URL      : " SB_URL
    read -r -p "  EXPO_PUBLIC_SUPABASE_ANON_KEY : " SB_KEY
    case "$SB_KEY" in
      sb_secret_*)
        echo ""
        printf '\033[31m⛔ secret キーが入力されました。これは全権限のキーなのでアプリに入れてはいけません。\033[0m\n'
        echo "   publishable キー（sb_publishable_...）を使ってください。"
        exit 1
        ;;
    esac
    cat > .env <<EOF
EXPO_PUBLIC_SUPABASE_URL=$SB_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=$SB_KEY
EXPO_PUBLIC_SKIP_EMAIL_VERIFICATION=true
EOF
    good ".env を作成しました（.gitignore 済み）"
  else
    good ".env あり"
  fi

  if grep -q 'sb_secret_[A-Za-z0-9_-]\{10,\}' .env; then
    echo ""
    printf '\033[31m⛔ .env に secret キーが入っています。publishable キーに置き換えてください。\033[0m\n'
    exit 1
  fi

  echo ""
  dim "── アプリの接続先 ──"
  grep '^EXPO_PUBLIC_SUPABASE_URL=' .env | sed 's/^/  /'
  grep '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' .env | sed 's/\(sb_publishable_.\{0,8\}\).*/\1…/' | sed 's/^/  /'
  warn "ここが gungun-dev（開発用）であることを確認してください。"
fi

# ── 3. DB に SQL を流す ────────────────────────────────────
if [ "$SKIP_DB" = "0" ]; then
  echo ""
  b "3. データベースの準備"

  # SUPABASE_DB_URL が .env.local にも環境変数にも無ければ、ここで一度だけ聞く。
  if [ -z "${SUPABASE_DB_URL:-}" ] && ! grep -qs '^SUPABASE_DB_URL=' .env.local; then
    dim "Supabase ダッシュボード → 右上の Connect → Session pooler の URI を貼ってください。"
    dim "（[YOUR-PASSWORD] は DB のパスワードに置き換える。空Enterで飛ばせます）"
    echo ""
    read -r -p "  SUPABASE_DB_URL : " DB_URL
    if [ -n "$DB_URL" ]; then
      touch .env.local
      printf 'SUPABASE_DB_URL=%s\n' "$DB_URL" >> .env.local
      good ".env.local に保存しました（次回からは聞きません・.gitignore 済み）"
    fi
  fi

  if [ -n "${SUPABASE_DB_URL:-}" ] || grep -qs '^SUPABASE_DB_URL=' .env.local; then
    node scripts/apply-schema.mjs
  else
    warn "接続文字列が無いので SQL の適用は飛ばします。"
    dim "  まだ一度も流していない場合は、Supabase の SQL Editor に"
    dim "  supabase/apply_all.sql を貼って Run してください（1回だけ）。"
  fi

  # ── 4. アプリ側から見えるか ───────────────────────────────
  echo ""
  b "4. アプリ側から見えるかの確認"
  if ! node scripts/check-supabase.mjs; then
    echo ""
    warn "確認で問題が出ています。このまま進めても画面が空になることがあります。"
    read -r -p "  それでも続けますか？ [y/N] : " GO
    case "$GO" in y|Y) ;; *) exit 1 ;; esac
  fi
fi

# ── 5. 管理画面 ────────────────────────────────────────────
if [ "$NO_ADMIN" = "0" ]; then
  echo ""
  b "5. 管理画面"

  if [ ! -f admin/.env.local ]; then
    dim "管理画面は RLS を越えて全データを扱うため service_role キーが必要です。"
    dim "Supabase → Project Settings → API Keys → secret キー（sb_secret_...）"
    dim "（空Enterで管理画面を飛ばせます。入力は画面に出ません）"
    echo ""
    A_URL="$(grep '^EXPO_PUBLIC_SUPABASE_URL=' .env | cut -d= -f2-)"
    read -r -s -p "  SUPABASE_SERVICE_ROLE_KEY : " A_KEY; echo ""
    if [ -n "$A_KEY" ]; then
      case "$A_KEY" in
        sb_publishable_*)
          warn "publishable キーが入力されました。管理画面には secret キーが必要です。管理画面は飛ばします。"
          NO_ADMIN=1
          ;;
        *)
          cat > admin/.env.local <<EOF
SUPABASE_URL=$A_URL
SUPABASE_SERVICE_ROLE_KEY=$A_KEY
EOF
          chmod 600 admin/.env.local
          good "admin/.env.local を作成しました（.gitignore 済み・このMacの中だけ）"
          ;;
      esac
    else
      NO_ADMIN=1
      dim "管理画面は起動しません。"
    fi
  else
    good "admin/.env.local あり"
  fi
fi

if [ "$NO_ADMIN" = "0" ]; then
  mkdir -p .expo
  npm --prefix admin run dev > .expo/admin-dev.log 2>&1 &
  ADMIN_PID=$!
  # トップページで待つ（初回コンパイルに20秒ほどかかるので、ここで温めておく）
  printf '  起動を待っています（初回は20秒ほど）'
  for _ in $(seq 1 90); do
    if curl -sf -o /dev/null http://127.0.0.1:3100/ 2>/dev/null; then
      echo ""
      good "管理画面: http://localhost:3100  （localhost からはパスワード不要）"
      break
    fi
    if ! kill -0 "$ADMIN_PID" 2>/dev/null; then
      echo ""
      warn "管理画面が起動できませんでした。ログ: .expo/admin-dev.log"
      ADMIN_PID=""
      break
    fi
    printf '.'
    sleep 1
  done
fi

# ── 6. Expo ────────────────────────────────────────────────
echo ""
b "── Expo Go で開きます ─────────────────────────────────"
echo ""
echo "  1. iPhone に Expo Go を入れて、この Mac と同じ Wi-Fi につないでください"
echo "  2. 下に出る QR コードを iPhone のカメラで読み取ります"
if [ "$MOCK" = "0" ]; then
  echo "  3. ログイン画面に「● 実データ（Supabase）に接続中」が出ていれば成功です"
  echo ""
  echo "  デモアカウント： metan@example.com / takusan@example.com（パスワードは password）"
fi
echo ""
dim "  ※ プッシュ通知だけは Expo Go では確認できません（SDK 53 以降の制限）。"
dim "    docs/PUSH.md の手順で development build が必要です。"
dim "  ※ 終了は Ctrl+C。管理画面も一緒に止まります。"
echo ""

# --clear は必須。前回のビルドで埋め込まれた EXPO_PUBLIC_* がキャッシュに残るため、
# .env を変えても反映されないことがある。
npx expo start --clear
