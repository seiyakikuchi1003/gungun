-- ============================================================================
-- 0043_meeting_0821.sql — 2026-08-21 20:28 の会議で出た指摘の DB 側
--
-- 1. 人気のワード／タグ＝検索ボリューム順 → search_logs と popular_keywords
-- 2. 苗木になったことが分からない → 独立したときに通知する（使うのは 0044）
-- 3. 3段目以降の水やりが種の持ち主に届かない → 木の持ち主にも通知する（0044）
--
-- ※「おすすめ＝プレミアム会員を優先」は profiles.is_premium が
--   そのまま読めるため、DB を変えずに画面側で並べ替える（src/hooks/usePremiumOwners.ts）。
-- ============================================================================

-- ── 1. 検索ログ（人気のワード・人気のタグ）────────────────
-- これまで「人気のキーワード」「人気のタグ」は定数を並べていただけで、
-- 実際に何が検索されているかとは無関係だった。
-- 実際に検索された語を貯めて、多い順に出す。
create table if not exists search_logs (
  id bigserial primary key,
  -- 誰が検索したかは集計に不要。退会でログが消えないよう参照は張らない
  user_id uuid,
  -- 正規化済みの検索語（小文字・前後の空白を落としたもの）
  term text not null,
  -- 'item'（商品検索）か 'board'（掲示板検索）か
  scope text not null default 'item',
  created_at timestamptz not null default now()
);
create index if not exists search_logs_term_idx on search_logs (scope, created_at desc);

alter table search_logs enable row level security;

-- 書き込みはログイン済みの本人ぶんだけ。読むのは集計関数（definer）経由のみ。
drop policy if exists search_logs_insert on search_logs;
create policy search_logs_insert on search_logs
  for insert to authenticated with check (user_id = auth.uid());

/**
 * 直近30日でよく検索された語。
 *
 * 1文字だけの語と、極端に長い語は雑音になるので落とす。
 * 同じ人が連打したぶんで順位が動かないよう、人数（distinct user）で数える。
 */
create or replace function popular_keywords(p_scope text default 'item', p_limit int default 10)
returns table (term text, hits bigint)
language sql security definer set search_path = public stable as $$
  select s.term, count(distinct coalesce(s.user_id::text, s.id::text)) as hits
  from search_logs s
  where s.scope = p_scope
    and s.created_at > now() - interval '30 days'
    and char_length(s.term) between 2 and 30
  group by s.term
  order by hits desc, max(s.created_at) desc
  limit greatest(1, least(p_limit, 30));
$$;

grant execute on function popular_keywords(text, int) to anon, authenticated;

/** 検索語を1件記録する（呼び出しは画面から。失敗しても検索は続ける） */
create or replace function log_search(p_term text, p_scope text default 'item')
returns void language plpgsql security definer set search_path = public as $$
declare v_term text;
begin
  if auth.uid() is null then return; end if;
  v_term := lower(btrim(coalesce(p_term, '')));
  if char_length(v_term) < 2 or char_length(v_term) > 30 then return; end if;
  insert into search_logs (user_id, term, scope) values (auth.uid(), v_term, p_scope);
end $$;

grant execute on function log_search(text, text) to authenticated;

-- ── 2. 苗木になったときの通知 ──────────────────────────────
alter type notification_type add value if not exists 'sapling';
