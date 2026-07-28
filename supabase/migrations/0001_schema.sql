-- ぐんぐん スキーマ定義（docs/gungun-spec.md 2-2 に忠実）
-- 「森」= items テーブル1本。商品＝ノード。parent_id/root_id/depth でツリーを表現。
--
-- このマイグレーションはローカル(supabase start)・開発クラウド・お客様アカウントの
-- どこで流しても同一のスキーマを再現する（＝移行は db push 一発）。

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ── ユーザー ─────────────────────────────────────────────
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

-- ── お届け先（初回出品前に必須）────────────────────────────
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

-- ── 商品＝ツリーのノード ───────────────────────────────────
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
  root_id uuid not null,                                -- 種なら自分自身（トリガで自動設定）
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
create index on item_images (item_id);

-- ── 収穫（1つの種につき1回だけ）────────────────────────────
create table harvests (
  id uuid primary key default gen_random_uuid(),
  root_item_id uuid not null references items,
  harvested_item_id uuid not null references items,   -- 起点が選んだ商品
  created_at timestamptz not null default now(),
  unique (root_item_id)        -- ★1種1収穫をDB制約で担保
);

-- ── 玉突き交換の1ペア（発送者→受取者）─────────────────────
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

-- ── 取引メッセージ ─────────────────────────────────────────
create table messages (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references exchanges on delete cascade,
  sender_id uuid not null references profiles,
  body text not null,
  created_at timestamptz not null default now()
);

-- ── 評価（1取引につき2件：送った側・受け取った側）──────────
create type rating_type as enum ('communication', 'quality');

create table ratings (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references exchanges on delete cascade,
  rater_id uuid not null references profiles,
  ratee_id uuid not null references profiles,
  type rating_type not null,     -- communication=送った側 / quality=受け取った側
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (exchange_id, rater_id)
);

-- ── 肥料の増減履歴 ─────────────────────────────────────────
create type fertilizer_reason as enum ('login_bonus', 'purchase', 'watering', 'admin');

create table fertilizer_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  amount int not null,             -- 正=付与 / 負=消費
  reason fertilizer_reason not null,
  related_item_id uuid references items,
  created_at timestamptz not null default now()
);
create index on fertilizer_ledger (user_id);

-- ── 掲示板 ─────────────────────────────────────────────────
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

-- ── 商品のお気に入り ───────────────────────────────────────
create table item_likes (
  item_id uuid not null references items on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  primary key (item_id, user_id)
);

-- ── ブロック ───────────────────────────────────────────────
create table blocks (
  blocker_id uuid not null references profiles on delete cascade,
  blocked_id uuid not null references profiles on delete cascade,
  primary key (blocker_id, blocked_id)
);

-- ── 通知 ───────────────────────────────────────────────────
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
create index on notifications (user_id);

-- ── 欲しいものリスト（プレミアム。v1は表示のみ想定）─────────
create table wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  name text not null,
  sort_order int not null default 0
);

-- ── 通報 ───────────────────────────────────────────────────
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles,
  target_type text not null,   -- 'item' | 'board_post' | 'board_comment' | 'user'
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ── アプリ設定（肥料額など。★ハードコード禁止の受け皿）──────
-- 金額・肥料量は未確定のため、コードに直書きせずここから読む。
-- 将来は管理画面から差し替え可能にする。
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
