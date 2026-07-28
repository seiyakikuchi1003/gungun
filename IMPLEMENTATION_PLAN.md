# IMPLEMENTATION_PLAN.md — ぐんぐん 実装計画

> **エージェントへ**：この計画に従って Phase 0 から順に実装すること。
> **各Phaseの「完了条件」を満たすまで、次のPhaseに進まないこと。**
> 各Phase完了時に、このファイルのチェックボックスを `[x]` に更新して commit すること。

---

## 進捗

- [ ] Phase 0：環境構築
- [ ] Phase 1：プロジェクトの土台
- [ ] Phase 2：DBスキーマ
- [ ] Phase 3：ツリーロジック（★最重要）
- [ ] Phase 4：ツリーロジックのテスト（★ゲート）
- [ ] Phase 5：デザインシステム
- [ ] Phase 6：共通コンポーネント
- [ ] Phase 7：フォント・アセット
- [ ] Phase 8：ダミーデータ
- [ ] Phase 9：認証画面
- [ ] Phase 10：ホーム画面
- [ ] Phase 11：出品・水やり
- [ ] Phase 12：商品詳細・種の詳細
- [ ] Phase 13：収穫
- [ ] Phase 14：取引・評価
- [ ] Phase 15：検索
- [ ] Phase 16：掲示板
- [ ] Phase 17：マイページ・履歴・通知
- [ ] Phase 18：課金
- [ ] Phase 19：管理画面
- [ ] Phase 20：データ移行

---

## 全Phase共通の絶対ルール

1. **Phase 4（テスト全緑）を満たすまで、Phase 5以降に進まない。**
2. **ツリー操作は必ずPostgres関数（RPC）で実装する。** TypeScript側で組み立てない。
3. **収穫・削除・植え直しは `detach_children` に寄せる。** 別々に実装しない。
4. **色・サイズは `src/theme` のトークンから読む。ハードコード禁止。**
5. **デザイン画像はコンポーネントとして再実装する。** 画像を貼らない（マスコット・装飾のみ画像可）。
6. **課金の金額をハードコードしない。**（未確定のため、設定テーブル or 環境変数から読む）
7. **`docs/gungun-spec.md` が仕様の正。** 迷ったらSPECに戻る。
8. 各Phaseの完了時に **git commit** する。
9. **v1対象外のものを実装しない**：配送トラブル対応／同一ツリー内の同時収穫／ランク／AI検索／掲示板のメンション／Android。
10. **人間の確認が必要な箇所**（後述の🔴マーク）に来たら、**作業を止めて報告する**。

---

# Phase 0：環境構築

## やること
1. 以下がインストールされているか確認し、無ければインストールする
   - Homebrew / Node.js（18以上）/ Supabase CLI / Docker
2. パスワード入力など人間の操作が必要な場合は、指示を出して止まる

## 🔴 人間の確認が必要
- **Docker Desktop の起動**（GUIアプリのため）。インストール後、人間に起動を依頼して待つこと。

## 完了条件
- [ ] `node -v` が 18以上
- [ ] `supabase -v` が表示される
- [ ] `docker ps` がエラーなく通る（Docker起動済み）

---

# Phase 1：プロジェクトの土台

## やること
- Expo（React Native）+ TypeScript + Supabase の土台を構築
- Expo Router（app/ ディレクトリ）
- TypeScript strict モード
- **iOSのみ対象**（Androidの設定は不要）
- `src/lib/supabase.ts` に Supabase クライアント（環境変数から接続）
- `supabase init` でローカルSupabaseをセットアップ
- パッケージ追加：`expo-font`、`expo-linear-gradient`、`expo-image-picker`、`expo-notifications`、`@react-native-async-storage/async-storage`
- `.env.example` に必要な環境変数を列挙
- `.gitignore`（node_modules、.env、.expo など）
- `CLAUDE.md` を作成（中身：「このプロジェクトの規約は AGENTS.md に記載されています。作業前に AGENTS.md と docs/gungun-spec.md を必ず読んでください。」）
- `AGENTS.md` 第4章のディレクトリ構成に従う

**画面もテーブルもまだ作らない。土台だけ。**

## 完了条件
- [ ] `npx supabase start` が成功し、API URL と anon key が `.env` に書き込まれている
- [ ] `npx expo start` が起動する（確認後に停止してよい）
- [ ] git commit 済み

---

# Phase 2：DBスキーマ

## やること
`docs/gungun-spec.md` の**第2-2章のDDL**を `supabase/migrations/` に実装する。

### 厳守
- SPECのDDLをそのまま使う。テーブル名・カラム名を変えない
- `harvests` の `unique (root_item_id)` を必ず入れる（1種1収穫をDB制約で担保）
- `items` の index（root_id, parent_id, user_id, status）を必ず作る
- 全テーブルにRLSを有効化し、ポリシーを書く：
  - `profiles`：全員が読める。自分のみ更新可
  - `items`：status が growing / trading のものは全員が読める。作成者のみ更新・削除可
  - `addresses` / `fertilizer_ledger` / `notifications`：本人のみ
  - `exchanges` / `messages`：当事者（from_user_id または to_user_id）のみ
  - `board_posts` / `board_comments`：全員が読める。作成者のみ削除可
  - `blocks`：本人のみ
- ブロックしたユーザーの item・board_posts が見えなくなるポリシーも入れる
- 新規登録時に `profiles` を作成するトリガー（fertilizer 初期値 0）
- 金額設定用の `app_settings` テーブルを追加（key/value。肥料の価格などを後から変更するため）

## 完了条件
- [ ] `npx supabase db reset` が通る
- [ ] `npx supabase gen types typescript --local > src/types/database.ts` で型が生成される
- [ ] git commit 済み

---

# Phase 3：ツリーロジック（★最重要）

## やること
`docs/gungun-spec.md` の**第3章**を読み、以下4つのPostgres関数を実装する。すべて `security definer`。

1. `get_ancestors(target_id)` — targetからrootまでの祖先ラインを返す
2. `can_water(user_id, target_id)` — 水やり可否の判定
3. `detach_children(item_id, exclude_id)` — 直接の子を新しい種として独立させる
4. `harvest(root_id, target_id)` — 収穫。玉突きのexchangesを生成する

### ★玉突きの向き（絶対に間違えない）
`path = [A(root), B, D, F]` のとき：

| 発送者 | 商品 | 受取者 |
|---|---|---|
| A | Aの品 | B |
| B | Bの品 | D |
| D | Dの品 | F |
| F | Fの品 | **A**（輪が閉じる） |

各人が必ず**1回発送・1回受け取り**。exchanges は path の長さぶん作られる。

### ★水やり可否
`target` の祖先ライン（target自身〜root）に自分のitemが1つでもあれば**不可**。無関係な枝ならOK。

### ★detach_children
収穫・削除・植え直しは**中身が同じ操作**。必ずこの関数に寄せて、別々に実装しない。
子を root に昇格（`parent_id=null, root_id=self, depth=0`）させ、その子孫全員の `root_id` と `depth` を再帰的に更新する。

### ★harvest の手順
1. root→target のパスを取得
2. `harvests` を作成
3. パス上の各ノードで、パス外の子を `detach_children` する
4. パス上のitemを `status='trading'` にする
5. 玉突きの輪で `exchanges` を作る

## 完了条件
- [ ] 4つの関数が作成され、`npx supabase db reset` が通る
- [ ] git commit 済み

---

# Phase 4：ツリーロジックのテスト（★ゲート）

## やること
`supabase/tests/` に pgTAP でテストを書き、**13項目すべてを通す**。

### テストデータの木
```
A(種/ユーザーa)
├─ B(ユーザーb) → D(ユーザーd) → F(ユーザーf)
└─ C(ユーザーc)
```

### テスト項目
1. 種を植える → `parent_id=null, root_id=self, depth=0`
2. 水やり → `parent_id=target, root_id=target.root_id, depth=+1`
3. 自分の種に水やり → `can_water` が false
4. 自分の下流（D・F）に水やり → `can_water` が false
5. 自分と無関係な別の枝（C）に水やり → `can_water` が true
6. status が growing でない item に水やり → `can_water` が false
7. 収穫 → path上の人数ぶんの exchanges が生成される
8. 収穫 → 最後の1件が「末端の品 → rootの人」になっている（輪が閉じている）
9. 収穫 → path外の枝が新しい種になる（`parent_id=null, root_id=self, depth=0`）
10. 収穫 → path上のitemが trading になり、`can_water` が false になる
11. 同じ種を2回収穫 → unique制約で失敗する
12. 途中ノードを削除 → その子が新しい種になり、上流はそのまま
13. 深い木（5段以上）で `root_id`/`depth` が全て正しく更新される

## 完了条件
- [ ] `npx supabase test db` で **13項目すべて緑**
- [ ] git commit 済み

> **★これが緑にならない限り、Phase 5以降に絶対に進まないこと。**
> 1つでも赤があれば、原因を報告して修正を続けること。

---

# Phase 5：デザインシステム

## やること
`docs/design/` の既存モック4枚（existing-01〜04）と、01-login.png、06-plant-seed.png、18-mypage.png を読み、`src/theme/index.ts` にデザイントークンを抽出する。

### 抽出するもの
1. **カラー**：背景（クリーム系）／メインの緑／アクセントのオレンジ／カードの白／テキスト（メイン・サブ・プレースホルダー）／ボーダー／各色の薄い版（案内ボックス背景用）／ステータスバッジ（出品中=緑／取引中=オレンジ／収穫済み=グレー）
2. **タイポグラフィ**：見出し（大・中・小）／本文／キャプション／数値強調（肥料残高など）
3. **スペーシング**（4の倍数）
4. **角丸**（カード・ボタン・バッジ・入力欄）
5. **シャドウ**（iOS用：shadowColor / shadowOffset / shadowOpacity / shadowRadius）

### 厳守
- 画像から実際に読み取れる値を使う。想像で決めない
- 曖昧な箇所はコメントで残す
- `as const` で型安全に

## 🔴 人間の確認が必要
抽出した**緑・オレンジ・クリームのHEX値**を報告し、既存モックと合っているか確認を求めること。

## 完了条件
- [ ] `src/theme/index.ts` が作成されている
- [ ] 抽出根拠（どの画像のどの部分から取ったか）を報告済み
- [ ] git commit 済み

---

# Phase 6：共通コンポーネント

## やること
`src/theme` のトークンを使い、`src/components/ui/` に以下を作る。デザインは `docs/design/` を参照。

1. `Button`（variant: primary（緑）／accent（オレンジ）／outline／text、size: lg／md／sm、loading・disabled対応）
2. `Card`（白い角丸カード。padding と shadow）
3. `TextField`（ラベル＋入力欄。エラー表示・パスワードの目のアイコン）
4. `Badge`（green／orange／gray／premium）
5. `Avatar`（丸いユーザーアイコン。size対応）
6. `NoticeBox`（薄い緑／薄いオレンジの案内ボックス。アイコン＋テキスト）
7. `ItemCard`（商品カード。サムネイル＋商品名＋カテゴリ＋出品者＋木アイコン＋水やり数）
8. `TabBar`（上部タブ切替。アクティブは緑の下線）
9. `BottomNav`（5タブ。**中央の「収穫」はオレンジの円形＋みかんマスコットが一段浮き出た形**。既存モックを正確に再現）
10. `BottomSheetModal`（下から出る白い角丸モーダル。背景は薄暗く）
11. `StarRating`（星5つ。表示・入力両対応）

### 厳守
- 色・サイズは必ず `src/theme` から読む。**ハードコード禁止**
- props で見た目を切り替えられるようにする
- 画像を貼らない。すべてコードで再現
- 文字は必ず `<Text>` で囲む

## 完了条件
- [ ] 11個すべて作成
- [ ] 各コンポーネントがどの画像のどのパーツに対応するかを報告済み
- [ ] git commit 済み

---

# Phase 7：フォント・アセット

## やること
1. **Noto Sans JP** を `expo-font` で読み込み、デフォルトフォントにする（Weight: 400/500/700/900）。読み込み中はスプラッシュ表示。
2. `assets/images/` に必要な画像（みかんマスコット、葉っぱの装飾など、コードで再現できないもの）のリストを作り、**プレースホルダーを用意**する。

## 🔴 人間の確認が必要
必要な画像のファイル名リストを報告し、人間が用意・配置するのを待つ。**ただし、プレースホルダーで動く状態にしてから次に進んでよい。**

## 完了条件
- [ ] フォントが適用されている
- [ ] 必要画像のリストを報告済み
- [ ] git commit 済み

---

# Phase 8：ダミーデータ

## やること
`supabase/seed.sql` にデモ用データを作る。

- ユーザー6人（めたん、さくら、たくさん、ゆう、はる、けんた）
  - **めたん は `demo@gungun.app` / `password123` でログインできるようにする**
- 商品12件（Nintendo Switch、ルイヴィトン バッグ、iPhone15、AirPods Pro、ブランド財布、腕時計、香水、スニーカー、コーヒーメーカー、カメラ、ワイヤレススピーカー、ギフト券）
- 木構造：
  - Nintendo Switch（たくさんの種）に12件つながっている
  - ルイヴィトン バッグ（さくらの種）に8件
  - iPhone15（ゆうの種）に5件
  - AirPods Pro（はるの種）に3件
- めたん は肥料400、種を2つ植えている状態
- 商品画像は `picsum.photos` のダミーURL

## 完了条件
- [ ] `npx supabase db reset` で自動投入される
- [ ] git commit 済み

---

# Phase 9：認証画面

## 対象デザイン
`01-login.png` / `02-signup.png` / `03-verify-code.png` / `04-reset-password.png` / `05-address.png`

## やること
`app/(auth)/` に5画面を実装。

### デザイン再現（全画面共通）
- `src/components/ui/` の共通コンポーネントを使う
- 色・サイズは `src/theme` から読む（ハードコード禁止）
- 画像に写っている要素を、上から順にすべて再現する
- 余白・文字サイズ・角丸・配置を画像に合わせる
- 画像を貼らない（マスコット・装飾のみ画像可）

### 機能
- Supabase Auth のメール＋パスワード認証（**SNSログインは実装しない**）
- 6桁コードは1桁ずつ独立したボックス＋自動フォーカス移動
- 認証コード・パスワードリセットのメールは Resend の Edge Function（`supabase/functions/send-code/`）
- 再送信は60秒クールダウン＋カウントダウン
- **開発環境ではメール認証をスキップできるフラグを用意**（デモ用）
- 規約未同意なら登録ボタン disabled
- お届け先（addresses）は初回出品前に必須

## 🔴 人間の確認が必要
**Phase 9 完了時点で作業を止め、報告すること。**
人間がスクリーンショットを撮り、デザインとの差分を指示する。

## 完了条件
- [ ] 5画面が実装されている
- [ ] 各画面について「再現しきれていない箇所」を正直に報告済み
- [ ] git commit 済み

---

# Phase 10：ホーム画面

## 対象デザイン
`existing-01-home.png`

## やること
`app/(tabs)/index.tsx` と `app/(tabs)/_layout.tsx`（ボトムナビ5タブ）。

### デザイン再現
画像の要素をすべて：検索バー／通知ベル＋取引アイコン（未読の赤ポチ）／肥料残高カード／ログインボーナス案内／「みんなの種」の横スクロール／「ぐんぐんの楽しみ方」3ステップ／「タネを植える（出品する）」の緑ボタン／背景の葉っぱ／ボトムナビ

### 機能
- 「みんなの種」＝ items から `parent_id is null` かつ `status='growing'`
- 各カードに水やり数（＝その item の子の数）
- 肥料残高は `profiles.fertilizer`
- ログインボーナス：1日1回40肥料。`last_login_bonus_on` で二重付与を防ぐ。付与時にトースト
- 他4タブはいったん空の画面でOK

## 🔴 人間の確認が必要
**Phase 10 完了時点で作業を止め、報告すること。** 特に **BottomNav中央（みかんが浮き出る部分）**の再現度を報告。

## 完了条件
- [ ] 実装完了、再現しきれていない箇所を報告済み
- [ ] git commit 済み

---

# Phase 11：出品・水やり

## 対象デザイン
`06-plant-seed.png` / `07-water.png` / `08-water-confirm.png`

## やること
`app/plant/seed.tsx`、`app/plant/water.tsx`、水やり確認モーダル。

### 機能
- 写真は `expo-image-picker` で複数枚（最大10枚）→ Supabase Storage。1枚目がサムネイル（sort_order=0）
- カテゴリー・状態は `BottomSheetModal` で選択
- **タネを植える** → items に `parent_id=null, root_id=self, depth=0`
- **水やり** → `can_water()` で判定してから items 作成（`parent_id=target, root_id=target.root_id, depth=+1`）
- 肥料を消費し `fertilizer_ledger` に記録（負の値、reason='watering'）
- 肥料不足ならチャージ画面へ誘導するモーダル
- 水やり成功で、対象itemの出品者に通知
- お届け先が未登録なら登録画面へ誘導
- **★肥料の金額（200）はハードコードせず、`app_settings` から読む**

## 完了条件
- [ ] 実装完了、再現しきれていない箇所を報告済み
- [ ] git commit 済み

---

# Phase 12：商品詳細・種の詳細

## 対象デザイン
`existing-02-item-detail.png`

## やること
`app/item/[id].tsx`、`app/item/root/[id].tsx`

### 機能
- 写真カルーセル（スワイプ、タップで拡大）
- いいね（`item_likes`）のトグル。一覧からも押せる
- 出品者情報（アイコン・名前・評価数・出品数）→ プロフィールへ
- 「元の種」は `root_id` から取得。「木全体の商品数」は同じ `root_id` の item 数
- 「植えている人が欲しいもの（プレミアム限定公開）」の横スクロール
- 水やりボタンは `can_water()` で判定。不可なら disabled ＋ 理由を表示
- **★ランクは表示しない**（既存画像にある「ランクB」等は省く。v1対象外）
- status が trading / completed の item は開けない

## 完了条件
- [ ] 実装完了、再現しきれていない箇所を報告済み
- [ ] git commit 済み

---

# Phase 13：収穫

## 対象デザイン
`existing-03-harvest.png`

## やること
`app/(tabs)/harvest.tsx`、`app/harvest/[rootId].tsx`、商品詳細の「この商品を収穫する」

### 機能
- 収穫できるのは、その種を植えた本人のみ
- 収穫 → **`harvest(root_id, target_id)` を RPC で呼ぶだけ**（★アプリ側でツリーを組み立てない）
- 成功したら、輪の全員に「発送してください」の通知
- 既に収穫済みの種は収穫不可（UIでも制御）
- 収穫成功時にみかんマスコットの演出

### 追加テスト
- 収穫後、パス外の枝が新しい種として独立しているか
- exchanges が輪になっているか（最後が「末端の品→rootの人」）

## 完了条件
- [ ] 実装完了、追加テストが緑
- [ ] git commit 済み

---

# Phase 14：取引・評価

## 対象デザイン
`existing-04-exchange.png` / `14-exchange-message.png` / `15-ship-report.png` / `16-receive-report.png` / `17-rating.png`

## やること
`app/(tabs)/exchange.tsx`、`app/exchange/[id].tsx`、各モーダル、`app/exchange/[id]/rating.tsx`

### 機能
- 「受け取る商品」＝ exchanges で `to_user_id = 自分`（緑）
- 「送る商品」＝ exchanges で `from_user_id = 自分`（オレンジ）
- タブ切替＋スワイプ切替
- **★発送しないと受け取れない**：自分が `from_user_id` のレコードが shipped になるまで、`to_user_id` のレコードの受け取り報告を disabled にし、理由を表示
- メッセージは `messages`。Supabase Realtime で即時反映。システムメッセージも表示
- 発送完了報告 → `status='shipped'`, `shipped_at`、受取者に通知
- 受け取り報告 → `status='received'`, `received_at`、発送者に通知、評価へ誘導
- **評価は2種類**：送った側 → `communication`（やり取りの円滑さ）／受け取った側 → `quality`（商品の質）
- 両者の評価が揃ったら item を `completed` に
- 下部の「受け取りの流れ」「発送の流れ」の図解も再現

## 完了条件
- [ ] 実装完了、再現しきれていない箇所を報告済み
- [ ] git commit 済み

---

# Phase 15：検索

## 対象デザイン
`09-search.png` / `10-search-result.png`

### 機能
- items の name / description の部分一致
- 最近の検索は AsyncStorage（最大5件）
- カテゴリー絞り込み、並び替え（新着順／水やり数順）
- `status='growing'` のみ表示
- ブロックしたユーザーの商品は非表示

## 完了条件
- [ ] 実装完了、報告済み、git commit 済み

---

# Phase 16：掲示板

## 対象デザイン
`11-board.png` / `12-board-detail.png` / `13-board-new.png`

### 機能
- 投稿・コメント・いいね・削除・通報
- **自分の投稿にコメントがついた時のみ**プッシュ通知
- ブロックしたユーザーの投稿・コメントは非表示
- **★メンション機能は実装しない**（v1対象外）

## 完了条件
- [ ] 実装完了、報告済み、git commit 済み

---

# Phase 17：マイページ・履歴・通知

## 対象デザイン
`18-mypage.png` / `19-profile-edit.png` / `20-item-history.png` / `21-board-history.png` / `22-block-list.png` / `23-account-settings.png` / `24-notifications.png`

### 機能
- 統計：植えたタネ数（`parent_id is null`）／水やり数（`parent_id is not null`）／収穫数
- 星評価は `ratings` の平均
- 通知設定のトグルは `profiles` に保存し、プッシュ送信時に参照
- プッシュ通知は `expo-notifications`。トークンを `profiles` に保存
- 通知の種類：水やり／収穫／発送完了／受け取り完了／メッセージ／掲示板コメント
- 通知タップで該当画面へ
- **★ランクは表示しない**（評価数・出品数のみ）

## 完了条件
- [ ] 実装完了、報告済み、git commit 済み

---

# Phase 18：課金

## 対象デザイン
`25-premium.png` / `26-fertilizer.png`

### 機能
- Stripe（`@stripe/stripe-react-native`）で Apple Pay 決済
- 成功したら `fertilizer_ledger` に記録（reason='purchase'）
- グラデーションは `expo-linear-gradient`

### ★最重要：金額は未確定
- 価格・肥料量・プレミアム料金は、すべて **`app_settings` テーブルまたは環境変数から読む**
- **ハードコード禁止**
- 管理画面から変更できる前提
- 設定が空なら画面に「¥---」を表示

## 完了条件
- [ ] 実装完了、金額の差し替え方法を報告済み
- [ ] git commit 済み

---

# Phase 19：管理画面

## やること
`admin/` に Next.js App Router + TypeScript + Tailwind。Cloudflare Pages にデプロイできる構成。

### 機能
- 管理者ログイン（Supabase Auth、admin ロールのみ）
- ユーザー一覧・詳細（凍結・肥料の手動付与）
- 商品一覧・詳細（削除。**★削除時は必ず `detach_children` を呼ぶこと**。直接 delete すると木が壊れる）
- 取引一覧（進行中の輪の状況が見える）
- 掲示板の投稿・コメント管理（削除）
- 通報一覧
- 会社概要・利用規約のテキスト編集（アプリから参照）
- **`app_settings` の編集**（肥料の金額・チャージ価格・プレミアム料金）
- ユーザーへの一斉メール送信（Resend）

## 完了条件
- [ ] 実装完了、報告済み、git commit 済み

---

# Phase 20：データ移行

## やること
`scripts/migrate.ts` に、Click版の既存データを Supabase に移行するスクリプト。

### 前提
- 既存ユーザー約160人
- 移行時、全ユーザーが再ログイン（パスワード再設定）が必要
- **Click側のツリー関係は移行しない**（ユーザーと商品はフラットに移行し、木は新規スタート）

### 要件
- CSVまたはJSONを入力（実データの形式に合わせて調整できるように）
- ユーザー → `auth.users` + `profiles`（パスワードは発行せず、リセット必須の状態）
- 商品 → `items`（すべて `parent_id=null, root_id=self` の「種」として移行）
- 画像 → Supabase Storage
- **dry-run モード**（書き込まず件数だけ出す）
- **冪等性**（2回流しても重複しない）
- 全ユーザーへの再ログイン案内メール一斉送信スクリプト（Resend）

## 完了条件
- [ ] 実装完了、dry-run が動く、報告済み
- [ ] git commit 済み

---

## 詰まったときの方針

- **エラーが出たら**：原因を調べて直す。3回試して直らなければ、状況を報告して人間の指示を仰ぐ
- **仕様が不明瞭なら**：`docs/gungun-spec.md` → `docs/gungun-requirements.md` の順に確認。それでも不明なら**推測せず、人間に質問する**
- **デザインが読み取れないなら**：推測で埋めず、その旨を報告する
- **v1対象外かどうか迷ったら**：AGENTS.md 第7章を確認。書いてあるものは実装しない
