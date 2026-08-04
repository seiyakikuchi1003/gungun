-- ============================================================================
-- 0010: プロフィールアイコンの保存先 ＋ 「自分がいいねしたか」を一覧に載せる
--
-- マイページ→編集でアイコンを選んでも保存されていなかった（2026-08-04 実機で発覚）。
-- アプリ側で選んだ画像を Storage に上げて profiles.avatar_url に入れる作りに直すため、
-- 専用のバケットを用意する。
--
-- item-images と同じ構成：公開読み取り／自分のフォルダにだけ書き込み可。
-- パスは  avatars/<user_id>/<ランダム>.jpg
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,   -- アイコンは2MBで十分
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 上書き（同じパスに入れ直す）も本人だけ
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================================
-- item_cards に「自分がいいねしたか」を足す
--
-- いいねを押しても更新すると消える／数が合わない、という症状があった。
-- 原因は一覧に「自分がいいねしたか」が無く、画面側が initial=false を
-- 決め打ちしていたこと（表示数が二重に足されていた）。
-- ビューに liked を持たせれば、既存の取得処理はそのままで全画面に効く。
--
-- security_invoker = on なので auth.uid() は呼び出したユーザーのものになる。
-- 未ログイン（anon）では auth.uid() が null なので liked は常に false。
-- ============================================================================

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
  (select count(*) from item_comments ic where ic.item_id = i.id) as comment_count,
  exists (select 1 from item_likes l where l.item_id = i.id and l.user_id = auth.uid()) as liked
from items i
join profiles p on p.id = i.user_id
where i.status <> 'deleted';

alter view item_cards set (security_invoker = on);
grant select on item_cards to anon, authenticated;

-- いいね一覧を新しい順に出せるように（押した順が分かるよう列を足す）
alter table item_likes  add column if not exists created_at timestamptz not null default now();
alter table board_likes add column if not exists created_at timestamptz not null default now();
create index if not exists item_likes_user_created_idx  on item_likes  (user_id, created_at desc);
create index if not exists board_likes_user_created_idx on board_likes (user_id, created_at desc);
