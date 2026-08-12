-- ============================================================================
-- 0020_notification_cards.sql — 通知を「誰から・何について」分かる形にする（2026-08-12）
--
-- 「メッセージが届きました」だけでは、誰からどの取引の話か分からなかった。
-- また一覧のアイコンが種類ごとの絵だけで、どれも同じ見た目になっていた。
--
-- 方針（メルカリのお知らせ画面に倣う）：
--   1. 本文に「誰から」「どの商品か」を入れる
--   2. 一覧の丸アイコンは "その通知に関係する商品の写真"。種類は小さなバッジで添える
--
-- 画像は通知ごとに参照先が違う（商品ID／収穫ID／取引ID）ので、
-- 画面側で分岐させず notification_cards ビューで解決してから渡す。
-- ============================================================================

-- ── 1. 本文に「誰から」「何について」を入れる ──────────────

-- 発送：受け取る人に届く
create or replace function ship_exchange(p_exchange_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e exchanges;
  v_who text;
  v_item text;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e.id is null then raise exception '取引が見つかりません'; end if;
  if e.from_user_id <> auth.uid() then raise exception '自分の発送ではありません'; end if;
  if e.status <> 'pending' then raise exception 'すでに発送済みです'; end if;

  update exchanges set status = 'shipped', shipped_at = now() where id = p_exchange_id;

  select nickname into v_who from profiles where id = e.from_user_id;
  select name into v_item from items where id = e.item_id;
  insert into notifications (user_id, type, body, related_id)
  values (
    e.to_user_id, 'shipped',
    coalesce(v_who, '相手') || 'さんが「' || coalesce(v_item, '商品') || '」を発送しました',
    p_exchange_id
  );
end $$;

-- 受け取り：送った人に届く
create or replace function receive_exchange(p_exchange_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e exchanges;
  v_mine exchanges;
  v_who text;
  v_item text;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e.id is null then raise exception '取引が見つかりません'; end if;
  if e.to_user_id <> auth.uid() then raise exception '自分の受け取りではありません'; end if;
  if e.status <> 'shipped' then raise exception 'まだ発送されていません'; end if;

  -- 自分が発送していないうちは受け取れない（滞留防止）
  select * into v_mine from exchanges
   where harvest_id = e.harvest_id and from_user_id = auth.uid();
  if v_mine.id is not null and v_mine.status = 'pending' then
    raise exception '先にご自身の発送を完了してください';
  end if;

  update exchanges set status = 'received', received_at = now() where id = p_exchange_id;

  select nickname into v_who from profiles where id = e.to_user_id;
  select name into v_item from items where id = e.item_id;
  insert into notifications (user_id, type, body, related_id)
  values (
    e.from_user_id, 'received',
    coalesce(v_who, '相手') || 'さんが「' || coalesce(v_item, '商品') || '」を受け取りました',
    p_exchange_id
  );
end $$;

-- 取引メッセージ
create or replace function notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  e exchanges;
  v_to uuid;
  v_who text;
  v_item text;
begin
  select * into e from exchanges where id = new.exchange_id;
  v_to := case when new.sender_id = e.from_user_id then e.to_user_id else e.from_user_id end;
  select nickname into v_who from profiles where id = new.sender_id;
  select name into v_item from items where id = e.item_id;
  insert into notifications (user_id, type, body, related_id)
  values (
    v_to, 'message',
    coalesce(v_who, '相手') || 'さんから「' || coalesce(v_item, '取引') || '」のメッセージが届きました',
    new.exchange_id
  );
  return new;
end $$;

-- 掲示板のコメント
create or replace function notify_board_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
  v_who text;
begin
  select user_id into v_author from board_posts where id = new.post_id;
  if v_author is not null and v_author <> new.user_id then
    select nickname into v_who from profiles where id = new.user_id;
    insert into notifications (user_id, type, body, related_id)
    values (
      v_author, 'board_comment',
      coalesce(v_who, '誰か') || 'さんが掲示板の投稿にコメントしました',
      new.post_id
    );
  end if;
  return new;
end $$;

-- 商品へのコメント
create or replace function notify_item_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_name text;
  v_who text;
begin
  select user_id, name into v_owner, v_name from items where id = new.item_id;
  if v_owner is not null and v_owner <> new.user_id then
    select nickname into v_who from profiles where id = new.user_id;
    insert into notifications (user_id, type, body, related_id)
    values (
      v_owner, 'board_comment',
      coalesce(v_who, '誰か') || 'さんが「' || coalesce(v_name, '商品') || '」にコメントしました',
      new.item_id
    );
  end if;
  return new;
end $$;

-- 収穫：どのタネの収穫かを入れる
create or replace function harvest_notice_body(p_harvest_id uuid)
returns text language sql stable as $$
  select '「' || coalesce(i.name, 'タネ') || '」の収穫が成立しました。発送をお願いします'
    from harvests h left join items i on i.id = h.root_item_id
   where h.id = p_harvest_id;
$$;

-- ── 2. 一覧に出す情報をまとめたビュー ───────────────────────
-- 画像の参照先が通知の種類ごとに違うので、ここで1つに解決する。
create or replace view notification_cards as
  select
    n.id,
    n.user_id,
    n.type,
    n.body,
    n.related_id,
    n.read_at,
    n.created_at,
    n.actor_id,
    a.nickname  as actor_nickname,
    a.avatar_url as actor_avatar,
    -- 通知に関係する商品の写真（無ければ null → 画面は種類の絵で代替する）
    (
      select im.url
        from item_images im
       where im.item_id = case n.type
               when 'watered'   then n.related_id                                    -- 水やりで出た商品
               when 'harvested' then (select h.root_item_id from harvests h where h.id = n.related_id)
               when 'shipped'   then (select e.item_id from exchanges e where e.id = n.related_id)
               when 'received'  then (select e.item_id from exchanges e where e.id = n.related_id)
               when 'message'   then (select e.item_id from exchanges e where e.id = n.related_id)
               when 'board_comment' then n.related_id                                -- 商品コメントのとき
             end
       order by im.sort_order
       limit 1
    ) as image_url
  from notifications n
  left join profiles a on a.id = n.actor_id;

comment on view notification_cards is
  '通知一覧に出す情報。関係する商品の写真と、起こした人の名前・アイコンを解決済みで返す';
