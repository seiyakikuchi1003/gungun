-- ============================================================================
-- ぐんぐん：データベース一括セットアップ
--
-- Supabase の SQL Editor に貼り付けて実行すれば、テーブル・関数・RLS・
-- 初期設定・デモデータまで全部そろいます。
--
-- 実行順に 0001〜0009 のマイグレーションと、最後にデモデータを並べてあります。
--
-- ⚠ 実行は 1 回だけにしてください。
--   型（create type）やテーブルの作成は「既にあれば飛ばす」書き方になっていないため、
--   2回目は「already exists」で止まります（データは壊れません）。
--   作り直したいときは、最後の「デモデータ」の部分だけを流し直してください。
--
-- ⚠ SQL Editor は service_role 権限で動きます。実行前に、接続先のプロジェクトが
--   「gungun-dev」であることを必ず確認してください。
-- ============================================================================


-- ============================================================================
-- ▼ 0001_schema.sql
-- ============================================================================
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


-- ============================================================================
-- ▼ 0002_functions.sql
-- ============================================================================
-- ぐんぐん コアロジック（ツリー操作）
-- docs/gungun-spec.md 3-1〜3-4 に忠実。ツリーの親子付けは必ずDB側（RPC）で行う。
-- アプリからは呼ぶだけ（トランザクション整合性のため）。

-- ── 設定ヘルパー（app_settings から int を読む。ハードコード禁止対応）──
create or replace function get_setting_int(p_key text)
returns int language sql stable as $$
  select (value #>> '{}')::int from app_settings where key = p_key;
$$;

-- ── ツリー自動設定トリガ ───────────────────────────────────
-- 種（parent_id=null）: root_id=自分自身, depth=0
-- 水やり（parent_id指定）: root_id=親のroot_id, depth=親.depth+1
-- ※ id は列デフォルト(gen_random_uuid)で BEFORE INSERT 時点で既に確定している
create or replace function set_item_tree()
returns trigger language plpgsql as $$
begin
  if new.parent_id is null then
    new.root_id := new.id;
    new.depth := 0;
  else
    select p.root_id, p.depth + 1 into new.root_id, new.depth
    from items p where p.id = new.parent_id;
    if new.root_id is null then
      raise exception 'parent item % not found', new.parent_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_set_item_tree
  before insert on items
  for each row execute function set_item_tree();

-- ── 3-1. 祖先ラインの取得（target を含む、root までの祖先）──
create or replace function get_ancestors(target_id uuid)
returns setof items language sql stable as $$
  with recursive line as (
    select * from items where id = target_id
    union all
    select i.* from items i join line l on i.id = l.parent_id
  )
  select * from line;
$$;

-- ── 3-2. 水やり可否の判定 ──────────────────────────────────
-- target の祖先ライン（target自身〜root）に自分のitemが1つでもあれば不可。
create or replace function can_water(p_user_id uuid, p_target_id uuid)
returns boolean language sql stable as $$
  select
    (select status from items where id = p_target_id) = 'growing'
    and not exists (
      select 1 from get_ancestors(p_target_id) a
      where a.user_id = p_user_id
    );
$$;

-- ── 3-3. ノード離脱＝子孫の新root化（収穫・削除・植え直しで共通）──
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

-- ── 種を植える（出品）─────────────────────────────────────
-- parent_id=null の item を作成。root_id/depth はトリガが設定。
create or replace function plant_seed(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_condition text,
  p_images text[] default '{}'
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
  i int;
begin
  insert into items (user_id, name, description, category, condition)
  values (p_user_id, p_name, p_description, p_category, p_condition)
  returning id into v_id;

  if p_images is not null then
    for i in 1 .. coalesce(array_length(p_images, 1), 0) loop
      insert into item_images (item_id, url, sort_order)
      values (v_id, p_images[i], i - 1);
    end loop;
  end if;

  return v_id;
end;
$$;

-- ── 水やり（＝自分の商品を対象の子として出品）───────────────
-- watering-fix 指示書の核心：水やりは必ず自分の商品の出品を伴う。
-- 1) can_water で可否判定 2) 肥料残高チェック（設定から読む）
-- 3) 子ノード作成 4) 画像 5) 肥料消費＋台帳 6) 対象出品者へ通知
create or replace function water(
  p_user_id uuid,
  p_target_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_condition text,
  p_images text[] default '{}'
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
  v_cost int;
  v_balance int;
  v_target items;
  i int;
begin
  if not can_water(p_user_id, p_target_id) then
    raise exception 'cannot water this item (can_water=false)';
  end if;

  select * into v_target from items where id = p_target_id;

  v_cost := coalesce(get_setting_int('water_cost'), 0);
  select fertilizer into v_balance from profiles where id = p_user_id;
  if v_balance < v_cost then
    raise exception 'insufficient fertilizer: balance=% cost=%', v_balance, v_cost;
  end if;

  -- 子ノード作成（root_id/depth はトリガが親から継承）
  insert into items (user_id, name, description, category, condition, parent_id)
  values (p_user_id, p_name, p_description, p_category, p_condition, p_target_id)
  returning id into v_id;

  if p_images is not null then
    for i in 1 .. coalesce(array_length(p_images, 1), 0) loop
      insert into item_images (item_id, url, sort_order)
      values (v_id, p_images[i], i - 1);
    end loop;
  end if;

  -- 肥料消費＋台帳
  update profiles set fertilizer = fertilizer - v_cost where id = p_user_id;
  insert into fertilizer_ledger (user_id, amount, reason, related_item_id)
  values (p_user_id, -v_cost, 'watering', v_id);

  -- 対象商品の出品者へ通知
  insert into notifications (user_id, type, body, related_id)
  values (v_target.user_id, 'watered',
          v_target.name || ' に水やりがありました', v_id);

  return v_id;
end;
$$;

-- ── 3-4. 収穫（玉突き交換の生成）──────────────────────────
create or replace function harvest(p_root_id uuid, p_target_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_path uuid[];
  v_harvest_id uuid;
  v_len int;
  i int;
  v_from record;
  v_to record;
begin
  -- 1) root → target の一本道を取得（祖先を辿って深さ順）
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
  for i in 1 .. v_len loop
    perform detach_children(v_path[i], case when i < v_len then v_path[i + 1] else null end);
  end loop;
  -- target自身の子も全部切り離す
  perform detach_children(p_target_id);

  -- 4) パス上のノードを取引中に（他ルートから非表示・水やり不可）
  update items set status = 'trading' where id = any(v_path);

  -- 5) 玉突きの輪：path[i]の品 → path[i+1]の人／最後は path[len]の品 → path[1]の人
  for i in 1 .. v_len loop
    select * into v_from from items where id = v_path[i];
    select * into v_to   from items where id = v_path[ case when i = v_len then 1 else i + 1 end ];

    insert into exchanges (harvest_id, item_id, from_user_id, to_user_id, position)
    values (v_harvest_id, v_from.id, v_from.user_id, v_to.user_id, i - 1);
  end loop;

  -- 6) 発送義務の通知
  insert into notifications (user_id, type, body, related_id)
  select from_user_id, 'harvested', '収穫が成立しました。発送をお願いします', v_harvest_id
  from exchanges where harvest_id = v_harvest_id;

  return v_harvest_id;
end;
$$;


-- ============================================================================
-- ▼ 0003_rls.sql
-- ============================================================================
-- ぐんぐん RLS（行レベルセキュリティ）とアプリ設定の既定値
--
-- 方針：
--  - 公開マーケット的に「読める」ものは全員読み取り可（items/profiles/掲示板など）
--  - 個人情報系（住所・通知・肥料台帳・取引・評価）は本人のみ
--  - ツリー操作や他ユーザーへの書き込みを伴う処理は RPC（security definer）で実施し
--    RLS をバイパスする。ここでは「アプリが直接叩く read / 単純な own-row write」を許可。
--  ※ 認証（Phase 2）実装時にポリシーを精緻化する前提の“土台”。

-- ── アプリ設定の既定値（未確定・後で管理画面から変更可能）──
insert into app_settings (key, value) values
  ('water_cost',        '200'::jsonb),
  ('daily_login_bonus', '40'::jsonb),
  ('first_seed_free',   'true'::jsonb)
on conflict (key) do nothing;

-- ── RLS 有効化 ─────────────────────────────────────────────
alter table profiles           enable row level security;
alter table addresses          enable row level security;
alter table items              enable row level security;
alter table item_images        enable row level security;
alter table harvests           enable row level security;
alter table exchanges          enable row level security;
alter table messages           enable row level security;
alter table ratings            enable row level security;
alter table fertilizer_ledger  enable row level security;
alter table board_posts        enable row level security;
alter table board_comments     enable row level security;
alter table board_likes        enable row level security;
alter table item_likes         enable row level security;
alter table blocks             enable row level security;
alter table notifications      enable row level security;
alter table wishlists          enable row level security;
alter table reports            enable row level security;
alter table app_settings       enable row level security;

-- ── 公開読み取り（マーケット表示に必要）────────────────────
create policy read_all_profiles      on profiles       for select using (true);
create policy read_all_items         on items          for select using (status <> 'deleted');
create policy read_all_item_images   on item_images    for select using (true);
create policy read_all_item_likes    on item_likes     for select using (true);
create policy read_all_board_posts   on board_posts    for select using (true);
create policy read_all_board_comments on board_comments for select using (true);
create policy read_all_board_likes   on board_likes    for select using (true);
create policy read_all_harvests      on harvests       for select using (true);
create policy read_all_settings      on app_settings   for select using (true);

-- ── 本人のみ読み取り（個人情報系）──────────────────────────
create policy own_addresses   on addresses         for select using (auth.uid() = user_id);
create policy own_ledger      on fertilizer_ledger for select using (auth.uid() = user_id);
create policy own_notifications on notifications    for select using (auth.uid() = user_id);
create policy own_wishlists   on wishlists          for select using (auth.uid() = user_id);
-- 取引・メッセージ・評価は当事者のみ
create policy party_exchanges on exchanges for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy party_messages on messages for select
  using (exists (
    select 1 from exchanges e
    where e.id = messages.exchange_id
      and (auth.uid() = e.from_user_id or auth.uid() = e.to_user_id)
  ));
create policy party_ratings on ratings for select
  using (auth.uid() = rater_id or auth.uid() = ratee_id);

-- ── 本人による単純な書き込み（own-row write）────────────────
create policy update_own_profile on profiles for update using (auth.uid() = id);

create policy write_own_addresses on addresses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy like_items on item_likes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy write_own_board_posts on board_posts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy write_own_board_comments on board_comments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy like_board on board_likes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy write_own_blocks on blocks for all
  using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create policy read_own_notifications_update on notifications for update
  using (auth.uid() = user_id);

create policy write_own_reports on reports for insert
  with check (auth.uid() = reporter_id);


-- ============================================================================
-- ▼ 0004_admin.sql
-- ============================================================================
-- 管理画面（admin/）が必要とする列とテーブル
--
-- 方針：管理画面は service_role キーで RLS を越えて読み書きするため、
-- ここで足すのは「運営が状態を持つための列」だけ。アプリ側の RLS は変更しない。

-- ── 通報の対応状況 ─────────────────────────────────────────
create type report_status as enum ('open', 'resolved', 'dismissed');

alter table reports
  add column status      report_status not null default 'open',
  add column handled_at  timestamptz,
  add column handled_note text;

create index on reports (status);
create index on reports (created_at desc);

-- ── ユーザーの利用停止 ─────────────────────────────────────
-- 停止中は出品・水やり・投稿ができない（RPC 側で弾く）。閲覧は可能。
alter table profiles
  add column is_suspended boolean not null default false,
  add column suspended_reason text;

-- 出品系 RPC は停止ユーザーを弾く
create or replace function assert_not_suspended(p_user uuid)
returns void language plpgsql as $$
begin
  if exists (select 1 from profiles where id = p_user and is_suspended) then
    raise exception '利用が停止されているため、この操作はできません';
  end if;
end $$;

-- ── 運営操作の監査ログ ─────────────────────────────────────
-- 誰が何をしたかを残す。お客様アカウントへ引き継いだ後も追跡できるようにする。
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,             -- 管理画面のログイン名（v1 は 'admin' 固定）
  action text not null,            -- 'suspend_user' | 'delete_item' | 'resolve_report' | 'update_setting' など
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on admin_audit_log (created_at desc);

alter table admin_audit_log enable row level security;
-- 一般ユーザーには一切見せない（service_role のみ RLS をバイパスして読み書きする）

-- ── 管理画面から編集する設定の既定値を追加 ──────────────────
insert into app_settings (key, value) values
  ('premium_price_yen',   '480'::jsonb),
  ('seed_price_yen',      '300'::jsonb),
  ('max_images_per_item', '4'::jsonb)
on conflict (key) do nothing;


-- ============================================================================
-- ▼ 0005_auth.sql
-- ============================================================================
-- サインアップと profiles の連動
--
-- profiles は auth.users を参照する。アプリ側から insert させると
-- 「登録はできたがプロフィールが無い」状態が生まれうるので、
-- ユーザー作成のタイミングで DB 側が必ず1行作る。
-- （0003 の RLS には profiles への insert ポリシーが無い＝クライアントからは作れない設計）

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nickname text;
begin
  -- サインアップ時に渡した nickname を使う。無ければメールのローカル部で仮置き。
  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    split_part(new.email, '@', 1)
  );

  insert into profiles (id, nickname)
  values (new.id, left(v_nickname, 20))
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 退会（自分のアカウントを消す）────────────────────────
-- auth.users を消せば profiles は cascade で消える。
-- クライアントは auth.users を直接触れないので RPC 経由にする。
create or replace function delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'ログインしていません';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;

-- ── 自分のプロフィールを取る（RLS 下でも1発で引けるように）──
create or replace function my_profile()
returns profiles language sql stable as $$
  select * from profiles where id = auth.uid();
$$;


-- ============================================================================
-- ▼ 0006_app.sql
-- ============================================================================
-- アプリを実運用できる状態にするための追加分
--
-- 0001〜0005 で「森」の中核（植える・水やり・収穫）は揃っている。
-- ここでは残りの機能をサーバー側で完結させる：
--   出品の編集/削除・ログインボーナス・発送/受取・評価・掲示板の通知・
--   いいね・画像アップロード（Storage）・一覧用のビュー
--
-- 方針は 0002 と同じ。**整合性が要る処理はすべて RPC（security definer）**にして、
-- クライアントには単純な read と own-row write しか許さない。

-- ══════════════════════════════════════════════════════════
-- 1. 足りていなかった RLS
-- ══════════════════════════════════════════════════════════

-- 取引メッセージ：当事者だけが書ける（読み取りは 0003 で定義済み）
create policy party_write_messages on messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from exchanges e
      where e.id = exchange_id
        and (auth.uid() = e.from_user_id or auth.uid() = e.to_user_id)
    )
  );

-- 評価：自分が付ける側のときだけ書ける
create policy rate_as_rater on ratings for insert
  with check (auth.uid() = rater_id);

-- 通報：自分が出した通報は見えてよい（対応状況の確認用）
create policy read_own_reports on reports for select
  using (auth.uid() = reporter_id);

-- ══════════════════════════════════════════════════════════
-- 2. 出品の編集・削除
-- ══════════════════════════════════════════════════════════
-- items への直接 update/delete は許さない。ツリーの整合性（root_id/depth）が
-- 壊れるため、必ずこの RPC を通す。

create or replace function update_item(
  p_item_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_condition text,
  p_images text[] default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_status item_status;
begin
  select user_id, status into v_owner, v_status from items where id = p_item_id;
  if v_owner is null then raise exception '商品が見つかりません'; end if;
  if v_owner <> auth.uid() then raise exception '自分の出品ではありません'; end if;
  if v_status <> 'growing' then raise exception '取引中の商品は編集できません'; end if;

  update items set
    name        = coalesce(nullif(trim(p_name), ''), name),
    description = p_description,
    category    = p_category,
    condition   = p_condition
  where id = p_item_id;

  -- 画像は差し替え（null なら据え置き）
  if p_images is not null then
    delete from item_images where item_id = p_item_id;
    insert into item_images (item_id, url, sort_order)
    select p_item_id, url, (ord - 1)
    from unnest(p_images) with ordinality as t(url, ord);
  end if;
end $$;

create or replace function delete_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_status item_status;
begin
  select user_id, status into v_owner, v_status from items where id = p_item_id;
  if v_owner is null then raise exception '商品が見つかりません'; end if;
  if v_owner <> auth.uid() then raise exception '自分の出品ではありません'; end if;
  if v_status = 'trading' then raise exception '取引中の商品は削除できません'; end if;

  -- 子は新しい種として独立させる（SPEC 3-3）。物理削除はせず status を落とす。
  perform detach_children(p_item_id);
  update items set status = 'deleted', parent_id = null where id = p_item_id;
end $$;

-- ══════════════════════════════════════════════════════════
-- 3. ログインボーナス（1日1回）
-- ══════════════════════════════════════════════════════════
-- 付与額は app_settings から読む（ハードコード禁止）。
-- 「今日すでに受け取ったか」は profiles.last_login_bonus_on で判定する。

create or replace function claim_login_bonus()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last date;
  v_amount int;
begin
  if v_uid is null then raise exception 'ログインしていません'; end if;

  select last_login_bonus_on into v_last from profiles where id = v_uid for update;
  if v_last = v_today then
    return 0;   -- 受け取り済み。エラーにはしない
  end if;

  v_amount := coalesce(get_setting_int('daily_login_bonus'), 0);

  update profiles
     set fertilizer = fertilizer + v_amount,
         last_login_bonus_on = v_today
   where id = v_uid;

  insert into fertilizer_ledger (user_id, amount, reason)
  values (v_uid, v_amount, 'login_bonus');

  return v_amount;
end $$;

/** 今日のボーナスを受け取れるか（画面のボタン表示用） */
create or replace function can_claim_login_bonus()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(last_login_bonus_on, date '1970-01-01')
         < (now() at time zone 'Asia/Tokyo')::date
  from profiles where id = auth.uid();
$$;

-- ══════════════════════════════════════════════════════════
-- 4. 取引の進行（発送 → 受取）
-- ══════════════════════════════════════════════════════════

create or replace function ship_exchange(p_exchange_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e record;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e is null then raise exception '取引が見つかりません'; end if;
  if e.from_user_id <> auth.uid() then raise exception '発送する側ではありません'; end if;
  if e.status <> 'pending' then raise exception 'すでに発送済みです'; end if;

  update exchanges set status = 'shipped', shipped_at = now() where id = p_exchange_id;

  insert into notifications (user_id, type, body, related_id)
  values (e.to_user_id, 'shipped', '商品が発送されました', p_exchange_id);
end $$;

create or replace function receive_exchange(p_exchange_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e record;
  v_remaining int;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e is null then raise exception '取引が見つかりません'; end if;
  if e.to_user_id <> auth.uid() then raise exception '受け取る側ではありません'; end if;
  if e.status <> 'shipped' then raise exception 'まだ発送されていません'; end if;

  update exchanges set status = 'received', received_at = now() where id = p_exchange_id;

  insert into notifications (user_id, type, body, related_id)
  values (e.from_user_id, 'received', '商品が受け取られました', p_exchange_id);

  -- 輪の全員が受け取り終わったら、その木の商品を完了にする
  select count(*) into v_remaining
  from exchanges where harvest_id = e.harvest_id and status <> 'received';

  if v_remaining = 0 then
    update items set status = 'completed'
    where id in (select item_id from exchanges where harvest_id = e.harvest_id);
  end if;
end $$;

-- ══════════════════════════════════════════════════════════
-- 5. 取引メッセージの通知
-- ══════════════════════════════════════════════════════════
-- messages への insert は RLS で許可済み。相手への通知だけトリガで自動化する。

create or replace function notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  e record;
  v_to uuid;
begin
  select * into e from exchanges where id = new.exchange_id;
  v_to := case when new.sender_id = e.from_user_id then e.to_user_id else e.from_user_id end;
  insert into notifications (user_id, type, body, related_id)
  values (v_to, 'message', 'メッセージが届きました', new.exchange_id);
  return new;
end $$;

drop trigger if exists on_message_created on messages;
create trigger on_message_created
  after insert on messages
  for each row execute function notify_message();

-- ══════════════════════════════════════════════════════════
-- 6. 掲示板コメントの通知
-- ══════════════════════════════════════════════════════════

create or replace function notify_board_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
begin
  select user_id into v_author from board_posts where id = new.post_id;
  -- 自分の投稿に自分でコメントしたときは通知しない
  if v_author is not null and v_author <> new.user_id then
    insert into notifications (user_id, type, body, related_id)
    values (v_author, 'board_comment', '投稿にコメントがつきました', new.post_id);
  end if;
  return new;
end $$;

drop trigger if exists on_board_comment_created on board_comments;
create trigger on_board_comment_created
  after insert on board_comments
  for each row execute function notify_board_comment();

-- ══════════════════════════════════════════════════════════
-- 7. 評価（1取引につき本人1件）
-- ══════════════════════════════════════════════════════════

create or replace function submit_rating(
  p_exchange_id uuid,
  p_score int,
  p_comment text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  e record;
  v_ratee uuid;
  v_type rating_type;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e is null then raise exception '取引が見つかりません'; end if;
  if auth.uid() not in (e.from_user_id, e.to_user_id) then
    raise exception 'この取引の当事者ではありません';
  end if;
  if e.status <> 'received' then raise exception '受け取りが完了していません'; end if;

  -- 送った側は「対応（communication）」、受け取った側は「品質（quality）」を付ける
  if auth.uid() = e.from_user_id then
    v_ratee := e.to_user_id;   v_type := 'communication';
  else
    v_ratee := e.from_user_id; v_type := 'quality';
  end if;

  insert into ratings (exchange_id, rater_id, ratee_id, type, score, comment)
  values (p_exchange_id, auth.uid(), v_ratee, v_type, p_score, nullif(trim(p_comment), ''))
  on conflict (exchange_id, rater_id) do update
    set score = excluded.score, comment = excluded.comment;
end $$;

-- ══════════════════════════════════════════════════════════
-- 8. 通知の既読
-- ══════════════════════════════════════════════════════════

create or replace function mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_ids is null or id = any(p_ids));
$$;

-- ══════════════════════════════════════════════════════════
-- 9. 一覧表示用のビュー
-- ══════════════════════════════════════════════════════════
-- 画面が必要とする「水やり数・いいね数・木の本数・出品者名・サムネ」を
-- 1クエリで取れるようにする（アプリ側で件数を数えると N+1 になるため）。

create or replace view item_cards as
select
  i.id,
  i.user_id,
  p.nickname          as owner_nickname,
  p.avatar_url        as owner_avatar_url,
  i.name,
  i.description,
  i.category,
  i.condition,
  i.status,
  i.parent_id,
  i.root_id,
  i.depth,
  i.created_at,
  (select url from item_images im where im.item_id = i.id order by sort_order limit 1) as image_url,
  (select coalesce(array_agg(url order by sort_order), '{}')
     from item_images im where im.item_id = i.id) as image_urls,
  (select count(*) from items c where c.parent_id = i.id and c.status <> 'deleted') as water_count,
  (select count(*) from item_likes l where l.item_id = i.id) as like_count,
  (select count(*) from items t where t.root_id = i.root_id and t.status <> 'deleted') as tree_count
from items i
join profiles p on p.id = i.user_id
where i.status <> 'deleted';

-- ビューは呼び出し元の権限で動く（security_invoker）＝ items の RLS がそのまま効く
alter view item_cards set (security_invoker = on);
grant select on item_cards to anon, authenticated;

-- 掲示板も同様に、コメント数・いいね数を1クエリで
create or replace view board_cards as
select
  b.id,
  b.user_id,
  p.nickname   as author_nickname,
  p.avatar_url as author_avatar_url,
  b.body,
  b.image_url,
  b.created_at,
  (select count(*) from board_comments c where c.post_id = b.id) as comment_count,
  (select count(*) from board_likes l where l.post_id = b.id) as like_count
from board_posts b
join profiles p on p.id = b.user_id;

alter view board_cards set (security_invoker = on);
grant select on board_cards to anon, authenticated;

-- 評価の平均（プロフィール表示用）
create or replace view profile_stats as
select
  p.id,
  (select count(*) from items i where i.user_id = p.id and i.parent_id is null and i.status <> 'deleted') as seed_count,
  (select count(*) from items i where i.user_id = p.id and i.parent_id is not null and i.status <> 'deleted') as water_count,
  (select count(*) from harvests h join items i on i.id = h.root_item_id where i.user_id = p.id) as harvest_count,
  (select round(avg(score)::numeric, 1) from ratings r where r.ratee_id = p.id) as rating_avg,
  (select count(*) from ratings r where r.ratee_id = p.id) as rating_count
from profiles p;

alter view profile_stats set (security_invoker = on);
grant select on profile_stats to anon, authenticated;

-- ══════════════════════════════════════════════════════════
-- 10. 商品画像の保存先（Supabase Storage）
-- ══════════════════════════════════════════════════════════
-- 公開読み取り／自分のフォルダにだけ書き込み可、という一般的な構成。
-- パスは  item-images/<user_id>/<uuid>.jpg  を想定する。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists item_images_read on storage.objects;
create policy item_images_read on storage.objects for select
  using (bucket_id = 'item-images');

drop policy if exists item_images_write on storage.objects;
create policy item_images_write on storage.objects for insert
  with check (
    bucket_id = 'item-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists item_images_delete on storage.objects;
create policy item_images_delete on storage.objects for delete
  using (
    bucket_id = 'item-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ══════════════════════════════════════════════════════════
-- 11. 停止中ユーザーの書き込みを止める
-- ══════════════════════════════════════════════════════════
-- 0004 で用意した assert_not_suspended を、書き込み系 RPC の入口で使う。

create or replace function plant_seed(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_condition text,
  p_images text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_user_id <> auth.uid() then raise exception '本人以外は出品できません'; end if;
  perform assert_not_suspended(p_user_id);

  insert into items (user_id, name, description, category, condition)
  values (p_user_id, p_name, p_description, p_category, p_condition)
  returning id into v_id;

  insert into item_images (item_id, url, sort_order)
  select v_id, url, (ord - 1)
  from unnest(coalesce(p_images, '{}')) with ordinality as t(url, ord);

  return v_id;
end $$;

-- water も同様に本人確認と停止チェックを入れる（0002 の定義を置き換える）
create or replace function water(
  p_user_id uuid,
  p_target_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_condition text,
  p_images text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_cost int;
  v_balance int;
  v_target items;
begin
  if p_user_id <> auth.uid() then raise exception '本人以外は水やりできません'; end if;
  perform assert_not_suspended(p_user_id);

  if not can_water(p_user_id, p_target_id) then
    raise exception 'この商品には水やりできません';
  end if;

  select * into v_target from items where id = p_target_id;

  v_cost := coalesce(get_setting_int('water_cost'), 0);
  select fertilizer into v_balance from profiles where id = p_user_id for update;
  if v_balance < v_cost then
    raise exception '肥料が足りません（残高 % / 必要 %）', v_balance, v_cost;
  end if;

  -- 子ノード作成（root_id/depth はトリガが親から継承）
  insert into items (user_id, name, description, category, condition, parent_id)
  values (p_user_id, p_name, p_description, p_category, p_condition, p_target_id)
  returning id into v_id;

  insert into item_images (item_id, url, sort_order)
  select v_id, url, (ord - 1)
  from unnest(coalesce(p_images, '{}')) with ordinality as t(url, ord);

  update profiles set fertilizer = fertilizer - v_cost where id = p_user_id;
  insert into fertilizer_ledger (user_id, amount, reason, related_item_id)
  values (p_user_id, -v_cost, 'watering', v_id);

  insert into notifications (user_id, type, body, related_id)
  values (v_target.user_id, 'watered', v_target.name || ' に水やりがありました', v_id);

  return v_id;
end $$;

-- 収穫の本体。0002 の harvest の中身をそのまま持ってきたもの。
-- 権限チェックは呼び出し側（harvest）で行う。
create or replace function harvest_unchecked(p_root_id uuid, p_target_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_path uuid[];
  v_harvest_id uuid;
  v_len int;
  i int;
  v_from record;
  v_to record;
begin
  -- 1) root → target の一本道を取得（祖先を辿って深さ順）
  select array_agg(id order by depth) into v_path from get_ancestors(p_target_id);

  v_len := array_length(v_path, 1);
  if v_len is null or v_path[1] <> p_root_id then
    raise exception 'この商品はそのタネの木に含まれていません';
  end if;

  -- 2) 収穫レコード（unique 制約で1種1収穫を担保）
  insert into harvests (root_item_id, harvested_item_id)
  values (p_root_id, p_target_id) returning id into v_harvest_id;

  -- 3) パス外の枝を切り離す（＝新しい種として独立）
  for i in 1 .. v_len loop
    perform detach_children(v_path[i], case when i < v_len then v_path[i + 1] else null end);
  end loop;
  perform detach_children(p_target_id);

  -- 4) パス上のノードを取引中に
  update items set status = 'trading' where id = any(v_path);

  -- 5) 玉突きの輪
  for i in 1 .. v_len loop
    select * into v_from from items where id = v_path[i];
    select * into v_to   from items where id = v_path[ case when i = v_len then 1 else i + 1 end ];

    insert into exchanges (harvest_id, item_id, from_user_id, to_user_id, position)
    values (v_harvest_id, v_from.id, v_from.user_id, v_to.user_id, i - 1);
  end loop;

  -- 6) 発送義務の通知
  insert into notifications (user_id, type, body, related_id)
  select from_user_id, 'harvested', '収穫が成立しました。発送をお願いします', v_harvest_id
  from exchanges where harvest_id = v_harvest_id;

  return v_harvest_id;
end $$;

revoke all on function harvest_unchecked(uuid, uuid) from public, anon, authenticated;

-- 収穫できるのは種の持ち主だけ（0002 には持ち主チェックが無かった）
create or replace function harvest(p_root_id uuid, p_target_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from items where id = p_root_id;
  if v_owner is null then raise exception 'タネが見つかりません'; end if;
  if v_owner <> auth.uid() then raise exception '自分のタネしか収穫できません'; end if;
  if p_root_id = p_target_id then raise exception '自分のタネ自身は選べません'; end if;
  perform assert_not_suspended(v_owner);

  return harvest_unchecked(p_root_id, p_target_id);
end $$;


-- ============================================================================
-- ▼ 0007_item_comments.sql
-- ============================================================================
-- 商品へのコメント
--
-- 画面（商品詳細）にコメント欄があるのにテーブルが無く、アプリを閉じると
-- 消えてしまう状態だったので追加する。掲示板のコメントと同じ作りに揃える。

create table item_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on item_comments (item_id);

alter table item_comments enable row level security;

-- 商品は公開なのでコメントも誰でも読める
create policy read_all_item_comments on item_comments for select using (true);
-- 書き込み・削除は本人のみ
create policy write_own_item_comments on item_comments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 出品者への通知（自分の商品に自分でコメントしたときは送らない）
create or replace function notify_item_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_name text;
begin
  select user_id, name into v_owner, v_name from items where id = new.item_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into notifications (user_id, type, body, related_id)
    values (v_owner, 'board_comment', v_name || ' にコメントがつきました', new.item_id);
  end if;
  return new;
end $$;

drop trigger if exists on_item_comment_created on item_comments;
create trigger on_item_comment_created
  after insert on item_comments
  for each row execute function notify_item_comment();

-- ── 掲示板のタグ ───────────────────────────────────────────
-- 画面にタグの絞り込み（交換報告／質問／雑談／お知らせ）があるのに
-- 列が無く、投稿すると必ず「雑談」になってしまうため追加する。

create type board_tag as enum ('harvest', 'question', 'chat', 'notice');

alter table board_posts
  add column tag board_tag not null default 'chat',
  add column pinned boolean not null default false;

create index on board_posts (created_at desc);

-- 列の並びが変わるので、置き換えではなく作り直す
drop view if exists board_cards;
create view board_cards as
select
  b.id,
  b.user_id,
  p.nickname   as author_nickname,
  p.avatar_url as author_avatar_url,
  b.body,
  b.image_url,
  b.tag,
  b.pinned,
  b.created_at,
  (select count(*) from board_comments c where c.post_id = b.id) as comment_count,
  (select count(*) from board_likes l where l.post_id = b.id) as like_count
from board_posts b
join profiles p on p.id = b.user_id;

alter view board_cards set (security_invoker = on);
grant select on board_cards to anon, authenticated;

-- 一覧にコメント数を出せるよう item_cards を作り直す（列が増えるので drop してから）
drop view if exists item_cards;
create view item_cards as
select
  i.id,
  i.user_id,
  p.nickname          as owner_nickname,
  p.avatar_url        as owner_avatar_url,
  i.name,
  i.description,
  i.category,
  i.condition,
  i.status,
  i.parent_id,
  i.root_id,
  i.depth,
  i.created_at,
  (select url from item_images im where im.item_id = i.id order by sort_order limit 1) as image_url,
  (select coalesce(array_agg(url order by sort_order), '{}')
     from item_images im where im.item_id = i.id) as image_urls,
  (select count(*) from items c where c.parent_id = i.id and c.status <> 'deleted') as water_count,
  (select count(*) from item_likes l where l.item_id = i.id) as like_count,
  (select count(*) from items t where t.root_id = i.root_id and t.status <> 'deleted') as tree_count,
  (select count(*) from item_comments ic where ic.item_id = i.id) as comment_count
from items i
join profiles p on p.id = i.user_id
where i.status <> 'deleted';

alter view item_cards set (security_invoker = on);
grant select on item_cards to anon, authenticated;


-- ============================================================================
-- ▼ 0008_meeting_07_28.sql
-- ============================================================================
-- 2026-07-28 めたん様定例MTG 反映分
--
-- 1) プレミアム特典：ログインボーナス増量を復活（通常40 / プレミアム80）
-- 2) 商品カードの water_count を「その商品の子ノード数」に一致させる
--    → 0006 で追加した item_cards ビューはすでに正しい定義。実データが view 側に無く
--    items テーブルの列を直接参照している画面を統一するための補助関数を追加。
-- 3) 苗木機能：harvest 経由の detach_children はすでに新root化する実装。
--    ここではリリース確認しやすいよう、収穫後に新root化した item を返す view を追加。
--
-- 4) 利用規約・プライバシーポリシーは app_settings に本文を格納できる形にする（差替え可）
--    小さいので JSON でそのまま置く。改行はそのまま保持。

-- ── 1. プレミアム用ログインボーナス設定 ─────────────────────
-- 既定値を差し込む。既にあれば据え置き（管理画面から変更可）。
insert into app_settings (key, value) values
  ('daily_login_bonus_premium', '80'::jsonb),
  ('terms_of_service',           '""'::jsonb),
  ('privacy_policy',              '""'::jsonb)
on conflict (key) do nothing;

-- claim_login_bonus を「プレミアム判定込み」で置き換える。
create or replace function claim_login_bonus()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last date;
  v_premium boolean;
  v_amount int;
begin
  if v_uid is null then raise exception 'ログインしていません'; end if;

  select last_login_bonus_on, coalesce(is_premium, false)
    into v_last, v_premium
    from profiles where id = v_uid for update;
  if v_last = v_today then
    return 0;
  end if;

  if v_premium then
    v_amount := coalesce(
      get_setting_int('daily_login_bonus_premium'),
      get_setting_int('daily_login_bonus'),
      0
    );
  else
    v_amount := coalesce(get_setting_int('daily_login_bonus'), 0);
  end if;

  update profiles
     set fertilizer = fertilizer + v_amount,
         last_login_bonus_on = v_today
   where id = v_uid;

  insert into fertilizer_ledger (user_id, amount, reason)
  values (v_uid, v_amount, 'login_bonus');

  return v_amount;
end $$;

-- ── 2. 子ノード数の集計（画面から使えるように） ──────────────
-- item_cards は水やり数（＝子ノード数）を water_count として返している（0006）。
-- SDK が items テーブルを直接読んでいる箇所と食い違わないよう、items にも
-- 集計ビューを別に用意しておく（既存 view は温存）。
create or replace view item_water_counts as
select
  i.id as item_id,
  (select count(*) from items c where c.parent_id = i.id and c.status <> 'deleted') as water_count,
  (select count(*) from items t where t.root_id = i.root_id and t.status <> 'deleted') as tree_count
from items i;

alter view item_water_counts set (security_invoker = on);
grant select on item_water_counts to anon, authenticated;

-- ── 3. 苗木（新root化した item を追いやすくする view）──────
-- ある種 root_id が同じでも harvest によって切り出されると root_id が別の値になる。
-- 「元は誰の木にぶら下がっていたか」を追える view を用意しておく（管理画面・分析用）。
create or replace view sapling_items as
select
  i.id,
  i.user_id,
  i.name,
  i.category,
  i.status,
  i.created_at,
  i.root_id,
  h.root_item_id as detached_from_root
from items i
left join harvests h on h.harvested_item_id in (
  select id from get_ancestors(i.id)
)
where i.parent_id is null and i.root_id = i.id;

alter view sapling_items set (security_invoker = on);
grant select on sapling_items to anon, authenticated;

comment on function claim_login_bonus() is
  '2026-07-28: プレミアム会員は daily_login_bonus_premium を、通常会員は daily_login_bonus を受け取る。';
comment on view item_water_counts is
  '2026-07-28: 商品カードの「目のアイコン＋数字」の実データ元。子ノード数と一致。';
comment on view sapling_items is
  '2026-07-28: 苗木＝収穫後にパス外の枝が独立した種（parent_id=null, root_id=self）。detached_from_root で元木を辿れる。';


-- ============================================================================
-- ▼ 0009_purchases_push_legacy.sql
-- ============================================================================
-- 残りロードマップ（課金・プッシュ通知・既存ユーザー移行）に必要な土台
--
-- ここまでの 0001〜0008 で「アプリが今動かしている機能」のスキーマは揃っている。
-- このマイグレーションは、まだ実装に入っていない次の3つを受け止める器を先に作る。
--
--   1. プレミアムの有効期限      … 解約しても永久にプレミアムのままになる穴を塞ぐ
--   2. 課金レシート（IAP）        … 二重付与を DB 側で防ぐ
--   3. プッシュ通知のトークン     … 端末を跨いだ付け替えと二重送信を防ぐ
--   4. 既存160人の移行台帳        … 何度流しても壊れない移行にする
--
-- ＋ 運用で困る細かい穴を2つ（通報の重複、items の更新日時）。
-- ＋ 【不具合修正】取引・評価・通報をしたことがある人が退会できない（下記 7）。


-- ============================================================================
-- 1. プレミアムの有効期限
-- ============================================================================
--
-- これまで profiles.is_premium は boolean 1つだけだった。
-- サブスクは「期限が来たら自動で切れる」必要があるが、boolean だけでは
-- 誰かが手で false にするまで永久にプレミアムのままになる。
--
-- 【役割分担】
--   is_premium    … アプリ・管理画面が読む「いまプレミアムか」。これが正。
--   premium_until … いつ切れるか。NULL は「期限なし」（運営が手で付与した場合）。
--
-- 期限切れの反映は expire_premium() が行う。
-- ログインボーナスの計算前に必ず呼ぶので、特典が余分に出ることはない。

alter table profiles
  add column if not exists premium_until timestamptz;

comment on column profiles.premium_until is
  'プレミアムの期限。NULL は期限なし（運営付与）。期限切れは expire_premium() が is_premium=false にする';

create index if not exists profiles_premium_until_idx
  on profiles (premium_until) where is_premium;

-- 期限切れのプレミアムを落とす。戻り値は落とした人数。
-- pg_cron から1日1回呼ぶのが理想だが、呼ばれなくても
-- claim_login_bonus() の中から都度呼ぶので特典計算は必ず正しくなる。
create or replace function expire_premium()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update profiles
     set is_premium = false
   where is_premium
     and premium_until is not null
     and premium_until <= now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function expire_premium() from public;
grant execute on function expire_premium() to service_role;

-- claim_login_bonus を「期限切れを反映してから判定する」形に差し替える。
-- 中身（金額の決め方・台帳への記録）は 0008 と同じ。
create or replace function claim_login_bonus()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last date;
  v_premium boolean;
  v_until timestamptz;
  v_amount int;
begin
  if v_uid is null then raise exception 'ログインしていません'; end if;

  select last_login_bonus_on, coalesce(is_premium, false), premium_until
    into v_last, v_premium, v_until
    from profiles where id = v_uid for update;

  if v_last = v_today then
    return 0;
  end if;

  -- 期限が切れていれば、この人のぶんだけ即座に落とす（cron を待たない）
  if v_premium and v_until is not null and v_until <= now() then
    v_premium := false;
    update profiles set is_premium = false where id = v_uid;
  end if;

  if v_premium then
    v_amount := coalesce(
      get_setting_int('daily_login_bonus_premium'),
      get_setting_int('daily_login_bonus'),
      0
    );
  else
    v_amount := coalesce(get_setting_int('daily_login_bonus'), 0);
  end if;

  update profiles
     set fertilizer = fertilizer + v_amount,
         last_login_bonus_on = v_today
   where id = v_uid;

  insert into fertilizer_ledger (user_id, amount, reason)
  values (v_uid, v_amount, 'login_bonus');

  return v_amount;
end $$;


-- ============================================================================
-- 2. 課金レシート（App Store の In-App Purchase）
-- ============================================================================
--
-- ⚠ レシートの検証は必ずサーバ側で行う。
--   アプリから「肥料を1200増やして」と言わせてはいけない（誰でも改造できる）。
--   流れ：
--     アプリ  … StoreKit で購入 → レシートをサーバへ送る
--     サーバ  … Apple に検証を投げる → 通ったら redeem_purchase() を service_role で呼ぶ
--     DB      … transaction_id が既にあれば何もしない（二重付与を防ぐ）
--
--   「サーバ」は Supabase Edge Function か管理画面（Next.js）の API を想定。
--   どちらにするかは課金方式の確定後に決める。

create type purchase_platform as enum ('ios', 'android', 'admin');
create type purchase_kind     as enum ('fertilizer', 'premium');

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  platform purchase_platform not null,
  kind purchase_kind not null,
  product_id text not null,            -- App Store Connect の商品ID
  transaction_id text not null,        -- レシートの一意ID。再送・リプレイの判定に使う
  fertilizer_amount int not null default 0,   -- kind='fertilizer' のとき付与する肥料
  premium_days int not null default 0,        -- kind='premium' のとき延ばす日数
  price_jpy int,                       -- 記録用。金額は app_settings が正
  raw jsonb,                           -- 検証したレシート全文（問い合わせ対応用）
  created_at timestamptz not null default now(),

  -- 同じレシートで二度付与できない。これが二重付与を防ぐ最後の砦。
  unique (platform, transaction_id)
);
create index on purchases (user_id, created_at desc);

comment on table purchases is
  'IAPのレシート。付与は redeem_purchase() 経由のみ。(platform, transaction_id) の一意制約が二重付与を防ぐ';

-- 肥料の増減理由に「サブスク由来」を足す（既存の 'purchase' は肥料の単発購入）
alter type fertilizer_reason add value if not exists 'subscription';

-- レシート1件を反映する。既に処理済みなら何もせず false を返す（冪等）。
--
-- p_premium_days > 0 のときは、いまの期限（切れていれば now()）から積み増す。
-- 更新のたびに呼べば自然に延びていく。
create or replace function redeem_purchase(
  p_user           uuid,
  p_platform       purchase_platform,
  p_kind           purchase_kind,
  p_product_id     text,
  p_transaction_id text,
  p_fertilizer     int  default 0,
  p_premium_days   int  default 0,
  p_price_jpy      int  default null,
  p_raw            jsonb default null
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_inserted boolean := false;
begin
  if p_user is null then raise exception 'user が指定されていません'; end if;

  insert into purchases (
    user_id, platform, kind, product_id, transaction_id,
    fertilizer_amount, premium_days, price_jpy, raw
  ) values (
    p_user, p_platform, p_kind, p_product_id, p_transaction_id,
    greatest(coalesce(p_fertilizer, 0), 0),
    greatest(coalesce(p_premium_days, 0), 0),
    p_price_jpy, p_raw
  )
  on conflict (platform, transaction_id) do nothing;

  -- 挿入できなかった＝このレシートは既に処理済み
  if not found then
    return false;
  end if;
  v_inserted := true;

  if p_kind = 'fertilizer' and coalesce(p_fertilizer, 0) > 0 then
    update profiles
       set fertilizer = fertilizer + p_fertilizer
     where id = p_user;

    insert into fertilizer_ledger (user_id, amount, reason)
    values (p_user, p_fertilizer, 'purchase');
  end if;

  if p_kind = 'premium' and coalesce(p_premium_days, 0) > 0 then
    update profiles
       set is_premium = true,
           -- 期限が切れている（または未設定）なら now() を起点に積む
           premium_until = greatest(coalesce(premium_until, now()), now())
                           + make_interval(days => p_premium_days)
     where id = p_user;
  end if;

  return v_inserted;
end $$;

-- ★ アプリからは絶対に呼べないようにする（サーバ検証を経たものだけ）
revoke all on function redeem_purchase(
  uuid, purchase_platform, purchase_kind, text, text, int, int, int, jsonb
) from public;
grant execute on function redeem_purchase(
  uuid, purchase_platform, purchase_kind, text, text, int, int, int, jsonb
) to service_role;


-- ============================================================================
-- 3. プッシュ通知のトークン
-- ============================================================================
--
-- 主キーをトークンにしている理由：
--   同じ端末で別アカウントにログインし直したとき、トークンの持ち主を
--   付け替えたい（前の人に通知が飛び続けるのを防ぐ）。upsert 一発で入れ替わる。

create table push_tokens (
  token text primary key,                       -- Expo Push Token
  user_id uuid not null references profiles on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index on push_tokens (user_id);

comment on table push_tokens is
  '端末のプッシュ通知トークン。主キーは token（端末の持ち主が変わったら付け替わる）';

-- 二重送信を防ぐため、送った通知には印を付ける
alter table notifications
  add column if not exists pushed_at timestamptz;

create index if not exists notifications_unpushed_idx
  on notifications (created_at) where pushed_at is null;

-- 送信側（サーバ）が拾う未送信ぶん。ブロック中の相手からの通知は送らない。
create or replace view notifications_to_push as
  select n.id,
         n.user_id,
         n.type,
         n.body,
         n.related_id,
         n.created_at,
         t.token,
         t.platform
    from notifications n
    join push_tokens t on t.user_id = n.user_id
   where n.pushed_at is null
     and n.read_at is null;

comment on view notifications_to_push is
  'まだプッシュしていない通知 × 端末トークン。送信後に notifications.pushed_at を埋める';

-- 自分の端末を登録する（アプリから呼ぶ）
create or replace function register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'ログインしていません'; end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'platform は ios か android を指定してください';
  end if;

  insert into push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_uid, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,          -- 端末の持ち主が変わったら付け替える
        platform = excluded.platform,
        updated_at = now();
end $$;

revoke all on function register_push_token(text, text) from public;
grant execute on function register_push_token(text, text) to authenticated;

-- ログアウト時に外す
create or replace function unregister_push_token(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'ログインしていません'; end if;
  delete from push_tokens where token = p_token and user_id = auth.uid();
end $$;

revoke all on function unregister_push_token(text) from public;
grant execute on function unregister_push_token(text) to authenticated;


-- ============================================================================
-- 4. 既存ユーザー（Click版・約160人）の移行台帳
-- ============================================================================
--
-- 旧サービスから名簿を入れておき、その人が新規登録したら自動で紐づける。
-- 「誰に案内メールを送ったか」「誰がまだ戻ってきていないか」を追える。
--
-- パスワードは移行できない（旧サービスのハッシュ形式が違う）ため、
-- 全員に「再登録のお願い」を送る運用になる。

create table legacy_users (
  legacy_id text primary key,             -- 旧サービスのユーザーID
  email text not null,
  nickname text,
  raw jsonb,                              -- 旧データそのまま（後から参照できるように）
  profile_id uuid references profiles on delete set null,
  invited_at timestamptz,                 -- 案内メールを送った日時
  migrated_at timestamptz,                -- 新サービスで登録が完了した日時
  created_at timestamptz not null default now()
);

-- 同じメールを二重に登録しない（大文字小文字は同一視）
create unique index legacy_users_email_key on legacy_users (lower(email));
create index on legacy_users (migrated_at);

comment on table legacy_users is
  'Click版からの移行名簿。新規登録時に handle_new_user() がメール一致で紐づける';

-- サインアップ時に、旧名簿と突き合わせて紐づける。
-- 0005 の handle_new_user を置き換える（profiles を作る部分は同じ）。
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nickname text;
  v_legacy   legacy_users;
begin
  -- 旧名簿にいる人なら、そのニックネームを引き継ぐ
  select * into v_legacy
    from legacy_users
   where lower(email) = lower(new.email)
   limit 1;

  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
    nullif(trim(v_legacy.nickname), ''),
    split_part(new.email, '@', 1)
  );

  insert into profiles (id, nickname)
  values (new.id, left(v_nickname, 20))
  on conflict (id) do nothing;

  -- 移行完了として記録
  if v_legacy.legacy_id is not null then
    update legacy_users
       set profile_id = new.id,
           migrated_at = coalesce(migrated_at, now())
     where legacy_id = v_legacy.legacy_id;
  end if;

  return new;
end $$;

-- 移行の進捗（管理画面から見る用）
create or replace view legacy_migration_status as
  select count(*)                                          as total,
         count(*) filter (where migrated_at is not null)    as migrated,
         count(*) filter (where migrated_at is null
                            and invited_at is not null)     as invited_not_yet,
         count(*) filter (where invited_at is null)         as not_invited
    from legacy_users;


-- ============================================================================
-- 5. 運用で困る細かい穴
-- ============================================================================

-- 同じ人が同じ対象を何度も通報して、運営の一覧が埋まるのを防ぐ。
-- 対応済み（resolved / dismissed）になった後の再通報は許す
-- ＝「一度片付けた件の再発」は受け付けたいため、open のときだけ一意にする。
create unique index if not exists reports_open_unique
  on reports (reporter_id, target_type, target_id)
  where status = 'open';

-- 出品を編集したときの更新日時。管理画面の並び替えと、
-- 「編集された出品」の追跡に使う。
alter table items
  add column if not exists updated_at timestamptz not null default now();

create or replace function touch_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists items_touch_updated_at on items;
create trigger items_touch_updated_at
  before update on items
  for each row execute function touch_items_updated_at();


-- ============================================================================
-- 6. RLS（新しいテーブル）
-- ============================================================================

alter table purchases    enable row level security;
alter table push_tokens  enable row level security;
alter table legacy_users enable row level security;

-- 購入履歴は本人だけが読める。書き込みは RPC（service_role）のみ。
create policy read_own_purchases on purchases
  for select using (user_id = auth.uid());

-- 端末トークンは本人だけ。読み書きは RPC 経由だが、
-- 自分のぶんの確認・削除はできてよい。
create policy read_own_push_tokens on push_tokens
  for select using (user_id = auth.uid());
create policy delete_own_push_tokens on push_tokens
  for delete using (user_id = auth.uid());

-- 旧名簿はメールアドレスの一覧なので、アプリからは一切見せない。
-- 管理画面（service_role）だけが扱う。ポリシーを作らない＝誰も読めない。


-- ============================================================================
-- 7. 【不具合修正】退会できないユーザーがいる
-- ============================================================================
--
-- delete_own_account()（0005）は auth.users を消して profiles を cascade で消す設計。
-- ところが profiles を参照する6つの外部キーが NO ACTION のままだったため、
--
--   ・取引をしたことがある（exchanges）
--   ・取引メッセージを送ったことがある（messages）
--   ・評価をした / された（ratings）
--   ・通報したことがある（reports）
--
-- のいずれかに当てはまる人は退会が外部キー違反で失敗する。
-- ＝ ふつうに使った人ほど退会できない。アプリには退会ボタンが既にあるので実害あり。
--
-- 【直し方：cascade ではなく set null にする】
-- cascade で消すと、相手側の取引記録・評価履歴まで一緒に消えてしまう。
-- 「相手には取引があった事実が残り、退会した側の名前だけ消える」のが正しいので、
-- 参照を NULL にして行そのものは残す。画面では「退会したユーザー」と出す。

-- exchanges：相手の取引履歴を壊さないよう行は残す
alter table exchanges
  alter column from_user_id drop not null,
  alter column to_user_id   drop not null;
alter table exchanges drop constraint exchanges_from_user_id_fkey;
alter table exchanges drop constraint exchanges_to_user_id_fkey;
alter table exchanges
  add constraint exchanges_from_user_id_fkey
    foreign key (from_user_id) references profiles on delete set null,
  add constraint exchanges_to_user_id_fkey
    foreign key (to_user_id) references profiles on delete set null;

-- messages：会話は読めるまま残す
alter table messages alter column sender_id drop not null;
alter table messages drop constraint messages_sender_id_fkey;
alter table messages
  add constraint messages_sender_id_fkey
    foreign key (sender_id) references profiles on delete set null;

-- ratings：相手に付いた評価は消さない
alter table ratings
  alter column rater_id drop not null,
  alter column ratee_id drop not null;
alter table ratings drop constraint ratings_rater_id_fkey;
alter table ratings drop constraint ratings_ratee_id_fkey;
alter table ratings
  add constraint ratings_rater_id_fkey
    foreign key (rater_id) references profiles on delete set null,
  add constraint ratings_ratee_id_fkey
    foreign key (ratee_id) references profiles on delete set null;

-- reports：運営の対応履歴を消さない（誰が通報したかだけ分からなくなる）
alter table reports alter column reporter_id drop not null;
alter table reports drop constraint reports_reporter_id_fkey;
alter table reports
  add constraint reports_reporter_id_fkey
    foreign key (reporter_id) references profiles on delete set null;

comment on column exchanges.from_user_id is
  '発送者。退会すると NULL（画面では「退会したユーザー」と表示）';
comment on column reports.reporter_id is
  '通報者。退会すると NULL。運営の対応履歴を残すため行は消さない';

-- ── items 側にも同じ穴がある ────────────────────────────────
--
-- 退会すると profiles → items は cascade で消える。ところが items を参照する
-- 4つの外部キーが NO ACTION だったため、ここでも退会が失敗する。
--
--   harvests.root_item_id / harvested_item_id … 収穫したことがある種の持ち主
--   exchanges.item_id                          … 取引に出ている商品の持ち主
--   fertilizer_ledger.related_item_id          … 誰かに水やりされた種の持ち主
--                                                （他人の台帳が自分の種を指すため）
--
-- 最後のものが特に厄介で、「自分の種に誰かが水やりしただけ」で退会できなくなる。

-- harvests：収穫の記録は残す（商品への参照だけ外す）
-- unique (root_item_id) は NULL を複数許すので「1種1収穫」の担保は崩れない
alter table harvests
  alter column root_item_id      drop not null,
  alter column harvested_item_id drop not null;
alter table harvests drop constraint harvests_root_item_id_fkey;
alter table harvests drop constraint harvests_harvested_item_id_fkey;
alter table harvests
  add constraint harvests_root_item_id_fkey
    foreign key (root_item_id) references items on delete set null,
  add constraint harvests_harvested_item_id_fkey
    foreign key (harvested_item_id) references items on delete set null;

-- exchanges：相手の取引履歴を残す
alter table exchanges alter column item_id drop not null;
alter table exchanges drop constraint exchanges_item_id_fkey;
alter table exchanges
  add constraint exchanges_item_id_fkey
    foreign key (item_id) references items on delete set null;

-- fertilizer_ledger：金額の履歴が本体。どの商品だったかは失われてよい
alter table fertilizer_ledger drop constraint fertilizer_ledger_related_item_id_fkey;
alter table fertilizer_ledger
  add constraint fertilizer_ledger_related_item_id_fkey
    foreign key (related_item_id) references items on delete set null;


-- ============================================================================
-- 8. 課金の既定値（金額は未確定。管理画面から差し替える）
-- ============================================================================
--
-- ⚠ 金額と商品IDは「めたん様と方式を確定してから」入れる。
--   ここでは空の器だけ用意し、コードに直書きされないようにする。
--   （仕様書：金額・商品IDは環境変数／管理画面から差し替え可能にする）

insert into app_settings (key, value) values
  -- 肥料の購入プラン: [{ "product_id": "...", "fertilizer": 400, "price_jpy": 200 }, ...]
  ('charge_plans',      '[]'::jsonb),
  -- プレミアムの商品: { "product_id": "...", "price_jpy": 480, "days": 30 }
  ('premium_product',   '{}'::jsonb)
on conflict (key) do nothing;


-- ============================================================================
-- ▼ 0010_avatars.sql
-- ============================================================================
-- ============================================================================
-- 0010: プロフィールアイコンの保存先 ＋ 「自分がいいねしたか」を一覧に載せる
--
-- マイページ→編集でアイコンを選んでも保存されていなかった（2026-08-04 実機で発覚）。
-- アプリ側で選んだ画像を Storage に上げて profiles.avatar_url に入れる作りに直すため、
-- 専用のバケットを用意する。
--
-- item-images と同じ構成：公開読み取り／自分のフォルダにだけ書き込み可。
-- パスは  avatars/<user_id>/<ランダム>.jpg
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,   -- アイコンは2MBで十分
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 上書き（同じパスに入れ直す）も本人だけ
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================================
-- item_cards に「自分がいいねしたか」を足す
--
-- いいねを押しても更新すると消える／数が合わない、という症状があった。
-- 原因は一覧に「自分がいいねしたか」が無く、画面側が initial=false を
-- 決め打ちしていたこと（表示数が二重に足されていた）。
-- ビューに liked を持たせれば、既存の取得処理はそのままで全画面に効く。
--
-- security_invoker = on なので auth.uid() は呼び出したユーザーのものになる。
-- 未ログイン（anon）では auth.uid() が null なので liked は常に false。
-- ============================================================================

drop view if exists item_cards;
create view item_cards as
select
  i.id,
  i.user_id,
  p.nickname          as owner_nickname,
  p.avatar_url        as owner_avatar_url,
  i.name,
  i.description,
  i.category,
  i.condition,
  i.status,
  i.parent_id,
  i.root_id,
  i.depth,
  i.created_at,
  (select url from item_images im where im.item_id = i.id order by sort_order limit 1) as image_url,
  (select coalesce(array_agg(url order by sort_order), '{}')
     from item_images im where im.item_id = i.id) as image_urls,
  (select count(*) from items c where c.parent_id = i.id and c.status <> 'deleted') as water_count,
  (select count(*) from item_likes l where l.item_id = i.id) as like_count,
  (select count(*) from items t where t.root_id = i.root_id and t.status <> 'deleted') as tree_count,
  (select count(*) from item_comments ic where ic.item_id = i.id) as comment_count,
  exists (select 1 from item_likes l where l.item_id = i.id and l.user_id = auth.uid()) as liked
from items i
join profiles p on p.id = i.user_id
where i.status <> 'deleted';

alter view item_cards set (security_invoker = on);
grant select on item_cards to anon, authenticated;

-- いいね一覧を新しい順に出せるように（押した順が分かるよう列を足す）
alter table item_likes  add column if not exists created_at timestamptz not null default now();
alter table board_likes add column if not exists created_at timestamptz not null default now();
create index if not exists item_likes_user_created_idx  on item_likes  (user_id, created_at desc);
create index if not exists board_likes_user_created_idx on board_likes (user_id, created_at desc);


-- ============================================================================
-- ▼ 0011_moderation_history_ratings.sql
-- ============================================================================
-- ============================================================================
-- 0011: 利用停止を掲示板にも効かせる ／ 閲覧履歴 ／ 評価一覧
--
--  1. 利用停止（is_suspended）が掲示板・コメントに効いていなかったのを塞ぐ
--  2. 「最近見た商品」のための閲覧履歴
--  3. プロフィールの評価一覧に出すためのビュー
-- ============================================================================


-- ══════════════════════════════════════════════════════════
-- 1. 利用停止中の書き込みを掲示板・コメントでも止める
-- ══════════════════════════════════════════════════════════
-- 0004 で assert_not_suspended() を用意し、0006 で plant_seed / water / harvest
-- の入口に入れたが、掲示板の投稿・コメント・商品コメントは RPC を通さない
-- 直 INSERT なので停止中でも書き込めていた。
-- 荒らし対応で「利用停止」を押しても掲示板は止まらない状態だったため塞ぐ。
--
-- RLS のポリシー側で弾く（RPC を増やさずに済み、経路が増えても漏れない）。

create or replace function is_suspended(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_suspended from profiles where id = p_user), false);
$$;

revoke all on function is_suspended(uuid) from public;
grant execute on function is_suspended(uuid) to authenticated, service_role;

-- 掲示板の投稿
drop policy if exists write_own_board_posts on board_posts;
create policy write_own_board_posts on board_posts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not is_suspended(auth.uid()));

-- 掲示板のコメント
drop policy if exists write_own_board_comments on board_comments;
create policy write_own_board_comments on board_comments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not is_suspended(auth.uid()));

-- 商品コメント（0007 で追加。ポリシー名は 0007 に合わせる）
drop policy if exists write_own_item_comments on item_comments;
create policy write_own_item_comments on item_comments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not is_suspended(auth.uid()));

-- 停止中に「いいね」まで塞ぐと荒らし対策としては過剰なので、書き込み系のうち
-- 投稿・コメント・出品・水やり・収穫だけを止める（閲覧は従来どおり可）。


-- ══════════════════════════════════════════════════════════
-- 2. 閲覧履歴（最近見た商品）
-- ══════════════════════════════════════════════════════════
-- 同じ商品を何度見ても1行。見た時刻だけ更新する（履歴が重複で埋まらないように）。

create table if not exists item_views (
  user_id   uuid not null references profiles on delete cascade,
  item_id   uuid not null references items    on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists item_views_user_viewed_idx on item_views (user_id, viewed_at desc);

alter table item_views enable row level security;

-- 自分の履歴だけ読める／書ける（誰が何を見たかは他人に見せない）
drop policy if exists own_item_views on item_views;
create policy own_item_views on item_views for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

/**
 * 閲覧を記録する。
 * 画面から upsert を直接呼んでもよいが、件数の上限を DB 側で抑えたいので関数にする
 * （1人あたり直近100件だけ残す。放っておくと無限に増える）。
 */
create or replace function touch_item_view(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;

  insert into item_views (user_id, item_id, viewed_at)
  values (v_user, p_item_id, now())
  on conflict (user_id, item_id) do update set viewed_at = now();

  delete from item_views
   where user_id = v_user
     and item_id not in (
       select item_id from item_views
        where user_id = v_user
        order by viewed_at desc
        limit 100
     );
end $$;

revoke all on function touch_item_view(uuid) from public;
grant execute on function touch_item_view(uuid) to authenticated;


-- ══════════════════════════════════════════════════════════
-- 3. 評価一覧
-- ══════════════════════════════════════════════════════════
-- プロフィールに星の平均しか出ていなかったので、内訳とコメントを見られるように。
-- 退会した人の評価も残す設計（rater_id は 0009 で NULL 許容）なので left join。

create or replace view rating_cards as
select
  r.id,
  r.ratee_id,
  r.rater_id,
  p.nickname   as rater_nickname,
  p.avatar_url as rater_avatar_url,
  r.type,
  r.score,
  r.comment,
  r.created_at
from ratings r
left join profiles p on p.id = r.rater_id;

alter view rating_cards set (security_invoker = on);
grant select on rating_cards to anon, authenticated;


-- ============================================================================
-- ▼ デモデータ（seed_demo.sql）
--    テスト用の商品・木・掲示板の投稿が入ります。不要ならここから下を削除。
--    ここだけは何度でも流し直せます（毎回消してから入れ直します）。
-- ============================================================================
-- ぐんぐん デモデータ（Supabase SQL Editor から service_role で流す用）
--
-- supabase/seed.sql は plant_seed() / water() RPC を経由する設計だが、
-- 0006 で「本人以外は出品できない」チェックを入れたため、
-- SQL Editor（auth.uid() = null）から呼ぶと弾かれる。
--
-- こちらは INSERT 直挿し版。トリガ set_item_tree() が root_id/depth を
-- 自動でセットするので、木の親子付けは変わらない。
-- 何度実行しても増えないよう、既存データを一度消してから入れ直す。

-- ── デモ用ユーザーの固定UUID ────────────────────────────────
-- 実運用のユーザーと分離するため、prefix を 000000... で揃える
--   はる      = ...a1
--   めたん    = ...a2
--   さくら    = ...a3
--   ゆう      = ...a4
--   たくさん  = ...a5
--   けんた    = ...a6

-- 一度消す（依存を持つ子テーブルは CASCADE で連鎖）
do $$
declare
  demo_ids uuid[] := array[
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-0000000000a4',
    '00000000-0000-0000-0000-0000000000a5',
    '00000000-0000-0000-0000-0000000000a6'
  ]::uuid[];
begin
  -- fertilizer_ledger.related_item_id は items を参照している（cascade なし）ので
  -- items を消す前にリンクを外す。デモユーザー分だけ NULL 化する。
  update fertilizer_ledger set related_item_id = null
   where user_id = any(demo_ids) or related_item_id in (select id from items where user_id = any(demo_ids));

  delete from items where user_id = any(demo_ids);
  delete from board_posts where user_id = any(demo_ids);
  -- auth.users を消せば profiles / fertilizer_ledger 等は cascade で消える
  delete from auth.users where id = any(demo_ids);
end $$;

-- ── ユーザー6人 ────────────────────────────────────────────
-- 必須列のみ。残りは Supabase 側の既定値に任せる。
-- handle_new_user トリガが raw_user_meta_data.nickname を見て profiles を作る。
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'haru@example.com',    crypt('password', gen_salt('bf')), now(), '{"nickname":"はる"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'metan@example.com',   crypt('password', gen_salt('bf')), now(), '{"nickname":"めたん"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'sakura@example.com',  crypt('password', gen_salt('bf')), now(), '{"nickname":"さくら"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'yu@example.com',      crypt('password', gen_salt('bf')), now(), '{"nickname":"ゆう"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'takusan@example.com', crypt('password', gen_salt('bf')), now(), '{"nickname":"たくさん"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'kenta@example.com',   crypt('password', gen_salt('bf')), now(), '{"nickname":"けんた"}');

-- profiles はトリガ handle_new_user が作る。肥料を追加で盛る
update profiles set fertilizer = 2000 where id in (
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4',
  '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a6'
);

-- ── スピーカーの木 ─────────────────────────────────────────
-- items 直挿し。root_id / depth はトリガが埋める。

-- 種：はる → ワイヤレススピーカー
insert into items (id, user_id, name, description, category, condition) values
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000a1',
   'ワイヤレススピーカー', '防水対応。箱付き。', '家電', '未使用に近い');

-- depth 1
insert into items (id, user_id, name, description, category, condition, parent_id) values
  ('b1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000000a2',
   'キャンバストートバッグ', '無地のキャンバストート。数回使用のみ。', 'レディース', '目立った傷や汚れなし',
   'b1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000a3',
   'マグカップ', 'いただきもの。使わないのでお譲りします。', 'インテリア', '未使用に近い',
   'b1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-0000000000a6',
   'ギフト券 5,000円分', '有効期限まだあります。', 'チケット', '新品・未使用',
   'b1000000-0000-4000-8000-000000000001');

-- depth 2
insert into items (id, user_id, name, description, category, condition, parent_id) values
  ('b1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-0000000000a4',
   'ミラーレスカメラ', 'レンズキット付き。シャッター回数少なめ。', 'スマホ・家電', '目立った傷や汚れなし',
   'b1000000-0000-4000-8000-000000000003'),
  ('b1000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-0000000000a3',
   '文庫本セット', '人気作家の文庫本8冊セット。', '本・音楽', '目立った傷や汚れなし',
   'b1000000-0000-4000-8000-000000000004');

-- depth 3
insert into items (id, user_id, name, description, category, condition, parent_id) values
  ('b1000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-0000000000a5',
   '腕時計', '電池交換済み。カメラが欲しくて水やり。', 'メンズ', '未使用に近い',
   'b1000000-0000-4000-8000-000000000005');

-- 別の独立した種（一覧に並べる用）
insert into items (id, user_id, name, description, category, condition) values
  ('b1000000-0000-4000-8000-000000000010', '00000000-0000-0000-0000-0000000000a6',
   'Nintendo Switch', '本体＋ドック。動作確認済み。', 'ゲーム・おもちゃ', 'やや傷や汚れあり'),
  ('b1000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-0000000000a3',
   '香水（未開封）', '頂き物ですが好みに合わず。', 'コスメ', '新品・未使用'),
  ('b1000000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-0000000000a1',
   'AirPods Pro（第2世代）', '純正ケース付き。動作良好。', 'スマホ・家電', '目立った傷や汚れなし');

-- ── 商品画像 ─────────────────────────────────────────────
-- GitHub の raw URL を使う（リポジトリと一緒に画像も管理される。永続的で無料）
insert into item_images (item_id, url, sort_order) values
  ('b1000000-0000-4000-8000-000000000001', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/speaker.jpg', 0),
  ('b1000000-0000-4000-8000-000000000002', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/bag.jpg', 0),
  ('b1000000-0000-4000-8000-000000000003', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/coffee.jpg', 0),
  ('b1000000-0000-4000-8000-000000000004', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/giftcard.jpg', 0),
  ('b1000000-0000-4000-8000-000000000005', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/camera.jpg', 0),
  ('b1000000-0000-4000-8000-000000000006', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/books.jpg', 0),
  ('b1000000-0000-4000-8000-000000000007', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/watch.jpg', 0),
  ('b1000000-0000-4000-8000-000000000010', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/switch.jpg', 0),
  ('b1000000-0000-4000-8000-000000000011', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/perfume.jpg', 0),
  ('b1000000-0000-4000-8000-000000000012', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/airpods.jpg', 0);

-- ── 掲示板の投稿 ─────────────────────────────────────────
insert into board_posts (id, user_id, body, tag, image_url, pinned, created_at) values
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000a3',
   'はじめてぐんぐんで交換成立しました🌱 ずっと眠っていたバッグが、欲しかったカメラに。わらしべ長者みたいで本当に楽しい…！みなさんの水やり待ってます〜',
   'harvest', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/bag.jpg', true, now() - interval '10 minutes'),
  ('d1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000000a5',
   'Nintendo Switch のタネを植えました🎮 ゲーム好きな方、ぜひ水やりしてください！交換の輪を広げましょう。',
   'chat', 'https://raw.githubusercontent.com/seiyakikuchi1003/gungun/main/assets/products/switch.jpg', false, now() - interval '1 hour'),
  ('d1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000a1',
   'カメラが欲しいのですが、どんな商品を植えると水やりされやすいですか？おすすめのカテゴリなどあれば教えてください🙏',
   'question', null, false, now() - interval '3 hours');

-- コメント
insert into board_comments (post_id, user_id, body, created_at) values
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000a5',
   'おめでとうございます！自分も頑張ります🌱', now() - interval '8 minutes'),
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000a4',
   '交換の輪、いいですね！', now() - interval '5 minutes'),
  ('d1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000a3',
   '家電やコスメは人気だと思います！', now() - interval '2 hours');
