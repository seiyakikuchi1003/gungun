-- ============================================================================
-- 0040_notification_manage.sql — 通知を片づけられるようにする（2026-08-21 指摘）
--
-- これまで通知は溜まる一方で、消すことも取っておくこともできなかった。
--   ・削除 … 見終わったものを消す
--   ・保存 … あとで見返したいものを残す（削除の対象から外れ、上に固定される）
--
-- 「全部消す」は保存したものを残す。うっかり大事なものまで消さないため。
-- ============================================================================

alter table notifications
  add column if not exists saved_at timestamptz;

comment on column notifications.saved_at is '保存した日時。入っていると一覧の上に固定し、一括削除の対象から外す';

-- 自分の通知は自分で消せる（RLS）
drop policy if exists delete_own_notifications on notifications;
create policy delete_own_notifications on notifications
  for delete using (auth.uid() = user_id);

-- 保存の付け外しも自分の行だけ
drop policy if exists update_own_notifications on notifications;
create policy update_own_notifications on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 一覧はこのビューを見ているので、保存状態も返す。
-- create or replace は列の並びを変えられないので、いったん落として作り直す。
drop view if exists notification_cards;
create view notification_cards as
  select n.id, n.user_id, n.type, n.body, n.related_id, n.read_at, n.created_at,
    n.saved_at, n.actor_id,
    a.nickname as actor_nickname, a.avatar_url as actor_avatar,
    (select im.url from item_images im
      where im.item_id = case n.type
        when 'watered'        then n.related_id
        when 'harvested'      then (select h.root_item_id from harvests h where h.id = n.related_id)
        when 'ring_completed' then (select h.root_item_id from harvests h where h.id = n.related_id)
        when 'shipped'        then (select e.item_id from exchanges e where e.id = n.related_id)
        when 'received'       then (select e.item_id from exchanges e where e.id = n.related_id)
        when 'message'        then (select e.item_id from exchanges e where e.id = n.related_id)
        when 'item_comment'   then n.related_id
      end
      order by im.sort_order limit 1) as image_url
  from notifications n
  left join profiles a on a.id = n.actor_id;
