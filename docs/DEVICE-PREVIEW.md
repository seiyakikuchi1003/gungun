# 実機プレビュー（アプリ＋管理画面＋実データ）

## 1コマンドで全部立ち上がります

```bash
cd ~/gungun
git checkout claude/app-design-mockup-9f1vtu
git pull
npm run preview
```

これで順に、

1. 依存関係（アプリ・管理画面）を入れる
2. アプリの `.env`（接続先）を作る ← 初回だけ聞かれます
3. **DB に未適用の SQL を流す**（何度実行しても安全）
4. アプリ側から見えるかを確認（`check:supabase`）
5. **管理画面**を http://localhost:3100 で起動（localhost はパスワード不要）
6. **Expo Go 用の QR コード**を出す

まで進みます。Ctrl+C で両方まとめて止まります。

| オプション | 動き |
|---|---|
| `npm run preview` | 実データ（Supabase）につなぐ。アプリ＋管理画面 |
| `npm run preview:mock` | モック。DB を一切触らない（画面デモ用） |
| `npm run preview -- --no-admin` | 管理画面を立てず、アプリだけ |
| `npm run preview -- --skip-db` | DB の適用・確認を飛ばす（2回目以降の時短） |

> **この作業は菊池さんの Mac で行う必要があります。**
> クラウドの作業環境は組織の egress ポリシーで `expo.dev` / `exp.host` /
> ngrok / `*.supabase.co` すべてに出られません（実測：CONNECT 403）。
> トンネルも EAS Update も同じ理由で使えません。

---

## 初回に聞かれること（4つ）

すべて Supabase ダッシュボードからコピーするだけです。入力は `.env` /
`.env.local` / `admin/.env.local` に保存され、2回目以降は聞かれません
（3ファイルとも `.gitignore` 済み）。

| 聞かれるもの | どこから取るか | 備考 |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project Settings → API Keys | `https://xxxx.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 同上 | **publishable** キー（`sb_publishable_…`）。secret を入れると止まります |
| `SUPABASE_DB_URL` | 右上 **Connect** → **Session pooler** の URI | `[YOUR-PASSWORD]` を DB パスワードに置換。空Enterで飛ばせます |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys | **secret** キー（`sb_secret_…`）。管理画面用。空Enterで管理画面を飛ばせます |

`SUPABASE_DB_URL` を入れると SQL の適用まで自動になります。入れない場合は
Supabase の SQL Editor に `supabase/apply_all.sql` を貼って Run してください。

---

## DB だけを操作したいとき

```bash
npm run db:status       # 0001〜0009 のどれが適用済みか
npm run db:apply        # 未適用のぶんだけ流す
npm run db:apply:seed   # デモデータも入れ直す
```

`apply_all.sql`（SQL Editor 用）と違って **何度実行しても安全**です。

- 適用済みのファイル名を `public._gungun_migrations` に記録し、2回目以降は飛ばす
- 1ファイル = 1トランザクション。途中で失敗してもそのファイルの変更は残らない
- すでに SQL Editor で `apply_all.sql` を流してあるプロジェクトでも、
  実体を見て「どこまで入っているか」を判定し、台帳に登録してから続けます
  （0006 までしか入っていない状態から 0007〜0009 を足す、も確認済み）

デモデータは何度流しても増えません（先に消してから入れ直す作り）。

---

## Expo Go で開く

1. iPhone に **Expo Go** を入れて、**Mac と同じ Wi-Fi** につなぐ
2. ターミナルに出る **QR コードを iPhone のカメラで読む**
3. ログイン画面に **「● 実データ（Supabase）に接続中」** が出ていれば成功

デモアカウント（パスワードは全員 `password`）：

| メールアドレス | ニックネーム |
|---|---|
| `metan@example.com` | めたん |
| `takusan@example.com` | たくさん |

2台（または iPhone ＋ Mac のブラウザ）で別アカウントにすると、相手側の反応まで確認できます。

---

## 実データの連動を確認する順番

**上から順に操作すれば一周できる台本を [`WALKTHROUGH.md`](./WALKTHROUGH.md) に用意しました**
（2アカウント・所要20〜30分）。管理画面の各ページの見方は [`ADMIN-GUIDE.md`](./ADMIN-GUIDE.md)。

以下は要点だけの一覧です。アプリで操作 → **管理画面（http://localhost:3100）を再読み込み**すると、
同じデータがそのまま出ます。Supabase の Table Editor でも同じものが見えます。

| # | アプリでの操作 | DB で見るところ |
|---|---|---|
| 1 | タネを植える | `items` に `parent_id = null` の行が増える |
| 2 | 写真を付ける | `item_images` ＋ Storage の `item-images` バケット |
| 3 | 他の人の商品に水やり | `items` に子の行、`profiles.fertilizer` が減る、`fertilizer_ledger` に負の記録、相手に `notifications` |
| 4 | ログインボーナスを受け取る | `profiles.fertilizer` が増える、`last_login_bonus_on` が今日になる |
| 5 | 収穫する | `exchanges` に輪の人数ぶん、選ばれなかった枝は `parent_id = null`（苗木） |
| 6 | 発送・受け取り報告 | `exchanges.status` が `shipped` → `received` |
| 7 | 評価する | `ratings` に2件（送った側・受け取った側） |
| 8 | 掲示板に投稿・コメント | `board_posts` / `board_comments` |
| 9 | 通報・ブロック | `reports` / `blocks` |
| 10 | 退会する | `profiles` から消え、相手の `exchanges` は残って参照だけ NULL |

---

## つまずきやすいところ

### 「○ モックデータ（.env 未読込）」と出る

`.env` が読めていません。`npm run preview` は `--clear` を付けているので
キャッシュではなく、`.env` の場所か中身の問題です。プロジェクト直下にあるか確認してください。

### QR を読んでも繋がらない

iPhone と Mac が同じ Wi-Fi にいるか確認してください。
社内ネットワークで端末間通信が禁止されている場合は繋がりません。

### 画面が空っぽ／エラーになる

`npm run db:status` で 0001〜0009 が全部 ✓ になっているか確認してください。
SQL が未適用だと、テーブルが無いので全画面が空になります。

### `SUPABASE_DB_URL` で「password authentication failed」

Connect ダイアログの URI に含まれる `[YOUR-PASSWORD]` を実際の DB パスワードに
置き換えていない可能性があります。忘れた場合は Project Settings → Database →
Reset database password で作り直せます。

### 管理画面が真っ白／数字が 0

`admin/.env.local` の `SUPABASE_SERVICE_ROLE_KEY` が secret キー（`sb_secret_…`）
になっているか確認してください。publishable キーだと RLS に阻まれて何も見えません。
ログは `.expo/admin-dev.log` に出ます。

### プッシュ通知が来ない

**Expo Go では確認できません。** SDK 53 以降、Expo Go でプッシュ通知トークンを
取得できない仕様になっています。development build が必要です → [`PUSH.md`](./PUSH.md)

### 「ログインできない」

Supabase の Authentication → Sign In / Providers → Email で
**Confirm email を OFF** にしてください（開発中）。
ON のままだと、登録してもメール確認が終わるまでログイン状態になりません。

---

## Expo Go で確認できないもの

| 機能 | 理由 | 確認方法 |
|---|---|---|
| プッシュ通知 | SDK 53 以降 Expo Go 非対応 | development build（[`PUSH.md`](./PUSH.md)） |
| 課金 | 未実装（方式が未確定） | — |
| App Store の挙動 | ビルドが別 | TestFlight |

ハプティクス・効果音・カメラ・写真ライブラリは Expo Go で確認できます。

---

## クラウド側で済ませた事前確認

実機で「赤い画面」に当たらないよう、バンドルまでは作業環境で通してあります。

| 確認したこと | 結果 |
|---|---|
| iOS 向けの本番バンドル（`expo export --platform ios`） | 成功（Hermes バイトコード 5.55 MB） |
| Metro を起動して Expo Go と同じヘッダでマニフェスト取得 | HTTP 200 / SDK 54.0.0 / `launchAsset` あり |
| Expo Go が実際に落とす iOS バンドルを取得 | HTTP 200 / 12.4 MB / `Unable to resolve module` 0件 |
| バンドルに接続情報が入っているか | Supabase URL と publishable キーが埋め込み済み |
| バンドルに secret キーが混入していないか | 混入なし |
| マイグレーション適用スクリプト | ローカル Postgres で4パターン（新規／再実行／`apply_all` 済み／0006 まで）を確認 |
| 管理画面のローカル起動 | `localhost:3100` が 200（パスワード不要で開ける） |
