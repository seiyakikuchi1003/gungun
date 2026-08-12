-- ============================================================================
-- 0022_notification_preview.sql — 通知に本文の抜粋を入れる（2026-08-12）
--
-- 「〇〇さんからメッセージが届きました」だけでは、開くまで用件が分からなかった。
-- メッセージ・コメントは実際の文面の冒頭を載せる（メルカリ／LINE と同じ考え方）。
--
-- 【抜粋の作り方】
--   改行は空白に潰し、長い場合は40字で切って「…」を付ける。
--   一覧は2行までなので、これ以上長くても読めない。
--
-- ⚠ ロック画面にも本文の一部が出る。見られたくない人向けに
--   「通知の内容を隠す」を設ける場合は、この抜粋を止めるだけでよい。
-- ============================================================================

create or replace function notification_excerpt(p_text text, p_len int default 40)
returns text language sql immutable as $$
  select case
           when p_text is null then ''
           when length(regexp_replace(p_text, '\s+', ' ', 'g')) <= p_len
             then regexp_replace(p_text, '\s+', ' ', 'g')
           else left(regexp_replace(p_text, '\s+', ' ', 'g'), p_len) || '…'
         end;
$$;

comment on function notification_excerpt is
  '通知に載せる本文の抜粋。改行を潰して指定文字数で切る';

-- ── 取引メッセージ ─────────────────────────────────────────
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
    coalesce(v_who, '相手') || 'さん「' || coalesce(v_item, '取引') || '」：'
      || notification_excerpt(new.body),
    new.exchange_id
  );
  return new;
end $$;

-- ── 掲示板のコメント ───────────────────────────────────────
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
      coalesce(v_who, '誰か') || 'さん：' || notification_excerpt(new.body),
      new.post_id
    );
  end if;
  return new;
end $$;

-- ── 商品へのコメント ───────────────────────────────────────
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
      coalesce(v_who, '誰か') || 'さん「' || coalesce(v_name, '商品') || '」：'
        || notification_excerpt(new.body),
      new.item_id
    );
  end if;
  return new;
end $$;
