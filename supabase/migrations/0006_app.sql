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
