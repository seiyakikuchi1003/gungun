-- ============================================================================
-- 0029_ring_notification_image.sql — お祝い通知の写真をタネにする
--
-- ring_completed は notification_cards の写真解決に入れていなかったため、
-- 一覧では「最後に受け取った人のアイコン」が出ていた。
-- 輪の話なので、起点になったタネの写真を出すのが自然。
-- ============================================================================

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
               when 'watered'        then n.related_id
               when 'harvested'      then (select h.root_item_id from harvests h where h.id = n.related_id)
               when 'ring_completed' then (select h.root_item_id from harvests h where h.id = n.related_id)
               when 'shipped'        then (select e.item_id from exchanges e where e.id = n.related_id)
               when 'received'       then (select e.item_id from exchanges e where e.id = n.related_id)
               when 'message'        then (select e.item_id from exchanges e where e.id = n.related_id)
               when 'item_comment'   then n.related_id
             end
       order by im.sort_order
       limit 1
    ) as image_url
  from notifications n
  left join profiles a on a.id = n.actor_id;

comment on view notification_cards is
  '通知一覧に出す情報。関係する商品の写真と、起こした人の名前・アイコンを解決済みで返す';
