# 実データ（Supabase）でテストする手順

## いまの状態

URL は2つあり、**中身が違います**。

| URL | 接続先 | 用途 |
|---|---|---|
| https://gungun-preview.pages.dev | なし（モック） | 先方への画面デモ用。触っても何も保存されない |
| https://gungun-dev-app.pages.dev | Supabase `gungun-dev` | 実データのテスト用。**保存される** |

モック版はアプリの中にサンプルデータを持っているだけなので、出品しても水やりしても
ページを再読み込みすると元に戻ります。データベースには一切届きません。

実データ版は同じ画面ですが、出品・水やり・収穫・投稿・通知がすべて Supabase の
テーブルに書き込まれます。

ログイン画面の下に **「● 実データ（Supabase）」/「○ モックデータ」** と出ているので、
どちらを開いているか一目で分かります。

---

## 手順1：データベースを用意する（初回だけ）

実データ版は、テーブルや関数がまだ無いと動きません。最初に1回だけ流します。

1. Supabase のダッシュボードで **gungun-dev** プロジェクトを開く
2. 左メニューの **SQL Editor** → **New query**
3. リポジトリの [`supabase/apply_all.sql`](../supabase/apply_all.sql) を全部コピーして貼り付け
4. **Run** を押す

これ1本で、テーブル・関数・RLS・初期設定・デモデータまで入ります。
（0001〜0008 のマイグレーションと `seed_demo.sql` を実行順に並べたものです）

> デモデータが不要なら、ファイル末尾の「▼ デモデータ」から下を削除してから実行してください。

### 入るデモアカウント

デモデータを入れると、この6人でログインできます。パスワードはすべて `password` です。

| メールアドレス | ニックネーム |
|---|---|
| `metan@example.com` | めたん |
| `haru@example.com` | はる |
| `sakura@example.com` | さくら |
| `yu@example.com` | ゆう |
| `takusan@example.com` | たくさん |
| `kenta@example.com` | けんた |

2人分のアカウントで別々のブラウザ（または片方をシークレットウィンドウ）を開くと、
**水やり → 相手に通知が飛ぶ → 収穫 → 取引が立つ** という流れをそのまま試せます。

新しくアカウントを作る場合は、アプリの新規登録から進めば `profiles` に行が作られます。

---

## 手順2：触ってみる

https://gungun-dev-app.pages.dev を開いてログインします。

確認しやすい順番：

1. **タネを植える**（＋ボタン → タネを植える）
   → Supabase の `items` に `parent_id = null` の行が増える
2. **他の人の商品に水やり**
   → `items` に子の行が増え、`profiles.fertilizer` が減り、相手に `notifications` が入る
3. **収穫する**（自分のタネ → 収穫する → 商品を選ぶ）
   → `exchanges` に輪の人数ぶんの行ができ、選ばれなかった枝は `parent_id = null` に戻る（苗木機能）
4. **掲示板に投稿**
   → `board_posts` に行が増える
5. **管理画面**から同じデータが見えることを確認

データが入ったかどうかは、Supabase の **Table Editor** で `items` / `exchanges` /
`notifications` を見るのが一番早いです。

---

## 手順3：データを作り直したいとき

`supabase/seed_demo.sql` は、実行するたびにデモデータを消してから入れ直します。
テストで散らかったら、SQL Editor でこのファイルをもう一度流せばリセットされます。

> デモユーザー（UUID が `00000000-...-0000000000a1`〜`a6`）の分だけを消すので、
> 自分で新規登録したアカウントのデータは残ります。

---

## 開発側のメモ

### 実データ版を作り直す

```bash
bash scripts/deploy-live.sh
```

`.env` の接続情報を読んでビルドし、`gungun-dev-app` に出します。
secret key が成果物に混ざっていないかを最後にチェックしてから公開します。

### モック版（先方デモ用）を作り直す

```bash
npx expo export --platform web
node scripts/inject-web-fonts.mjs
npx wrangler pages deploy dist --project-name=gungun-preview --branch=main
```

`.env` があるとモック版にも接続情報が入ってしまうので、
モック版を作るときは `.env` を一時的に退避してください。

### .env に入れるもの

```
EXPO_PUBLIC_SUPABASE_URL=https://<プロジェクトref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
EXPO_PUBLIC_SKIP_EMAIL_VERIFICATION=true
```

- `.env` は `.gitignore` 済みです
- **`sb_secret_...`（secret key）はアプリ側に入れないこと。** 全権限のキーなので、
  Web バンドルに入ると誰でも他人のデータを読み書きできてしまいます。
  アプリが使うのは publishable key だけで、権限は RLS が制御します
