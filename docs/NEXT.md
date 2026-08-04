# 残りタスク（引き継ぎ・再開用メモ）

最終更新：2026-08-04

## すぐ再開する手順

```bash
cd ~/gungun
git checkout claude/app-design-mockup-9f1vtu
git pull
npm run preview           # これ1本。DB適用 → 確認 → 管理画面 → Expo Go の QR
```

初回だけ Supabase の接続情報を4つ聞かれます（ダッシュボードからコピペ）。

| 読むもの | 内容 |
|---|---|
| [`DEVICE-PREVIEW.md`](./DEVICE-PREVIEW.md) | 立ち上げ方・つまずきどころ |
| [`WALKTHROUGH.md`](./WALKTHROUGH.md) | **実機での通し確認の台本**（2アカウントで一周する順番） |
| [`ADMIN-GUIDE.md`](./ADMIN-GUIDE.md) | **管理画面の見方**（先方にもそのまま渡せる） |

- アプリ … ターミナルの QR を iPhone のカメラで読む（Expo Go）
- 管理画面 … http://localhost:3100 （localhost はパスワード不要）
- DB だけ触りたいとき … `npm run db:status` / `npm run db:apply`

> **実機配信もDB接続もクラウドの作業環境からはできません。** 組織の egress ポリシーで
> `expo.dev` / `exp.host` / ngrok / `*.supabase.co` / `*.pages.dev` すべてに出られません
> （2026-08-04 実測：CONNECT 403）。`--tunnel` も EAS Update も同じ理由で不可。
> 上のコマンドは菊池さんの Mac で実行してください。
>
> **菊池さんの Mac 上（`~/gungun`）で作業する場合はこの制限はありません。** Supabase にも
> GitHub にも到達でき、Expo の開発サーバもそのまま立ちます（2026-08-04 実測）。

| URL | 接続先 | 用途 |
|---|---|---|
| https://gungun-preview.pages.dev | なし（モック） | 先方への画面デモ。触っても保存されない |
| https://gungun-dev-app.pages.dev | Supabase `gungun-dev` | 実データのテスト。**保存される** |
| https://gungun-admin.pages.dev | Supabase `gungun-dev` | 管理画面（先方運営用） |

実データでのテスト手順は [`DB-TEST.md`](./DB-TEST.md)。

---

## 今の状態

| 層 | 状態 |
|---|---|
| アプリ画面 | **完成**。全30画面。レスポンシブ点検・ボタン点検を自動化して通過 |
| API レイヤ | **完成**。`src/lib/api/` が全機能ぶん実装済み |
| ストア | **完成**。`isSupabaseEnabled` で実DB／モックを自動切替 |
| 認証 | **完成**（Supabase Auth）。登録・ログイン・コード認証・再設定・退会 |
| DB 設計 | **完成**。0001〜0011。ローカルPostgresでテスト全PASS |
| DB 設置 | **適用済み**（2026-08-04 確認）。`gungun-dev` に 0001〜0011 すべて反映。`npm run db:status` で確認できる |
| 実機プレビュー | `npm run preview` で アプリ＋管理画面＋DB がまとめて立つ（Mac で実行） |
| 管理画面 | **完成**・デプロイ済み・パスワード設定済み |
| メール送信（Resend） | **未着手** |
| プッシュ通知 | アプリ側・DB側・送信ワーカーは**実装済み**。EASビルドと実機確認が残り（`docs/PUSH.md`） |
| 課金 | **未着手**（画面だけ。要・方式の確定） |
| ネイティブ化 / 審査 | **未着手** |

---

## A. すぐやること（手作業が必要）

### A-1. ~~gungun-dev にスキーマを流す~~ ✅ 完了（2026-08-04）

0001〜0011 すべて適用済み。`npm run db:status` で確認できる。
以降マイグレーションを足したときは `npm run db:apply`（未適用のぶんだけ流す。何度実行しても安全）。

`SUPABASE_DB_URL` は `.env.local` に保存済み（このMacの中だけ・.gitignore 済み）。

### A-2. Supabase Auth の設定

Authentication → Sign In / Providers → Email

- **開発中**：「Confirm email」を **OFF** — ✅ 設定済み（`npm run check:auth` が全項目PASS）
- **本番**：Confirm email を ON にしたうえで、Authentication → Emails の
  **Confirm signup / Reset password テンプレートに `{{ .Token }}` を入れる**。
  既定テンプレートはリンクのみで6桁コードが載らず、アプリのコード入力画面が使えない

### A-3. 実データで通し確認

```bash
npm run preview           # DB適用 → 確認 → 管理画面 → Expo Go の QR
```

出品 → 水やり → 収穫 → 取引 → 評価 → 退会 を2アカウントで一周する。
アプリで操作したら管理画面（localhost:3100）を再読み込みして、同じデータが出るか見る。
画像アップロード（Storage の `item-images` バケット）もここで初めて実データを通る。
確認する順番と、DB のどこを見ればよいかは [`DEVICE-PREVIEW.md`](./DEVICE-PREVIEW.md)。

### A-4. 管理画面のパスワードを自分のものに変える

`ADMIN_PASSWORD` は設定済み（2026-08-03。未設定のまま公開URLに出ていたのを検知して対応）。
いま入っているのは自動生成した仮のものなので、**先方にお渡しする前に差し替えてください**。

Cloudflare Pages → gungun-admin → Settings → Variables → `ADMIN_PASSWORD` を編集 →
Deployments → Retry deployment。

- コード側は fail closed にしてある。`ADMIN_PASSWORD` 未設定のとき、localhost 以外からの
  アクセスは 503 で閉じる（裏に service_role キーがあるため、素通しにしない）
- さらに固めるなら Cloudflare Access（`admin/README.md`）

---

## B. めたん様に確認・依頼すること

1. **Cloudflare / Supabase のアカウントに海野を招待**（前回MTGからの継続）
2. **本番の Supabase プロジェクトを先方アカウントで作成**（引き継ぎ手順は下記 E）
3. **課金の方式と金額の確定** ← 下の「⚠ 課金の論点」を先に読む
4. **利用規約・プライバシーポリシーの本文**（課金対応で変更が必要とのこと。
   管理画面から差し替えられる形にはしてある）
5. **Apple Developer Program の契約者**（年 $99）をどちらが持つか

### ⚠ 課金の論点（要相談）

仕様書では **Stripe（Apple Pay）** を想定しているが、このアプリは iOS ネイティブで、

- 肥料 = アプリ内で消費する仮想通貨
- プレミアム = 月額サブスク

のどちらも **App Store の審査ガイドライン 3.1.1 で In-App Purchase が必須**になる可能性が高い。
Stripe で外部決済すると審査で弾かれるリスクがあるため、**実装に入る前に方式を確定**したい。

- IAP にする場合：手数料15〜30%、StoreKit（`expo-in-app-purchases` 等）で実装、
  App Store Connect に商品を登録
- Stripe を使える範囲：物理的な商品・サービスの決済（このアプリでは該当しない）

金額はハードコードしていないので、確定後に管理画面から変更できる。

---

## C. 実装として残っているもの

DB 側の受け皿は 0009 で用意済み。残っているのはアプリ／サーバ側の実装。

| # | 内容 | 補足 |
|---|---|---|
| C-1 | **メール送信（Resend）** | いまは Supabase 標準のメール。差出人・文面を自社にするなら Resend を SMTP に設定 |
| C-2 | ~~**プッシュ通知**~~ | **実装済み**。アプリ側（登録・解除・タップ遷移）、送信ワーカー（Edge Function）、DB すべて完了。<br>残り：`npx eas init` でプロジェクトID → development build → iOS のプッシュ証明書 → Edge Function のデプロイと Cron 設定 → **実機で通す**。手順は [`PUSH.md`](./PUSH.md) |
| C-3 | **課金の実装** | DB：`purchases` と `redeem_purchase()`（冪等）は 0009 で用意済み。<br>残り：方式の確定（上記 B-3）→ StoreKit 導入 → **レシート検証サーバ**（Edge Function か管理画面の API） |
| C-4 | **型の自動生成** | `supabase gen types typescript` で `src/types/db.ts` を実DBから生成 |
| C-5 | **プレミアムの中身** | 「欲しいものリスト公開」が画面だけ。v1に入れるか要相談 |
| C-6 | ~~**利用停止が掲示板に効いていない**~~ | **対応済み（0011）**。`board_posts` / `board_comments` / `item_comments` の insert ポリシーに「停止中でない」条件を追加。ローカル Postgres で「停止中は弾かれる／解除後は書ける／なりすましは弾かれる」を確認 |

---

## D. ネイティブ化・App Store 申請

| # | 内容 |
|---|---|
| D-1 | `eas.json` は作成済み（development / preview / production）。<br>残り：`npx eas init` → `npx eas build --profile development --platform ios` を通す |
| D-2 | Apple Developer Program 登録 → App Store Connect にアプリ作成 |
| D-3 | アイコン・スプラッシュの最終版（いまは仮素材） |
| D-4 | 審査用素材：スクリーンショット、説明文、キーワード、サポートURL |
| D-5 | プライバシー情報の申告（収集するデータ：メール・住所・写真） |
| D-6 | C2C の審査対策：取引トラブルの窓口・通報機能の明記（通報・ブロックは実装済み） |
| D-7 | `app.json` の bundleIdentifier は `app.gungun.ios`。ドメインに合わせるか確認 |

---

## E. 先方アカウントへの引き継ぎ

1. お客様の Supabase で新規プロジェクト（推奨リージョン: Northeast Asia / Tokyo）
2. `supabase/apply_all.sql` を流す
3. 必要ならデータを `pg_dump` / `psql` で移送
4. 管理画面の環境変数を新しい URL / service_role キーに差し替え
5. アプリの `.env` も差し替えて `bash scripts/deploy-live.sh`
6. **旧プロジェクトの service_role キーを失効させる**

---

## F. 移行・運用

| # | 内容 |
|---|---|
| F-1 | 既存160人の移行（Click版 → Supabase）＋再ログイン案内メール（仕様書 Phase 10）<br>DB：`legacy_users` に名簿を入れれば、その人が登録した時点で自動で紐づく（0009）。<br>残り：旧データの書き出しと投入、案内メールの送信 |
| F-2 | 独自ドメインの取得と設定 |
| F-3 | PR #3 のマージ |
| F-4 | Cloudflare Pages の `gungun-app` プロジェクトが使われていない残骸。整理する |

---

## デプロイ手順（必ずスクリプト経由で）

```bash
bash scripts/deploy-preview.sh   # モック版 → gungun-preview
bash scripts/deploy-live.sh      # 実DB接続版 → gungun-dev-app
```

**手動で `npx expo export` しないこと。** Metro のビルドキャッシュには前回埋め込まれた
`EXPO_PUBLIC_*` の値が残るため、`.env` を消しただけではモック版に接続情報が入り込む
（実際に一度混入した。スクリプトの検査で止めた）。両スクリプトは `--clear` を付け、
書き出したファイルにキーが混ざっていないか検査してから公開する。

### Cloudflare Pages の GitHub 自動デプロイは無効にしてある

以前 production_branch が開発ブランチのまま自動デプロイが走り、ビルド設定が空だったため
リポジトリ直下を公開して全ページ404になった（2026-07-27）。`deployments_enabled=false` に変更済み。

---

## 点検スクリプト

```bash
# dist を配信しておく（http-server dist -p 8899 --proxy "http://127.0.0.1:8899?"）
node scripts/audit-responsive.mjs   # 全ルート × 4幅で崩れを検出
node scripts/audit-buttons.mjs      # 全ルートのボタンを押して無反応を検出
```

### DB のテスト

ローカル Postgres にマイグレーションを流して、仕様どおり動くかを確認する。

```bash
bash supabase/tests/run.sh                  # 既定ポート 55432
PGPORT_TEST=5455 bash supabase/tests/run.sh  # ポートを変えたいとき
```

- `01_app_test.sql` … 仕様書 Phase-1 の項目（種植え・水やりの親子付け・can_water の4条件・
  収穫の玉突きの輪・枝の独立・肥料の消費と台帳・通知）
- `0009_test.sql` … プレミアムの期限切れ、課金の二重付与防止、プッシュトークンの付け替え、
  移行台帳の自動紐づけ、**退会（外部キーで失敗しないこと）**

`audit-buttons.mjs` は色の変化も状態の指紋に含めるので、選択チップを誤検知しない。
戻るボタンは `history.pushState` で遷移させている都合上「無反応」に出るが、実機では正常。

---

## 補足

- 金額・肥料量はハードコード禁止。`app_settings`（DB）と `src/config/settings.ts`（モック）から読む
- ツリーの親子付け（`root_id`/`depth`）は必ずDB側（トリガ＋RPC）で確定させる。アプリ側で組み立てない
- 「大きな木」「MAX」など木の大小を表す言い方は使わない（2026-07-28 MTG）。
  同じ数を別の名前で二度出すのも禁止（不明瞭さの原因になる）
- `sb_secret_...` はアプリ側に絶対に入れない。アプリは publishable key だけ、権限は RLS が制御する
