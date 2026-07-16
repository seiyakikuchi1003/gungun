# ぐんぐん 🌱🍊

わらしべ長者をベースにした **C2C物々交換アプリ**（iOSネイティブ）。
不要品を「種」として植え、他ユーザーが「水やり」して交換の連鎖を木構造に育て、
起点の人が「収穫」すると一本道の全員が輪になって一斉交換する。

> **このブランチ（`claude/app-design-mockup`）の位置づけ**
> デザインの方向性を決めるための **UIモック** です。要件定義（`docs/`）の
> ネイティブ技術スタック（Expo / React Native）とデザイントークンに沿って作成し、
> ネイティブ化をそのまま継続できる構成にしています。
> **バックエンド（Supabase・ツリーロジック）は未接続で、ダミーデータで動作します。**

---

## 実装済みのモック画面

提供されたモック画像を忠実に再現：

| 画面 | ルート | 元画像 |
|---|---|---|
| ログイン | `/(auth)/login` | 画像② |
| 新規登録 | `/(auth)/signup` | 画像③ |
| ホーム（5タブ・肥料・みんなの種・楽しみ方） | `/(tabs)` | existing-01 |
| タネを植える（出品フォーム） | `/plant/seed` | 画像④ |
| 商品詳細（カルーセル・元の種・出品者） | `/item/[id]` | 画像⑤ |
| 水やり確認モーダル | 商品詳細内 | 画像⑤ |
| 掲示板／収穫／プレミアム／マイページ | 各タブ | プレースホルダー（準備中表示） |

プレビュー画像は `docs/design-preview/` にあります。

---

## セットアップ / 起動

```bash
npm install
npx expo start        # iOS シミュレータ / Expo Go で確認
npm run web           # ブラウザで確認
```

デザイン確認用のスクリーンショット生成：

```bash
npm run export:web        # dist/ に web ビルド
node scripts/shoot.mjs    # shots/ に各画面を撮影（Playwright）
```

---

## 設計方針・技術スタック

- **Expo (React Native) + TypeScript / iOSのみ**（要件どおり）
- **Expo Router**（`app/` ディレクトリ）
- **react-native-reanimated** … ボタンの押下スケール・画面のフェードイン等の動き
- **react-native-svg** … みかん・双葉・じょうろ・葉の装飾をベクターで自作（画像を貼らず再現）
- **Noto Sans JP**（400/500/700/900）
- デザイントークンは `src/theme/index.ts` に集約（**色・サイズのハードコード禁止**）

### ディレクトリ（AGENTS.md 第4章に準拠）

```
app/            Expo Router の画面（(auth) / (tabs) / item / plant）
src/
  theme/        デザイントークン
  components/
    ui/         共通UI（Button, Card, TextField, ItemCard, BottomNav, BottomSheetModal ...）
    art/        マスコット・装飾のベクター（Mikan, Sprout, WateringCan, LeafDecor, GunGunLogo）
    feature/    機能UI（WaterConfirmSheet ...）
  data/mock.ts  ダミーデータ（seed.sql と同じ世界観）
  config/       課金・肥料の設定値（差し替え可能）
  store/        簡易認証（モック）
docs/           要件定義・仕様・デザインプレビュー
```

---

## モックにあたっての注意（要件との対応）

- **課金の金額はハードコードしていません。** 水やり=200肥料などは `src/config/settings.ts`
  にまとめており、ネイティブ化時に `app_settings` テーブル／環境変数へ差し替える前提です（金額未確定のため）。
- **ランク表示は入れていません**（v1対象外）。商品詳細は評価数・出品数のみ表示。
- **商品画像**は著作物を貼らず、ブランドカラーのプレースホルダー（みかん透かし）を表示。実機では実写真が載ります。
- ツリーロジック（`detach_children`・`harvest` 等の RPC）と Supabase 接続は
  **このモックには含みません**。仕様は `docs/gungun-spec.md` 第2〜3章のとおり、
  ネイティブ実装フェーズで Postgres 関数として実装します。

---

## 次のステップ（デザイン方向性が固まった後）

1. デザインの微調整（色味・余白・動きの確定）
2. `docs/gungun-spec.md` の Phase 1（DDL＋ツリー関数＋pgTAPテスト）を実装
3. 各画面を Supabase の API（`src/features/*/api.ts`）に接続
4. 残りのシート（認証コード・お届け先・取引・評価・検索・掲示板・マイページ詳細）を実装
