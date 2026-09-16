-- ============================================================================
-- 0053_board_like_notification.sql — 掲示板の投稿へのいいねを投稿者に伝える
--
-- 2026-09-16 の実機テストの指摘（種別は 0052 で追加済み）。
--
-- 商品のいいね（0048 notify_item_like）と同じ考え方で揃える：
--   ・自分の投稿に自分でいいねしたときは出さない
--   ・いいねは外して付け直しができるので、同じ人・同じ投稿では一度だけ
--
-- ※ 掲示板の「コメント」へのいいねは対象外。いいねの置き場（board_likes）が
--   投稿にしか無く、コメントに付けるにはスキーマの追加が要るため。
-- ============================================================================

create or replace function notify_board_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_body  text;
  v_who   text;
begin
  select user_id, body into v_owner, v_body from board_posts where id = new.post_id;
  -- 自分の投稿に自分でいいねしたときは出さない
  if v_owner is null or v_owner = new.user_id then return new; end if;

  select nickname into v_who from profiles where id = new.user_id;

  -- 投稿は長いので、通知の文面では先頭だけを見せる
  v_body := coalesce(v_body, '投稿');
  if length(v_body) > 20 then
    v_body := left(v_body, 20) || '…';
  end if;

  -- 同じ人から同じ投稿への「いいね」は一度だけ
  if exists (
    select 1 from notifications
     where user_id    = v_owner
       and type       = 'board_like'
       and related_id = new.post_id
       and body       = coalesce(v_who, '誰か') || 'さんがあなたの投稿「' || v_body || '」をいいねしました'
  ) then
    return new;
  end if;

  insert into notifications (user_id, type, body, related_id)
  values (
    v_owner, 'board_like',
    coalesce(v_who, '誰か') || 'さんがあなたの投稿「' || v_body || '」をいいねしました',
    new.post_id
  );
  return new;
end $$;

drop trigger if exists on_board_like_created on board_likes;
create trigger on_board_like_created
  after insert on board_likes
  for each row execute function notify_board_like();
