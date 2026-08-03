# ぐんぐん 管理画面

運営が「ユーザー・商品・通報」を管理し、**アプリ内の金額や肥料量をコードを触らずに変更する**ための画面です。
Next.js (App Router) + TypeScript + Tailwind。Supabase には **service_role キーでサーバー側からのみ**接続します。

## できること

| 画面 | 内容 |
| --- | --- |
| ダッシュボード | ユーザー数／種の数／育成中の商品／収穫数／未対応の通報 などの件数と、直近の出品・登録 |
| ユーザー | 検索、肥料の手動付与・減算（台帳にも記録）、利用停止／解除 |
| 商品 | 検索・絞り込み、非表示（`status = deleted`）／復活 |
| 通報 | 未対応／対応済み／却下の切り替え、対応メモ |
| アプリ設定 | `app_settings` の値（水やり肥料・ログインボーナス・プレミアム月額など）の編集 |

運営の操作はすべて `admin_audit_log` に記録されます。

## セットアップ

```bash
cd admin
npm install
cp .env.example .env.local   # 値を埋める
npm run dev                  # http://localhost:3100
```

`.env.local` に設定する値：

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=（Supabase → Project Settings → API → service_role）
ADMIN_PASSWORD=（管理画面を開くためのパスワード）
```

- `SUPABASE_SERVICE_ROLE_KEY` は **RLS を無視して全データを読み書きできる鍵**です。
  `NEXT_PUBLIC_` を付けない／リポジトリにコミットしない／チャットや issue に貼らないこと。
- `ADMIN_PASSWORD` が未設定のときは誰でも開けてしまいます（ローカル開発用）。**公開前に必ず設定**してください。
- 接続情報が未設定でも画面は起動し、各ページに設定手順が表示されます。

## 前提となる DB マイグレーション

`supabase/migrations/0004_admin.sql` が管理画面用の列を足します（未適用でも起動はしますが、停止／通報対応が動きません）。

```bash
supabase db push        # または Supabase Studio の SQL Editor に貼り付け
```

追加されるもの：

- `reports.status` / `handled_at` / `handled_note`
- `profiles.is_suspended` / `suspended_reason`
- `admin_audit_log` テーブル
- `app_settings` の追加既定値（`premium_price_yen` など）

## お客様アカウントへの引き継ぎ

この管理画面は **環境変数だけで接続先が決まる**作りです。移行時にコードの変更は不要です。

1. お客様の Supabase アカウントで新しいプロジェクトを作る（推奨リージョン: Northeast Asia / Tokyo）
2. `supabase/migrations/` をそのプロジェクトに流す（`supabase db push`）
3. データを移行する場合は `pg_dump` / `psql` でコピーする
4. 管理画面の `.env.local`（またはホスティング側の環境変数）を新しい URL と service_role キーに差し替える
5. アプリ側（`.env`）の `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` も同様に差し替える
6. 旧プロジェクトの service_role キーを失効させる

## デプロイ（Cloudflare Pages）

Next.js App Router + サーバーアクションを Cloudflare Pages で動かすため、
`@cloudflare/next-on-pages` を使ってビルドします。

### ビルド／デプロイ手順

```bash
cd admin
npx @cloudflare/next-on-pages          # .vercel/output/static に生成される
npx wrangler pages deploy .vercel/output/static \
  --project-name=gungun-admin \
  --branch=main
```

### 事前設定（1回だけ）

- Pages プロジェクト作成: `npx wrangler pages project create gungun-admin --production-branch=main`
- `nodejs_compat` 互換フラグを有効化（Supabase SDK が Node.js 組込みを使うため）
  ```bash
  curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -X PATCH \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/gungun-admin" \
    -d '{"deployment_configs":{"production":{"compatibility_flags":["nodejs_compat"]},"preview":{"compatibility_flags":["nodejs_compat"]}}}'
  ```
- 各ルート `page.tsx` の先頭に `export const runtime = "edge";` が必要（設定済）
- 環境変数を Pages ダッシュボードで設定
  - `SUPABASE_URL`（Preview / Production 両方）
  - `SUPABASE_SERVICE_ROLE_KEY`（暗号化して保存）
  - `ADMIN_PASSWORD`（暗号化して保存）

### アクセス制限（Cloudflare Access 併用推奨）

管理画面は運営専用のため、Cloudflare Zero Trust の Access で
「特定のメールアドレスのみログイン可」に絞ることを推奨します。
Supabase 側のログインと二重ロックにすることで、URL が流出しても中身は開けません。

公開URL: `https://gungun-admin.pages.dev`
