-- ============================================================================
-- 0011: 利用停止を掲示板にも効かせる ／ 閲覧履歴 ／ 評価一覧
--
--  1. 利用停止（is_suspended）が掲示板・コメントに効いていなかったのを塞ぐ
--  2. 「最近見た商品」のための閲覧履歴
--  3. プロフィールの評価一覧に出すためのビュー
-- ============================================================================


-- ══════════════════════════════════════════════════════════
-- 1. 利用停止中の書き込みを掲示板・コメントでも止める
-- ══════════════════════════════════════════════════════════
-- 0004 で assert_not_suspended() を用意し、0006 で plant_seed / water / harvest
-- の入口に入れたが、掲示板の投稿・コメント・商品コメントは RPC を通さない
-- 直 INSERT なので停止中でも書き込めていた。
-- 荒らし対応で「利用停止」を押しても掲示板は止まらない状態だったため塞ぐ。
--
-- RLS のポリシー側で弾く（RPC を増やさずに済み、経路が増えても漏れない）。

create or replace function is_suspended(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_suspended from profiles where id = p_user), false);
$$;

revoke all on function is_suspended(uuid) from public;
grant execute on function is_suspended(uuid) to authenticated, service_role;

-- 掲示板の投稿
drop policy if exists write_own_board_posts on board_posts;
create policy write_own_board_posts on board_posts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not is_suspended(auth.uid()));

-- 掲示板のコメント
drop policy if exists write_own_board_comments on board_comments;
create policy write_own_board_comments on board_comments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not is_suspended(auth.uid()));

-- 商品コメント（0007 で追加。ポリシー名は 0007 に合わせる）
drop policy if exists write_own_item_comments on item_comments;
create policy write_own_item_comments on item_comments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not is_suspended(auth.uid()));

-- 停止中に「いいね」まで塞ぐと荒らし対策としては過剰なので、書き込み系のうち
-- 投稿・コメント・出品・水やり・収穫だけを止める（閲覧は従来どおり可）。


-- ══════════════════════════════════════════════════════════
-- 2. 閲覧履歴（最近見た商品）
-- ══════════════════════════════════════════════════════════
-- 同じ商品を何度見ても1行。見た時刻だけ更新する（履歴が重複で埋まらないように）。

create table if not exists item_views (
  user_id   uuid not null references profiles on delete cascade,
  item_id   uuid not null references items    on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists item_views_user_viewed_idx on item_views (user_id, viewed_at desc);

alter table item_views enable row level security;

-- 自分の履歴だけ読める／書ける（誰が何を見たかは他人に見せない）
drop policy if exists own_item_views on item_views;
create policy own_item_views on item_views for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

/**
 * 閲覧を記録する。
 * 画面から upsert を直接呼んでもよいが、件数の上限を DB 側で抑えたいので関数にする
 * （1人あたり直近100件だけ残す。放っておくと無限に増える）。
 */
create or replace function touch_item_view(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;

  insert into item_views (user_id, item_id, viewed_at)
  values (v_user, p_item_id, now())
  on conflict (user_id, item_id) do update set viewed_at = now();

  delete from item_views
   where user_id = v_user
     and item_id not in (
       select item_id from item_views
        where user_id = v_user
        order by viewed_at desc
        limit 100
     );
end $$;

revoke all on function touch_item_view(uuid) from public;
grant execute on function touch_item_view(uuid) to authenticated;


-- ══════════════════════════════════════════════════════════
-- 3. 評価一覧
-- ══════════════════════════════════════════════════════════
-- プロフィールに星の平均しか出ていなかったので、内訳とコメントを見られるように。
-- 退会した人の評価も残す設計（rater_id は 0009 で NULL 許容）なので left join。

create or replace view rating_cards as
select
  r.id,
  r.ratee_id,
  r.rater_id,
  p.nickname   as rater_nickname,
  p.avatar_url as rater_avatar_url,
  r.type,
  r.score,
  r.comment,
  r.created_at
from ratings r
left join profiles p on p.id = r.rater_id;

alter view rating_cards set (security_invoker = on);
grant select on rating_cards to anon, authenticated;
