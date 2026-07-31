-- 2026-07-28 めたん様定例MTG 反映分
--
-- 1) プレミアム特典：ログインボーナス増量を復活（通常40 / プレミアム80）
-- 2) 商品カードの water_count を「その商品の子ノード数」に一致させる
--    → 0006 で追加した item_cards ビューはすでに正しい定義。実データが view 側に無く
--    items テーブルの列を直接参照している画面を統一するための補助関数を追加。
-- 3) 苗木機能：harvest 経由の detach_children はすでに新root化する実装。
--    ここではリリース確認しやすいよう、収穫後に新root化した item を返す view を追加。
--
-- 4) 利用規約・プライバシーポリシーは app_settings に本文を格納できる形にする（差替え可）
--    小さいので JSON でそのまま置く。改行はそのまま保持。

-- ── 1. プレミアム用ログインボーナス設定 ─────────────────────
-- 既定値を差し込む。既にあれば据え置き（管理画面から変更可）。
insert into app_settings (key, value) values
  ('daily_login_bonus_premium', '80'::jsonb),
  ('terms_of_service',           '""'::jsonb),
  ('privacy_policy',              '""'::jsonb)
on conflict (key) do nothing;

-- claim_login_bonus を「プレミアム判定込み」で置き換える。
create or replace function claim_login_bonus()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_last date;
  v_premium boolean;
  v_amount int;
begin
  if v_uid is null then raise exception 'ログインしていません'; end if;

  select last_login_bonus_on, coalesce(is_premium, false)
    into v_last, v_premium
    from profiles where id = v_uid for update;
  if v_last = v_today then
    return 0;
  end if;

  if v_premium then
    v_amount := coalesce(
      get_setting_int('daily_login_bonus_premium'),
      get_setting_int('daily_login_bonus'),
      0
    );
  else
    v_amount := coalesce(get_setting_int('daily_login_bonus'), 0);
  end if;

  update profiles
     set fertilizer = fertilizer + v_amount,
         last_login_bonus_on = v_today
   where id = v_uid;

  insert into fertilizer_ledger (user_id, amount, reason)
  values (v_uid, v_amount, 'login_bonus');

  return v_amount;
end $$;

-- ── 2. 子ノード数の集計（画面から使えるように） ──────────────
-- item_cards は水やり数（＝子ノード数）を water_count として返している（0006）。
-- SDK が items テーブルを直接読んでいる箇所と食い違わないよう、items にも
-- 集計ビューを別に用意しておく（既存 view は温存）。
create or replace view item_water_counts as
select
  i.id as item_id,
  (select count(*) from items c where c.parent_id = i.id and c.status <> 'deleted') as water_count,
  (select count(*) from items t where t.root_id = i.root_id and t.status <> 'deleted') as tree_count
from items i;

alter view item_water_counts set (security_invoker = on);
grant select on item_water_counts to anon, authenticated;

-- ── 3. 苗木（新root化した item を追いやすくする view）──────
-- ある種 root_id が同じでも harvest によって切り出されると root_id が別の値になる。
-- 「元は誰の木にぶら下がっていたか」を追える view を用意しておく（管理画面・分析用）。
create or replace view sapling_items as
select
  i.id,
  i.user_id,
  i.name,
  i.category,
  i.status,
  i.created_at,
  i.root_id,
  h.root_item_id as detached_from_root
from items i
left join harvests h on h.harvested_item_id in (
  select id from get_ancestors(i.id)
)
where i.parent_id is null and i.root_id = i.id;

alter view sapling_items set (security_invoker = on);
grant select on sapling_items to anon, authenticated;

comment on function claim_login_bonus() is
  '2026-07-28: プレミアム会員は daily_login_bonus_premium を、通常会員は daily_login_bonus を受け取る。';
comment on view item_water_counts is
  '2026-07-28: 商品カードの「目のアイコン＋数字」の実データ元。子ノード数と一致。';
comment on view sapling_items is
  '2026-07-28: 苗木＝収穫後にパス外の枝が独立した種（parent_id=null, root_id=self）。detached_from_root で元木を辿れる。';
