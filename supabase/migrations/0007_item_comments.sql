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
