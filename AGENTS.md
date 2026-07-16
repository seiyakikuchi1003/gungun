# AGENTS.md — ぐんぐん プロジェクト規約

> このファイルはコーディングエージェント（Codex / Claude Code）が最初に読む規約です。
> **作業前に必ず `docs/gungun-spec.md` を読むこと。**

---

## 1. このリポジトリについて

**ぐんぐん**は、わらしべ長者をモチーフにした **C2C物々交換アプリ**（iOSネイティブ）。
不要品を「種」として出品し、他ユーザーが「水やり」（＝自分の商品を出して交換希望）することで
交換の連鎖が**木構造**に育ち、起点の人が「収穫」すると**その一本道の全員が輪になって一斉交換**する。

現在Click（ノーコード）で稼働中のものを、ネイティブに作り直すリニューアル案件。
既存ユーザー約160人のデータ移行あり。**納品目標：2026-08-14**。

### 必読ドキュメント（優先順）
| ファイル | 内容 |
|---|---|
| `docs/gungun-spec.md` | **実装仕様（DDL・ツリー関数・実装順）★これが正** |
| `docs/gungun-requirements.md` | 要件定義（何を作るか・確定版） |
| `docs/design/` | デザイン画像（既存モック4枚＋生成シート6枚） |

---

## 2. 絶対に守るルール

1. **Phase 1（DBスキーマ＋ツリー操作＋テスト）が完成するまでUIを書かない。**
   このアプリの難所はUIではなくツリーロジック。UIから作ると全部組み直しになる。
2. **ツリー操作は必ずPostgres関数（RPC）で実装する。** TypeScript側で組み立てない（トランザクション整合性のため）。
3. **収穫・削除・植え直しは `detach_children` に寄せる。** 別々のロジックで書かない（3つとも中身は同じ操作）。
4. **課金の金額をハードコードしない。** 金額・商品IDは環境変数／管理画面から差し替え可能にする（**未確定のため**）。
5. **デザイン画像はコンポーネントとして再実装する。** 画像をそのまま貼らない（リストやステータスは動的に変わる）。
6. **勝手に仕様を追加しない。** 「v1対象外」（第7章）にあるものは実装しない。

---

## 3. 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| アプリ | Expo (React Native) + TypeScript | **iOSのみ**。Androidは対象外 |
| DB・認証・ストレージ | Supabase (PostgreSQL) | RLS必須 |
| 管理画面 | Next.js App Router + TypeScript + Tailwind | Cloudflare Pages |
| メール | Resend | 認証コード・一斉送信 |
| 決済 | Stripe | Apple Pay。**金額未確定** |
| プッシュ通知 | Expo Notifications | |

---

## 4. ディレクトリ構成

```
/
├── AGENTS.md                 ← このファイル
├── CLAUDE.md                 ← 「AGENTS.md を読め」の1行のみ
├── docs/
│   ├── gungun-spec.md        ← 実装仕様（正）
│   ├── gungun-requirements.md
│   └── design/               ← デザイン画像
├── app/                      ← Expo Router の画面
│   ├── (auth)/               ← ログイン・新規登録・認証コード
│   ├── (tabs)/               ← ホーム・掲示板・収穫・プレミアム・マイページ
│   ├── item/                 ← 商品詳細・種の詳細
│   ├── plant/                ← タネを植える・水やり
│   └── exchange/             ← 取引・メッセージ・評価
├── src/
│   ├── components/           ← 再利用UI
│   ├── features/             ← 機能ごとのhooks・API呼び出し
│   ├── lib/supabase.ts
│   └── types/database.ts     ← supabase gen types で自動生成
├── supabase/
│   ├── migrations/           ← DDL
│   ├── functions/            ← Edge Functions
│   └── tests/                ← ★ツリーロジックのテスト
└── admin/                    ← Next.js 管理画面
```

---

## 5. コマンド

```bash
# アプリ
npx expo start                       # 開発サーバ
npm run test                         # テスト

# Supabase
npx supabase start                   # ローカル起動
npx supabase db reset                # マイグレーション再適用
npx supabase test db                 # ★DBテスト（ツリーロジック）
npx supabase gen types typescript --local > src/types/database.ts
```

---

## 6. コーディング規約

- **TypeScript strict**。`any` 禁止。DB型は `supabase gen types` の自動生成を使う
- 関数コンポーネント＋Hooks。クラスコンポーネント不可
- データ取得は `src/features/<機能>/api.ts` に集約。画面から直接 supabase を叩かない
- UIテキストは**日本語直書き**でOK（v1は日本のiOSのみ。i18nしない）
- コミットメッセージは日本語可。1コミット1目的

### 用語の統一（コード内の命名）

世界観の言葉と実装の対応。**必ずこの英語名を使う**。

| 日本語（UI） | コード上の名前 | 意味 |
|---|---|---|
| 種を植える | `plantSeed` / `seed` | 出品（`parent_id = null`） |
| 水やり | `water` / `watering` | 交換希望＋自分の商品を出品 |
| 収穫 | `harvest` | 取引成立 |
| 肥料 | `fertilizer` | ポイント |
| 木・枝 | `tree` / `branch` | 商品の連なり |
| 元の種 | `root` | ツリーの根（`root_id`） |
| 取引 | `exchange` | 玉突きの1ペア（発送者→受取者） |

---

## 7. v1対象外（実装しない）

- 配送トラブル（未発送・未着）の対応ルール
- 同一ツリー内での複数同時収穫（**1つの種につき収穫は1回のみ**）
- ランク（A/B等）の算出・表示
- AI検索・写真からの出品補助
- 掲示板コメントのメンション機能
- Android対応

---

## 8. 特に間違えやすい箇所

### 玉突きの向き
`path = [A(root), B, D, F]`（AがFを収穫）のとき：

| 発送者 | 商品 | 受取者 |
|---|---|---|
| A | Aの品 | B |
| B | Bの品 | D |
| D | Dの品 | F |
| F | Fの品 | **A**（輪が閉じる） |

- **水やりの向き**：子 → 親（BはAが欲しいからAに水やり）
- **品物の向き**：親 → 子（Aは自分の品を、水やりした子Bに渡す）
- **各人は必ず1回発送・1回受け取り**

### 水やりの可否
`target` の**祖先ライン（target自身〜root）に自分のitemが1つでもあれば不可**。
これで「自分の種」「自分が既に乗っている系統」を両方弾ける。無関係な枝はOK。

### 発送と受け取りの順序
**自分が発送完了報告をするまで、自分は受け取り報告できない**（滞留防止のため）。
