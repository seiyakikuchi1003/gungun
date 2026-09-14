# 実機テストの自動化

Web 版は実機と同じコードなので、画面操作で確かめる項目はここで回せる。
1手順ごとに「スクリーンショット・画面に出ている文字・コンソールのエラー」を残すので、
合否だけでなく「ここは戸惑う」の洗い出しにも使う。

| ファイル | 役割 |
|---|---|
| `walk.mjs` | 全画面を一周して記録する（27画面） |
| `flow.mjs` | **2アカウントで交換の輪をひと回りする**（出品→水やり→収穫→発送→受け取り→評価） |
| `lib.mjs` | ブラウザ・ログイン・記録・押下の共通部品 |

## 使い方

```bash
# モック版（キー不要・全画面を見るだけ。データは作られない）
EXPO_NO_DOTENV=1 npx expo export --platform web --clear --output-dir /tmp/qa-mock
npx serve -s -l 4600 /tmp/qa-mock &
node scripts/qa/walk.mjs http://localhost:4600

# dev の実データ版（輪をひと回りする。ここが本番）
EXPO_NO_DOTENV=1 \
  EXPO_PUBLIC_SUPABASE_URL=https://bypjhlfcqzebmukwzthi.supabase.co \
  EXPO_PUBLIC_SUPABASE_ANON_KEY=$(grep ANON_KEY .env.dev | cut -d= -f2) \
  npx expo export --platform web --clear --output-dir /tmp/qa-dev
npx serve -s -l 4601 /tmp/qa-dev     # ★ 実際に使われたポートを必ず確認する
node scripts/qa/flow.mjs http://localhost:<実際のポート>
```

`CHROME_PATH` は既定で `/Applications/Google Chrome.app/...` を見る。

## 落とし穴（すべて実際に踏んだもの）

- **`serve` は指定ポートが空いていないと黙って別ポートに逃げる。**
  古いセッションのサーバが残っていて、そちらに繋いで「画面が出ない」と延々悩んだ。
  起動後に出る `Accepting connections at ...` を必ず読む。
- **セレクタには `>> visible=true` を必ず付ける。** RN Web は同じ文字を非表示の要素にも
  持っている（ピッカーの選択肢が典型）。付けないと見えていない方を掴んで永久に待つ。
- **`innerText` は `display:none` の中身まで返す。** 「開いた後に増えた行」で
  ピッカーの選択肢を探す、といった判定が壊れる。`visibleText()` を使う。
- **同じ文字が見出しとボタンの両方にある**（「タネを植える」「収穫する」）。
  `tap(..., { last: true })` で後ろを選ぶ。ヘッダーを押していても例外は出ないので気づきにくい。
- **押せる祖先まで登らない。** 行より大きな親の中心を押して外す。文字そのものを押せば
  Pressable まで伝わる。
- **例外が出なくても成立していない。** 収穫も発送も「押したつもり」で通過していた。
  画面の文字で結果を確かめ、最後は必ず DB を見る（下記）。
- **前回の実行ぶんのデータが一覧に残る。** 取引一覧から商品を選ぶときは、
  今回の実行の商品名で必ず絞る。
- **`.env` を `mv` で退避しない。** 退避中に `git add -A` すると本番キーをコミットしかける
  （2026-09-09 に実際に起きた）。`EXPO_NO_DOTENV=1` で足りる。
- **`--clear` は必須。** Metro のキャッシュに前回の `EXPO_PUBLIC_*` が残る。ビルド後に
  `grep -rl 'vrgpbtyflrtsmxonmuwg' <out>/_expo/static/js/web/*.js` が 0 件かを必ず見る。

## 結果の確かめ方（DB）

```bash
node -e "…"   # SUPABASE_DB_URL（.env.local）は dev を指している
select i.name, e.status, e.shipped_at, e.received_at from exchanges e join items i on i.id=e.item_id where i.name like 'QA%';
select name, status from items where name like 'QA%';
```

ひと回り成功した状態＝取引が `received`、商品が `completed`、評価が2人ぶん入る。

## Web で確かめられないもの（実機でしか見られない）

プッシュ通知・カメラ撮影・Apple Pay・`adjustsFontSizeToFit`（iOS/Android だけの機能）。
郵便番号からの住所自動入力も、Web では CORS で弾かれるため実機で見る必要がある。

## dev のデモユーザー

`supabase/seed_demo.sql` が入れる6人。パスワードはいずれも `password`、メール確認済み。

`haru@` / `metan@` / `sakura@` / `yu@` / `takusan@` / `kenta@` （すべて `example.com`）

## テストデータの掃除

`flow.mjs` は `QAタネ HHMM` / `QA水やり HHMM` という名前で出品する。溜まってきたら消す。

```sql
delete from items where name like 'QA%';
```
