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
