# TestFlight でめたん様に配る（当日の手順）

Apple Developer Program は登録済み。ここからは**最短で2〜3時間**、
待ち時間が長引くと半日みておくのが安全です。**MTG の前日夜〜当日午前に着手**してください。

---

## ⚠ 最初に：接続情報がビルドに入らない罠

`.env` は `.gitignore` に入っているため、**EAS のビルドサーバーには送られません。**
何もしないと、ビルドされたアプリは**モックモード（DBに繋がらない）**になります。

先に EAS 側へ環境変数を登録してください。**publishable キーは公開前提のキーなので、
アプリに埋め込んで問題ありません**（すでに Web 版にも入っています）。

```bash
cd ~/gungun
npx eas login          # 初回のみ
npx eas init           # 初回のみ。プロジェクトIDが app.json に入ります
```

そのうえで、**expo.dev のプロジェクト画面 → Environment variables** に
次の3つを `production` 環境で追加します（画面から入れるのが確実です）。

| 名前 | 値 |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` の同じ行の値 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` の同じ行の値（`sb_publishable_…`） |
| `EXPO_PUBLIC_SKIP_EMAIL_VERIFICATION` | `true` |

> **`sb_secret_…` は絶対に入れないこと。** アプリに入れてはいけないキーです。

---

## 手順

### 1. ビルド（20〜40分。無料枠は待ち行列あり）

```bash
npx eas build --profile production --platform ios
```

- Apple の認証を求められます。**EAS に証明書とプロビジョニングを自動作成させる**のが一番早いです（`Yes` で進む）
- Bundle ID `app.gungun.ios` が Apple 側に無ければ自動で作られます
- 進捗はターミナルか expo.dev のビルド画面で見られます

### 2. App Store Connect へアップロード（5〜10分）

```bash
npx eas submit --platform ios --latest
```

- App Store Connect にアプリのレコードが無ければ、途中で作成を促されます
  （名前・プライマリ言語・SKU を聞かれます）
- 書き出しコンプライアンスの質問は `app.json` に
  `ITSAppUsesNonExemptEncryption: false` を入れてあるので聞かれません

### 3. 処理待ち（10分〜数時間）

App Store Connect → TestFlight にビルドが出て、`処理中` → 配布可能になります。
**ここが読めないので、余裕を持って着手してください。**

### 4. めたん様をテスターに追加

**内部テスト（Internal Testing）を使います。審査が不要なので、処理が終われば即配れます。**

1. App Store Connect → **ユーザーとアクセス** → **＋** でめたん様を招待
   - **めたん様の Apple ID のメールアドレスが必要です**
   - 役割は **App Manager** か **Developer**（内部テスターになれる役割である必要があります）
2. めたん様が招待メールから Apple ID でサインイン
3. TestFlight → **内部テスト** → グループにめたん様を追加 → ビルドを割り当て
4. めたん様の iPhone に **TestFlight**（App Store で無料）を入れてもらう
5. 招待メールから「テスト開始」→ ぐんぐんがインストールされます

> **外部テスト（External Testing）は使わないこと。** Apple のベータ審査が入り、
> 通常1日、混むと2日かかります。明日には間に合いません。

---

## つまずきやすいところ

| 症状 | 原因と対処 |
|---|---|
| アプリが空／ログインできない | EAS の環境変数が未登録。上記「最初に」をやり直してビルドし直す |
| ビルドが証明書エラーで落ちる | `npx eas credentials` で作り直す。EAS に任せるのが確実 |
| TestFlight にビルドが出てこない | 処理中。10分〜数時間。App Store Connect のメールを待つ |
| テスターに配れない | めたん様の役割が内部テスターになれる権限か確認（App Manager / Developer） |
| プッシュ通知が来ない | プッシュ証明書（APNs キー）を EAS に作らせる。`eas credentials` から |

---

## 当日、TestFlight が間に合わなかったときの保険

この2つはいつでも使えます。**両方を用意しておくのが安全です。**

1. **Expo Go ＋トンネル** — `npx expo start --tunnel` で QR を共有。
   同じ Wi-Fi でなくても繋がる。ネイティブの触感が確認できる
2. **Web 版** — `https://gungun-dev-app.pages.dev` を送るだけ。インストール不要

いずれもプッシュ通知は確認できません（TestFlight なら確認できます）。
