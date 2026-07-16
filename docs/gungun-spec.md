# ぐんぐん — 実装仕様書（Claude Code用 SPEC）

> 前提ドキュメント：`gungun-requirements.md`（要件定義 確定版）
> このSPECは「**どう作るか**」を定義する。要件（何を作るか）は上記を参照。
> 納品：2026-08-14 ／ 実装：海野

---

## 0. 最初に読むべきこと

このアプリの難所は**UIではなくツリーロジック**。
**Phase 1（DBスキーマ＋ツリー操作＋テスト）を完成させるまで、画面を書き始めないこと。**
UIから作ると、木構造の都合で全部組み直しになる。

---

## 1. 技術スタック

| 領域 | 採用 |
|---|---|
| アプリ | Expo (React Native) / TypeScript ／ **iOSのみ** |
| DB・認証・ストレージ | Supabase (PostgreSQL) |
| 管理画面 | Next.js App Router + TypeScript + Tailwind ／ Cloudflare Pages |
| メール | Resend（認証コード・一斉送信） |
| 決済 | Stripe（Apple Pay。**金額・導線は未確定のため差し替え可能に**） |
| プッシュ通知 | Expo Notifications |

---

## 2. データモデル（最重要）

### 2-1. 設計の芯

**`items` テーブル1本で「森」を表現する。** 商品＝ノード。

| カラム | 意味 |
|---|---|
| `parent_id` | 水やり先のitem。**NULLなら種（root）** |
| `root_id` | 所属する木の根のitem_id。**種なら自分自身** |
| `depth` | 根からの深さ（種＝0） |

- **種を植える**＝ `parent_id: null, root_id: self, depth: 0`
- **水やり**＝ `parent_id: target.id, root_id: target.root_id, depth: target.depth + 1`

`root_id` を持たせることで「同じ木か」を1クエリで判定できる（再帰なしで済む場面が増える）。

### 2-2. DDL

```sql
-- ユーザー
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,
  avatar_url text,
  bio text,
  fertilizer int not null default 0,          -- 肥料残高
  last_login_bonus_on date,                   -- ログインボーナスの最終付与日
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

-- お届け先（初回出品前に必須）
create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  last_name text not null,
  first_name text not null,
  phone text not null,
  postal_code text not null,
  prefecture text not null,
  city text not null,
  street text not null,
  building text,
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- 商品＝ツリーのノード
create type item_status as enum ('growing', 'trading', 'completed', 'deleted');

create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  name text not null,
  description text,
  category text not null,
  condition text not null,
  status item_status not null default 'growing',
  parent_id uuid references items on delete set null,   -- NULL = 種
  root_id uuid not null,                                -- 種なら自分自身
  depth int not null default 0,
  created_at timestamptz not null default now()
);
create index on items (root_id);
create index on items (parent_id);
create index on items (user_id);
create index on items (status);

create table item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items on delete cascade,
  url text not null,
  sort_order int not null default 0   -- 0 = サムネイル
);

-- 収穫（1つの種につき1回だけ）
create table harvests (
  id uuid primary key default gen_random_uuid(),
  root_item_id uuid not null references items,
  harvested_item_id uuid not null references items,   -- 起点が選んだ商品
  created_at timestamptz not null default now(),
  unique (root_item_id)        -- ★1種1収穫をDB制約で担保
);

-- 玉突き交換の1ペア（発送者→受取者）
create type exchange_status as enum ('pending', 'shipped', 'received');

create table exchanges (
  id uuid primary key default gen_random_uuid(),
  harvest_id uuid not null references harvests on delete cascade,
  item_id uuid not null references items,       -- 送られる商品
  from_user_id uuid not null references profiles, -- 発送者
  to_user_id uuid not null references profiles,   -- 受取者
  status exchange_status not null default 'pending',
  shipped_at timestamptz,
  received_at timestamptz,
  position int not null                          -- 輪の中の順番（0始まり）
);
create index on exchanges (harvest_id);

-- 取引メッセージ
create table messages (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references exchanges on delete cascade,
  sender_id uuid not null references profiles,
  body text not null,
  created_at timestamptz not null default now()
);

-- 評価（1取引につき2件：送った側・受け取った側）
create type rating_type as enum ('communication', 'quality');

create table ratings (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references exchanges on delete cascade,
  rater_id uuid not null references profiles,
  ratee_id uuid not null references profiles,
  type rating_type not null,     -- communication=送った側が評価 / quality=受け取った側が評価
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (exchange_id, rater_id)
);

-- 肥料の増減履歴
create type fertilizer_reason as enum ('login_bonus', 'purchase', 'watering', 'admin');

create table fertilizer_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  amount int not null,             -- 正=付与 / 負=消費
  reason fertilizer_reason not null,
  related_item_id uuid references items,
  created_at timestamptz not null default now()
);

-- 掲示板
create table board_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  body text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references board_posts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table board_likes (
  post_id uuid not null references board_posts on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  primary key (post_id, user_id)
);

-- 商品のお気に入り
create table item_likes (
  item_id uuid not null references items on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  primary key (item_id, user_id)
);

-- ブロック
create table blocks (
  blocker_id uuid not null references profiles on delete cascade,
  blocked_id uuid not null references profiles on delete cascade,
  primary key (blocker_id, blocked_id)
);

-- 通知
create type notification_type as enum
  ('watered', 'harvested', 'shipped', 'received', 'message', 'board_comment');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  type notification_type not null,
  body text not null,
  related_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 欲しいものリスト（プレミアム。v1は表示のみ想定）
create table wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  name text not null,
  sort_order int not null default 0
);

-- 通報
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles,
  target_type text not null,   -- 'item' | 'board_post' | 'board_comment' | 'user'
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);
```

---

## 3. コアロジック（ツリー操作）

**この4つを最初に実装し、テストを通すこと。** 全部Postgres関数（RPC）で実装し、アプリからは呼ぶだけにする（トランザクション整合性のため）。

### 3-1. 祖先ラインの取得

```sql
-- target を含む、root までの祖先ライン
create or replace function get_ancestors(target_id uuid)
returns setof items language sql stable as $$
  with recursive line as (
    select * from items where id = target_id
    union all
    select i.* from items i join line l on i.id = l.parent_id
  )
  select * from line;
$$;
```

### 3-2. 水やり可否の判定

**ルール**：`target` の祖先ライン（target自身〜root）に、自分のitemが1つでもあれば**不可**。
これで「自分の種」「自分が既に乗っている系統」の両方を1発で弾ける。

```sql
create or replace function can_water(p_user_id uuid, p_target_id uuid)
returns boolean language sql stable as $$
  select
    (select status from items where id = p_target_id) = 'growing'
    and not exists (
      select 1 from get_ancestors(p_target_id) a
      where a.user_id = p_user_id
    );
$$;
```

> 検証例：`A(種) → B → D`
> - B が D に水やり → Dの祖先は D,B,A。Bがいる → **不可** ✅
> - B が C（Aの別の子）に水やり → Cの祖先は C,A。Bはいない → **可** ✅
> - A が自分の種に水やり → 祖先にAがいる → **不可** ✅

### 3-3. ノード離脱＝子孫の新root化（★収穫・削除・植え直しで共通）

```sql
-- item_id の「直接の子」を、それぞれ新しい種として独立させる
create or replace function detach_children(p_item_id uuid, p_exclude_id uuid default null)
returns void language plpgsql as $$
declare c record;
begin
  for c in
    select * from items
    where parent_id = p_item_id
      and (p_exclude_id is null or id <> p_exclude_id)
      and status = 'growing'
  loop
    -- 子を根に昇格
    update items set parent_id = null, root_id = c.id, depth = 0 where id = c.id;

    -- その子孫の root_id / depth を付け替え
    with recursive d as (
      select id, 0 as lvl from items where id = c.id
      union all
      select i.id, d.lvl + 1 from items i join d on i.parent_id = d.id
    )
    update items i set root_id = c.id, depth = d.lvl
    from d where i.id = d.id and i.id <> c.id;
  end loop;
end;
$$;
```

- **削除**：`detach_children(削除するitem)` → その後 `status='deleted'`
- **収穫**：パス上の各ノードで `detach_children(node, exclude: パス上の次のノード)`

### 3-4. 収穫（玉突き交換の生成）

```sql
create or replace function harvest(p_root_id uuid, p_target_id uuid)
returns uuid language plpgsql as $$
declare
  v_path uuid[];
  v_harvest_id uuid;
  v_len int;
  i int;
  v_from record;
  v_to record;
begin
  -- 1) root → target の一本道を取得（祖先を辿って反転）
  select array_agg(id order by depth) into v_path
  from get_ancestors(p_target_id);

  v_len := array_length(v_path, 1);
  if v_path[1] <> p_root_id then
    raise exception 'target is not in this tree';
  end if;

  -- 2) 収穫レコード（unique制約で1種1収穫を担保）
  insert into harvests (root_item_id, harvested_item_id)
  values (p_root_id, p_target_id) returning id into v_harvest_id;

  -- 3) パス外の枝を切り離す（＝新しい種として独立）
  for i in 1..v_len loop
    perform detach_children(v_path[i], case when i < v_len then v_path[i+1] else null end);
  end loop;
  -- target自身の子も全部切り離す
  perform detach_children(p_target_id);

  -- 4) パス上のノードを取引中に（他ルートから非表示・水やり不可）
  update items set status = 'trading' where id = any(v_path);

  -- 5) 玉突きの輪を作る：path[i] の品 → path[i+1] の人／最後は path[len] の品 → path[1] の人
  for i in 1..v_len loop
    select * into v_from from items where id = v_path[i];
    select * into v_to   from items where id = v_path[ case when i = v_len then 1 else i + 1 end ];

    insert into exchanges (harvest_id, item_id, from_user_id, to_user_id, position)
    values (v_harvest_id, v_from.id, v_from.user_id, v_to.user_id, i - 1);
  end loop;

  return v_harvest_id;
end;
$$;
```

**玉突きの向き（絶対に間違えないこと）**
`path = [A(root), B, D, F]` のとき：

| 発送者 | 商品 | 受取者 |
|---|---|---|
| A | Aの品 | B |
| B | Bの品 | D |
| D | Dの品 | F |
| F | Fの品 | **A** ← 輪が閉じる |

**各人は必ず1回発送・1回受け取り。**

### 3-5. 発送・受け取りのルール

- 収穫直後、`exchanges` 全件に発送義務の通知を送る
- **「自分が発送完了報告をするまで、自分は受け取り報告できない」**（滞留防止）
  → `exchanges` で `from_user_id = me` のレコードが `shipped` になるまで、`to_user_id = me` のレコードは受け取り不可
- 両者の評価が揃ったら `status = 'received'` かつ item を `completed` に

---

## 4. 実装フェーズ（この順で作る）

| # | 内容 | 完了条件 |
|---|---|---|
| **0** | Expo + Supabase セットアップ、型生成 | アプリが起動しDBに繋がる |
| **1** | **DDL＋3-1〜3-4の関数＋テスト** | 下記テストが全部通る |
| 2 | 認証（メール＋パスワード、Resendでコード送信）、プロフィール | 登録→ログイン→編集ができる |
| 3 | 出品（タネを植える）・水やり・肥料消費・住所必須化 | 木が正しく育つ |
| 4 | ホーム・検索・商品詳細・種の詳細 | 木が正しく見える |
| 5 | **収穫** | 玉突きのexchangesが正しく生成される |
| 6 | 取引（受け取る/送る）・メッセージ・発送/受け取り報告・評価 | 輪が完走できる |
| 7 | 掲示板（投稿・コメント・いいね・通報） | — |
| 8 | マイページ・履歴・通知（プッシュ） | — |
| 9 | 管理画面（Next.js on Cloudflare） | ユーザー/商品/通報の管理 |
| 10 | データ移行（Click版→Supabase）＋再ログイン案内メール | 既存160人が移行できる |

### Phase 1 のテスト（必須）

```
[ ] 種を植える → parent_id=null, root_id=self, depth=0
[ ] 水やり → parent_id=target, root_id=target.root_id, depth=+1
[ ] 自分の種に水やり → 拒否される
[ ] 自分の下流（D・F）に水やり → 拒否される
[ ] 自分と無関係な別の枝（C）に水やり → 許可される
[ ] status が growing でない item に水やり → 拒否される
[ ] 収穫 → path上の人数ぶんのexchangesが生成される
[ ] 収穫 → 最後の1件が「末端の品 → rootの人」になっている（輪が閉じる）
[ ] 収穫 → path外の枝が、新しい種（parent_id=null, root_id=self, depth=0）になる
[ ] 収穫 → path上のitemが trading になり、水やり不可になる
[ ] 同じ種を2回収穫 → unique制約で拒否される
[ ] 途中ノードを削除 → その子が新しい種になり、上流はそのまま
[ ] 深い木（5段以上）で root_id/depth が全て正しく更新される
```

---

## 5. 画面実装

デザインは `sheets/` の画像（既存モック4枚＋GPT生成6シート）を**忠実に再現**する。

- 既存モック：ホーム／商品詳細／種の詳細／収穫／集まった商品一覧／取引（受け取る・送る）
- シート1：ログイン／新規登録／メール認証／パスワード再設定／お届け先の登録
- シート2：タネを植える／水やりする／水やり確認／肥料チャージ／プレミアム
- シート3：さがす／検索結果／掲示板／投稿詳細／新規投稿
- シート4：やり取り・メッセージ／発送完了報告／受け取り報告／評価
- シート5：マイページ／プロフィール編集／個人情報設定／ブロックリスト
- シート6：出品履歴／掲示板投稿履歴／通知

**注意**：画像はあくまで「見た目の正解」。画像をそのまま貼らず、**コンポーネントとして実装**する（商品リストやステータスは動的に変わるため）。

### デザイントークン
| 用途 | 値 |
|---|---|
| 背景 | `#FDF8F0`（クリーム） |
| メイン | `#2E9E5B`（グリーン）＝ボタン・アクティブ・「受け取る」 |
| アクセント | `#F5A623`（オレンジ）＝「送る」・収穫タブ・強調 |
| カード | `#FFFFFF`／角丸16px／淡いシャドウ |
| テキスト | `#333333`／補足はミディアムグレー |
| フォント | Noto Sans JP（見出し太字） |

---

## 6. 通知

| トリガー | 宛先 |
|---|---|
| 水やりされた | 対象itemの出品者 |
| 収穫された（＝発送義務が発生） | 輪の**全員** |
| 発送完了報告 | 受取者 |
| 受け取り報告 | 発送者 |
| 取引メッセージ | 相手 |
| 自分の掲示板投稿にコメント | 投稿者のみ |

---

## 7. 実装上の禁止・注意

- ❌ **Phase 1 を飛ばしてUIから作らない**
- ❌ 収穫・削除・植え直しを**別々のロジックで書かない**（`detach_children` に必ず寄せる）
- ❌ ツリー操作をアプリ側（TS）で組み立てない（**必ずRPC＝DB関数**で。トランザクション整合性のため）
- ⚠️ **課金の金額は未確定**。`fertilizer_ledger` の設計は変えず、**金額・商品IDは環境変数／管理画面から差し替え可能**にする
- ⚠️ **ランクはv1では実装しない**（評価数・出品数の表示のみ）
- ⚠️ **v1対象外**：配送トラブル対応、同一ツリー内の同時収穫、AI検索、コメントのメンション

---

## 8. Claude Code への渡し方（推奨）

1. このSPEC ＋ `gungun-requirements.md` ＋ デザイン画像一式をリポジトリに置く
2. Phase 1 だけを指示：「SPEC の第2章のDDLと第3章の関数を実装し、第4章のテストを全部通して」
3. テストが緑になってから Phase 2 以降へ
4. 画面はシート単位で「この画像を忠実に再現して」と渡す
