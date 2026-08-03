# プッシュ通知

仕様書 Phase 8 / 要件定義 第11章「通知タップで該当ページに遷移する」。

## 全体の流れ

```
アプリ（実機）                     Supabase                    Expo Push API
─────────────                     ────────                    ─────────────
ログイン
  └ registerForPush()
      権限を聞く
      Expo Push Token を取る
      register_push_token() ──▶ push_tokens に保存

                                  水やり・収穫などで
                                  notifications に行が入る
                                  （既存のトリガ／RPC）

                                  Edge Function send-push
                                  （Cron で1〜5分おき）
                                    notifications_to_push を読む ──▶ 送信
                                    pushed_at を埋める        ◀──

通知が届く
  └ タップ
      usePushNavigation
      → notificationRoute() で遷移先を決めて push
```

## 実装の場所

| ファイル | 役割 |
|---|---|
| `src/lib/push.ts` | 権限・トークン取得・DBへの登録／解除。**Web では何もしない** |
| `src/hooks/usePushNavigation.ts` | 通知タップ → 該当ページへ遷移 |
| `src/lib/notificationRoute.ts` | 種類ごとの遷移先。**通知一覧の行タップと共用** |
| `src/store/auth.tsx` | ログイン時に登録、ログアウト／退会時に解除 |
| `supabase/functions/send-push/index.ts` | 送信ワーカー（Edge Function） |
| `supabase/migrations/0009_*.sql` | `push_tokens` / `notifications.pushed_at` / `notifications_to_push` |

### Web で壊れないようにしている理由

`expo-notifications` は実機向けで、Web ビルドに静的 import すると動きません。
`Platform.OS` で分岐したうえで**動的 import** しているので、Metro は別チャンクに切り出し、
Web では一度も読み込まれません（デプロイ後に実測して確認済み）。

**静的 import に変えないでください。** Cloudflare Pages のプレビューが壊れます。

## 二重送信を防ぐ仕組み

`notifications_to_push` ビューは `pushed_at is null` の行だけを出します。
送信ワーカーは**送れたものだけ** `pushed_at` を埋めるので、

- 途中で落ちても、次回は未送信ぶんだけが再度キューに出る（取りこぼさない）
- 一度送ったものは二度出てこない（二重送信しない）

## 端末の持ち主が変わったとき

`push_tokens` の主キーは**トークン**です。同じ端末で別のアカウントにログインし直すと
`register_push_token()` の upsert が持ち主を入れ替えるので、
**前の人に通知が飛び続けることがありません**。

ログアウト時は `unregisterCurrentPush()` でトークンを外します。
これは **サインアウトより前に呼ぶ必要があります**（RPC が `auth.uid()` を使うため）。

アプリを削除された端末のトークンは、Expo が `DeviceNotRegistered` を返した時点で
送信ワーカーが `push_tokens` から削除します（残すと毎回失敗し続けるため）。

---

## 動かすのに必要な作業（未実施）

### 1. EAS プロジェクトIDを設定する

`getExpoPushTokenAsync` にプロジェクトIDが必須です。未設定だとトークンが取れず、
コンソールに警告を出して何もしません。

```bash
npx eas init          # app.json の extra.eas.projectId が入る
```

### 2. development build を作る

**Expo Go では SDK 53 以降プッシュ通知トークンを取得できません。**
実機で確認するには development build か TestFlight が必要です。

```bash
npx eas build --profile development --platform ios
```

### 3. iOS のプッシュ証明書

```bash
npx eas credentials    # Push Notification Key を作る／選ぶ
```

Apple Developer Program の契約が前提です（`docs/NEXT.md` D-2）。

### 4. Edge Function をデプロイして定期実行する

```bash
supabase functions deploy send-push --no-verify-jwt
```

そのうえで Supabase の **Integrations → Cron** から1〜5分おきに呼びます。

> `--no-verify-jwt` を付けるのは Cron から呼ぶためです。
> 代わりに関数側で共有シークレットを検証する形にしてもかまいません。

### 5. 実機で通す

1. 2台（または2アカウント）用意する
2. A が B の商品に水やりする
3. B の端末に通知が届く
4. タップして、その商品の木（`/tree/<商品ID>`）が開くことを確認

---

## いまの状態

- アプリ側の実装：**完了**（`tsc` クリーン、Web ビルドに影響なしを実測）
- DB 側：**完了**（0009。テスト61項目に含まれる）
- 送信ワーカー：**コードは完成、未デプロイ**
- **実機での動作確認：未実施**（development build と Apple の証明書が必要なため）
