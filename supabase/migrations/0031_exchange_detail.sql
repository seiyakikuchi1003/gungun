-- ============================================================================
-- 0031_exchange_detail.sql — 取引詳細画面のためのデータ（2026-08-13 項目8）
--
-- 「誰と・何を・今どの段階か・次に何をすればいいか」を1画面で出すために、
-- 取引1件ぶんの情報をまとめて返す。docs/gungun-retool-adopt.md 1-5 の方針。
--
-- 【なぜ RPC か】
-- 1. addresses は本人しか読めない（RLS）。でも発送する人は宛先を知る必要がある。
--    テーブルのポリシーを緩めると全員の住所が読めてしまうので、
--    「この取引の発送者だけが、その取引の受取人の住所を読める」形にここで限定する。
-- 2. 評価済みかどうかも1往復で返す（画面で「評価する」を出すかの判断に要る）。
--
-- 【住所の出し分け】
--   発送する側 … 相手（受取人）の住所＋自分の住所（差出人として確認する）
--   受け取る側 … 自分の住所だけ。相手の住所は要らないので返さない。
-- 送る必要のない人にまで住所を渡さない、が原則。
-- ============================================================================

create or replace function exchange_detail(p_exchange_id uuid)
returns table (
  exchange_id uuid,
  harvest_id uuid,
  status exchange_status,
  i_am_sender boolean,
  shipped_at timestamptz,
  received_at timestamptz,

  item_id uuid,
  item_name text,
  item_condition text,
  item_image text,

  partner_id uuid,
  partner_name text,
  partner_avatar text,

  -- 宛先（発送する側にだけ入る）
  ship_to_name text,
  ship_to_phone text,
  ship_to_postal text,
  ship_to_address text,

  -- 自分の住所（未登録なら null → 発送できない）
  my_name text,
  my_phone text,
  my_postal text,
  my_address text,

  i_rated boolean,
  partner_rated boolean
) language plpgsql security definer set search_path = public stable as $$
declare
  e exchanges;
  v_me uuid := auth.uid();
  v_sender boolean;
  v_partner uuid;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e.id is null then return; end if;
  if v_me not in (coalesce(e.from_user_id, '00000000-0000-0000-0000-000000000000'),
                  coalesce(e.to_user_id,   '00000000-0000-0000-0000-000000000000')) then
    return;   -- 当事者以外には何も返さない
  end if;

  v_sender := (e.from_user_id = v_me);
  v_partner := case when v_sender then e.to_user_id else e.from_user_id end;

  return query
  select
    e.id,
    e.harvest_id,
    e.status,
    v_sender,
    e.shipped_at,
    e.received_at,

    e.item_id,
    coalesce(i.name, '削除された商品'),
    coalesce(i.condition, ''),
    (select im.url from item_images im where im.item_id = e.item_id order by im.sort_order limit 1),

    v_partner,
    coalesce(p.nickname, ''),
    p.avatar_url,

    -- 発送する側にだけ宛先を渡す
    case when v_sender then pa.last_name || ' ' || pa.first_name end,
    case when v_sender then pa.phone end,
    case when v_sender then pa.postal_code end,
    case when v_sender then
      pa.prefecture || pa.city || pa.street || coalesce(' ' || nullif(pa.building, ''), '')
    end,

    ma.last_name || ' ' || ma.first_name,
    ma.phone,
    ma.postal_code,
    ma.prefecture || ma.city || ma.street || coalesce(' ' || nullif(ma.building, ''), ''),

    exists (select 1 from ratings r where r.exchange_id = e.id and r.rater_id = v_me),
    exists (select 1 from ratings r where r.exchange_id = e.id and r.rater_id = v_partner)
  from (select 1) dummy
  left join items    i  on i.id = e.item_id
  left join profiles p  on p.id = v_partner
  left join addresses pa on pa.user_id = v_partner
  left join addresses ma on ma.user_id = v_me;
end $$;

comment on function exchange_detail is
  '取引詳細画面が必要とする情報一式。当事者にだけ返し、宛先は発送する人にだけ渡す';

revoke execute on function exchange_detail(uuid) from public, anon;
grant execute on function exchange_detail(uuid) to authenticated;

-- ============================================================================
-- 評価は1取引1人1回（2026-08-13 項目6）
--
-- これまでは on conflict do update で上書きしていたため、
-- 何度でも評価をやり直せてしまい、平均評価も後から動かせる状態だった。
-- 2回目は明示的に断る。
-- ============================================================================

create or replace function submit_rating(p_exchange_id uuid, p_score integer, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  e exchanges;
  v_ratee uuid;
  v_type rating_type;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e.id is null then raise exception '取引が見つかりません'; end if;
  if auth.uid() not in (e.from_user_id, e.to_user_id) then
    raise exception 'この取引の当事者ではありません';
  end if;
  if e.status <> 'received' then raise exception '受け取りが完了していません'; end if;

  if exists (select 1 from ratings where exchange_id = p_exchange_id and rater_id = auth.uid()) then
    raise exception 'この取引はすでに評価済みです';
  end if;

  -- 送った側は「対応（communication）」、受け取った側は「品質（quality）」を付ける
  if auth.uid() = e.from_user_id then
    v_ratee := e.to_user_id;   v_type := 'communication';
  else
    v_ratee := e.from_user_id; v_type := 'quality';
  end if;

  insert into ratings (exchange_id, rater_id, ratee_id, type, score, comment)
  values (p_exchange_id, auth.uid(), v_ratee, v_type, p_score, nullif(trim(p_comment), ''));
end $$;
