-- ============================================================================
-- 0025_item_comment_split.sql — 商品コメント通知を新しい型に載せ替える
--
-- 0024 で足した 'item_comment' を実際に使う。
--   1. これから入る通知の型を変える（トリガー）
--   2. すでに溜まっている通知も直す（related_id が items に居るものが商品コメント）
--   3. プッシュの可否を新しい設定キー 'item_comment' で見る
--   4. 一覧の写真解決を新しい型にも対応させる
-- ============================================================================

-- 1. 商品へのコメント ────────────────────────────────────────
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
      v_owner, 'item_comment',
      coalesce(v_who, '誰か') || 'さん「' || coalesce(v_name, '商品') || '」：'
        || notification_excerpt(new.body),
      new.item_id
    );
  end if;
  return new;
end $$;

-- 2. 既存データの手当て ──────────────────────────────────────
-- board_comment のうち、related_id が商品を指しているものは商品コメント。
-- （掲示板の投稿IDと商品IDが衝突することはない＝どちらも uuid の別テーブル）
update notifications n
   set type = 'item_comment'
 where n.type = 'board_comment'
   and exists (select 1 from items i where i.id = n.related_id);

-- 3. プッシュの可否 ──────────────────────────────────────────
-- 列構成は 0018 で変わっているので、create or replace で書き直すと
-- 「cannot drop columns from view」で落ちる。列はそのままに、
-- 種類→設定キーの対応だけを差し替える。
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
    join profiles p on p.id = n.user_id
   where n.pushed_at is null
     and n.read_at is null
     and coalesce(
           (p.notification_prefs ->> (
              case n.type
                when 'watered'       then 'watered'
                when 'harvested'     then 'harvested'
                when 'shipped'       then 'ship'
                when 'received'      then 'ship'
                when 'message'       then 'message'
                when 'board_comment' then 'board'
                when 'item_comment'  then 'item_comment'
              end
            ))::boolean,
           true
         );

comment on view notifications_to_push is
  'まだプッシュしていない通知 × 端末トークン。本人が受け取る設定にしている種類だけを出す';

-- 4. 一覧の写真 ──────────────────────────────────────────────
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
    (
      select im.url
        from item_images im
       where im.item_id = case n.type
               when 'watered'      then n.related_id
               when 'harvested'    then (select h.root_item_id from harvests h where h.id = n.related_id)
               when 'shipped'      then (select e.item_id from exchanges e where e.id = n.related_id)
               when 'received'     then (select e.item_id from exchanges e where e.id = n.related_id)
               when 'message'      then (select e.item_id from exchanges e where e.id = n.related_id)
               when 'item_comment' then n.related_id
             end
       order by im.sort_order
       limit 1
    ) as image_url
  from notifications n
  left join profiles a on a.id = n.actor_id;

comment on view notification_cards is
  '通知一覧に出す情報。関係する商品の写真と、起こした人の名前・アイコンを解決済みで返す';
