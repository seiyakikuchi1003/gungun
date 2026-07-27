# 次に何をするか（Mac 再開用メモ）

最終更新：2026-07-23（クラウドセッションでの作業分）

## Macですぐ再開する手順

```bash
cd ~/gungun
git checkout claude/app-design-mockup-9f1vtu
git pull
npm install          # ★必須：supabase-js など依存が増えています
npx expo start       # QRをExpo Goで読む（SDK 54）
```

- Webで見るだけ：https://gungun-preview.pages.dev
- ブランチは常に `claude/app-design-mockup-9f1vtu`。

## 今の状態

| 層 | 状態 |
|---|---|
| アプリ画面（フロント） | ほぼ完成。全25画面が実装済み・レスポンシブ確認済み |
| データ | **モック**（`src/store/tree.tsx` / `src/data/mock.ts`）で動作中 |
| バックエンド（Supabase） | **設計・検証は完了**。クラウドに未設置 |

### バックエンドの中身（`supabase/`）

- `migrations/0001_schema.sql` … spec 2-2 のDDL（items1本で森を表現）＋ `app_settings`
- `migrations/0002_functions.sql` … トリガ＋RPC（`get_ancestors` / `can_water` / `detach_children` / `harvest` / `plant_seed` / `water`）
- `migrations/0003_rls.sql` … RLS土台＋肥料額などの既定値
- `seed.sql` … デモの木をRPC経由で構築

**検証済み**：仕様書のPhase-1テスト全17項目をローカルPostgresで実行し全PASS
（種植え／水やりの親子付け、can_waterの4条件、収穫の玉突きの輪、枝の独立、1種1収穫、削除、深い木のroot/depth再計算、肥料消費・台帳・通知）。

## 未完了：クラウドDBの設置（要・人手）

Souzoh Org が**無料プロジェクト上限（2つ）**のため `gungun-dev` を作成できていない。
既存の `souzoh-rental-app` / `souzoh-CRM` は本番のため触らない。

### 選択肢
- **A. 新しいOrgを作る（実質無料）** — Supabase管理画面で新規Organization作成 → 無料プロジェクト作成
- **B. Souzoh OrgをProへ（$25/月〜）** — 既存Orgをアップグレード

### 器ができた後の手順（自動化済み）
```bash
supabase link --project-ref <ref>
supabase db push            # migrations を適用
# 開発用にデモデータを入れる場合のみ
psql "<connection string>" -f supabase/seed.sql
```
その後 `.env` に以下を設定すればアプリが実DBに切り替わる（未設定の間はモックのまま動く）：
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## 次にやる候補

1. **モック → 実RPCへの配線**：`src/store/tree.tsx` を `src/lib/api/gungun.ts` 経由に。`isSupabaseEnabled` で自動切替する形が用意済み
2. **認証**：ログイン画面を Supabase Auth に接続（今は `src/store/auth.tsx` のモック）
3. 型の自動生成：`supabase gen types typescript` で `src/types/db.ts` を置き換え

## 補足

- 金額・肥料量はハードコード禁止。`app_settings` テーブル（DB側）と `src/config/settings.ts`（モック側）から読む
- ツリーの親子付け（`root_id`/`depth`）は必ずDB側（トリガ＋RPC）で確定させる。アプリ側で組み立てない
