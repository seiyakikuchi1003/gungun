-- ============================================================================
-- 0048_like_notification.sql — いいねも出品者に伝える
--
-- 2026-09-09 の会議の指摘：
--   「自分に関連する木の情報であったり、種々の情報については通知は行くように」
--
-- 通知を洗い直したところ、自分の商品に関わる出来事のうち
-- 「いいね」だけ通知が無かった（水やり・コメント・収穫・発送・受け取り・
--  苗木・輪の完成はいずれも通知済み）。
--
-- いいねは外して付け直しができるので、そのたびに通知すると同じ人から
-- 何度も届く。同じ相手・同じ商品で一度出していたら、もう出さない。
--
-- 種別は 0046 で足した 'item_like' を使う。
-- ============================================================================

create or replace function notify_item_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_name  text;
  v_who   text;
begin
  select user_id, name into v_owner, v_name from items where id = new.item_id;
  -- 自分の商品に自分でいいねしたときは出さない
  if v_owner is null or v_owner = new.user_id then return new; end if;

  select nickname into v_who from profiles where id = new.user_id;

  -- 同じ人から同じ商品への「いいね」は一度だけ
  if exists (
    select 1 from notifications
     where user_id    = v_owner
       and type       = 'item_like'
       and related_id = new.item_id
       and body       = coalesce(v_who, '誰か') || 'さんが「' || coalesce(v_name, '商品') || '」をいいねしました'
  ) then
    return new;
  end if;

  insert into notifications (user_id, type, body, related_id)
  values (
    v_owner, 'item_like',
    coalesce(v_who, '誰か') || 'さんが「' || coalesce(v_name, '商品') || '」をいいねしました',
    new.item_id
  );
  return new;
end $$;

drop trigger if exists on_item_like_created on item_likes;
create trigger on_item_like_created
  after insert on item_likes
  for each row execute function notify_item_like();
