# 実機で確認する（Expo Go）

## 先に知っておくこと

**この作業は菊池さんの Mac で行う必要があります。**
クラウドの作業環境からは Expo のホスト（`expo.dev` / `exp.host` / ngrok）へ出られないため、
実機への配信ができません。トンネル（`--tunnel`）も EAS Update も同じ理由で使えません。

Mac 側での所要時間は、`npm install` 済みなら **2〜3分**です。

---

## 手順

### 0. 先に DB を用意する（初回だけ）

まだなら `supabase/apply_all.sql` を Supabase の SQL Editor で実行してください。
手順は [`DB-TEST.md`](./DB-TEST.md)。

### 1. 最新を取ってくる

```bash
cd ~/gungun
git checkout claude/app-design-mockup-9f1vtu
git pull
npm install          # 依存が増えています（expo-notifications / expo-device）
```

### 2. DB につながるか先に確認する

```bash
npm run check:supabase
```

テーブル・ビュー・設定・デモデータ・RPC・RLS・課金の安全性を順に見て、日本語で結果を出します。
**ここが全部 ✓ になってから実機に進んでください。** アプリが空に見える原因の切り分けが楽になります。

### 3. 実機で開く

```bash
npm run device
```

`.env` が無ければ接続情報を聞かれます（Supabase の Project Settings → API Keys）。
入力するのは **publishable キー**（`sb_publishable_...`）です。
secret キーを入れると止まります — アプリに入れてはいけないキーなので。

そのあと：

1. iPhone に **Expo Go** を入れて、**Mac と同じ Wi-Fi** につなぐ
2. ターミナルに出る **QR コードを iPhone のカメラで読む**
3. ログイン画面に **「● 実データ（Supabase）に接続中」** が出ていれば成功

DB を触らずに画面だけ見たいときは：

```bash
npm run device:mock
```

---

## 実データの連動を確認する順番

デモアカウントでログインします（パスワードは全員 `password`）。

| メールアドレス | ニックネーム |
|---|---|
| `metan@example.com` | めたん |
| `takusan@example.com` | たくさん |

2台（または iPhone ＋ Mac のブラウザ）で別アカウントにすると、相手側の反応まで確認できます。

| # | 操作 | DB で見るところ |
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

Supabase の **Table Editor** で見るのが一番早いです。
管理画面（gungun-admin.pages.dev）からも同じデータが見えます。

---

## つまずきやすいところ

### 「○ モックデータ（.env 未読込）」と出る

`.env` が読めていません。`npm run device` は `--clear` を付けているので
キャッシュではなく、`.env` の場所か中身の問題です。プロジェクト直下にあるか確認してください。

### QR を読んでも繋がらない

iPhone と Mac が同じ Wi-Fi にいるか確認してください。
社内ネットワークで端末間通信が禁止されている場合は繋がりません。

### 画面が空っぽ／エラーになる

`npm run check:supabase` を先に走らせてください。
SQL が未適用だと、テーブルが無いので全画面が空になります。

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
