# 次に何をするか（Mac 再開用メモ）

最終更新：2026-07-28（クラウドセッションでの作業分）

## Macですぐ再開する手順

```bash
cd ~/gungun
git checkout claude/app-design-mockup-9f1vtu
git pull
npm install          # ★必須：supabase-js など依存が増えています
npx expo start       # QRをExpo Goで読む（SDK 54）
```

- Webで見るだけ：https://gungun-preview.pages.dev
- ブランチは常に `claude/app-design-mockup-9f1vtu`。

## 今の状態

| 層 | 状態 |
|---|---|
| アプリ画面（フロント） | ほぼ完成。全25画面が実装済み・レスポンシブ確認済み |
| データ | **モック**（`src/store/tree.tsx` / `src/data/mock.ts`）で動作中 |
| バックエンド（Supabase） | **設計・検証は完了**。クラウドに未設置 |

### バックエンドの中身（`supabase/`）

- `migrations/0001_schema.sql` … spec 2-2 のDDL（items1本で森を表現）＋ `app_settings`
- `migrations/0002_functions.sql` … トリガ＋RPC（`get_ancestors` / `can_water` / `detach_children` / `harvest` / `plant_seed` / `water`）
- `migrations/0003_rls.sql` … RLS土台＋肥料額などの既定値
- `migrations/0004_admin.sql` … 管理画面用（`reports.status` / `profiles.is_suspended` / `admin_audit_log`）
- `seed.sql` … デモの木をRPC経由で構築

**検証済み**：仕様書のPhase-1テスト全17項目をローカルPostgresで実行し全PASS
（種植え／水やりの親子付け、can_waterの4条件、収穫の玉突きの輪、枝の独立、1種1収穫、削除、深い木のroot/depth再計算、肥料消費・台帳・通知）。

## 未完了：クラウドDBの設置（要・人手）

Souzoh Org が**無料プロジェクト上限（2つ）**のため `gungun-dev` を作成できていない。
既存の `souzoh-rental-app` / `souzoh-CRM` は本番のため触らない。

### 選択肢
- **A. 新しいOrgを作る（実質無料）** — Supabase管理画面で新規Organization作成 → 無料プロジェクト作成
- **B. Souzoh OrgをProへ（$25/月〜）** — 既存Orgをアップグレード

### 器ができた後の手順（自動化済み）
```bash
supabase link --project-ref <ref>
supabase db push            # migrations を適用
# 開発用にデモデータを入れる場合のみ
psql "<connection string>" -f supabase/seed.sql
```
その後 `.env` に以下を設定すればアプリが実DBに切り替わる（未設定の間はモックのまま動く）：
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## 管理画面（`admin/`）

Next.js App Router + Tailwind。ユーザー／商品／通報の運営と、アプリ設定（金額・肥料量）の変更ができる。
詳しい手順は `admin/README.md`。

```bash
cd admin
npm install
cp .env.example .env.local   # SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ADMIN_PASSWORD
npm run dev                  # http://localhost:3100
```

- **接続先は環境変数だけで決まる**。お客様の Supabase アカウントへ移すときにコード変更は不要
- `SUPABASE_SERVICE_ROLE_KEY` は RLS を越える全権キー。サーバー専用・コミット禁止・共有禁止
- URL に `NEXT_PUBLIC_` を付けないこと（ビルド時に値が焼き込まれ、デプロイ先で差し替えられなくなる）
- `ADMIN_PASSWORD` 未設定だと誰でも開けるため、公開前に必ず設定する

## お客様アカウントへの引き継ぎ

1. お客様の Supabase で新規プロジェクト（推奨リージョン: Northeast Asia / Tokyo）
2. `supabase db push` で `supabase/migrations/` を流す
3. 必要ならデータを `pg_dump` / `psql` で移送
4. 管理画面の環境変数を新しい URL / service_role キーに差し替え
5. アプリの `.env`（`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`）も差し替え
6. 旧プロジェクトの service_role キーを失効させる

## 次にやる候補

1. **モック → 実RPCへの配線**：`src/store/tree.tsx` を `src/lib/api/gungun.ts` 経由に。`isSupabaseEnabled` で自動切替する形が用意済み
2. **認証**：ログイン画面を Supabase Auth に接続（今は `src/store/auth.tsx` のモック）
3. 型の自動生成：`supabase gen types typescript` で `src/types/db.ts` を置き換え

## プレビューサイト（Cloudflare Pages）の運用

公開URL：https://gungun-preview.pages.dev （誰でも閲覧可。認証なし）

**重要：GitHub連携の自動デプロイは無効にしてある。**
このプロジェクトは以前 GitHub 連携が有効で、production_branch が開発ブランチだったため、
ブランチに push するたびに「ビルド設定が空のままリポジトリ直下を公開」する自動デプロイが走り、
`index.html` が無いので全ページ404になっていた（2026-07-27に発生）。
再発防止のため `deployments_enabled=false` に変更済み。

そのため**プレビュー更新は手動デプロイのみ**：

```bash
# 1) Webを書き出して1枚のHTMLに固める
npx expo export --platform web
node scripts/inline-web.mjs          # → gungun-preview.html

# 2) 配信ディレクトリを作る（index.html / 404.html / _redirects / sounds）
#    _redirects の中身は「/*    /index.html   200」（SPAフォールバック。/login 等の直リンク用）

# 3) デプロイ（要 CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID）
npx wrangler pages deploy <配信ディレクトリ> \
  --project-name gungun-preview \
  --branch claude/app-design-mockup-9f1vtu --commit-dirty=true
```

将来 push で自動更新したい場合は、Pagesのビルド設定を
`build_command: npm ci && npx expo export --platform web` / `destination_dir: dist` にした上で
自動デプロイを再有効化する（`public/_redirects` を用意すれば dist にコピーされる）。
ただしビルド失敗時に本番が壊れるリスクがあるため、現状は手動運用を推奨。

## 補足

- 金額・肥料量はハードコード禁止。`app_settings` テーブル（DB側）と `src/config/settings.ts`（モック側）から読む
- ツリーの親子付け（`root_id`/`depth`）は必ずDB側（トリガ＋RPC）で確定させる。アプリ側で組み立てない
