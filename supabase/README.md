# Supabase（ぐんぐん バックエンド）

`docs/gungun-spec.md` の 2-2（DDL）・3-1〜3-4（ツリー操作RPC）を実体化したもの。
**同じマイグレーションを「ローカル」「開発クラウド」「お客様アカウント」のどこでも流せる**のが要点で、環境移行は再実行するだけ。

## 構成

```
supabase/
  config.toml                  ローカル(supabase start)設定
  migrations/
    0001_schema.sql            テーブル・型・インデックス（spec 2-2）
    0002_functions.sql         トリガ＋RPC（get_ancestors/can_water/detach_children/harvest/plant_seed/water）
    0003_rls.sql               RLS＋app_settings 既定値（肥料額など）
  seed.sql                     デモ用シード（スピーカーの木をRPCで構築）
```

## 設計の芯

- **`items` 1本で「森」を表現**。`parent_id`（NULL=種）/ `root_id`（種＝自分自身）/ `depth`。
- 親子付け（`root_id`/`depth`）は **DBトリガ＋RPC** が確定。アプリ側では組み立てない。
- **水やり = 自分の商品を対象の子として出品**（`water()` RPC）。肥料消費＋通知まで一括。
- 肥料額などの数値は **`app_settings`** から読む（ハードコード禁止）。

## 使い方

### ローカルで動かす（Docker 必要）
```bash
supabase start          # ローカルスタック起動（migrations 自動適用）
supabase db reset       # スキーマ再作成 + seed.sql 投入
```

### 既存プロジェクト / お客様アカウントへ適用
```bash
supabase link --project-ref <ref>
supabase db push        # migrations を順に適用
# seed は開発時のみ。本番は流さない
```

## 移行フロー（開発 → お客様）

1. 開発クラウド（Souzoh org の `gungun-dev`）で検証
2. お客様が Supabase プロジェクトを作成
3. `supabase link` して `supabase db push` → 同一スキーマ・RPCが再現
4. アプリの `EXPO_PUBLIC_SUPABASE_URL` / `ANON_KEY` をお客様プロジェクトに差し替え
