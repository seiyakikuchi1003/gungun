-- ============================================================================
-- 0036_exchange_detail_tracking.sql — 取引詳細に配送情報を足す（2026-08-14）
--
-- 返す列が増えるので create or replace では置き換えられない
-- （「cannot change return type of existing function」）。一度落としてから作り直す。
-- ============================================================================

drop function if exists exchange_detail(uuid);

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
  partner_rated boolean,

  -- 配送情報（2026-08-14 追加）
  tracking_carrier text,
  tracking_number text
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
    exists (select 1 from ratings r where r.exchange_id = e.id and r.rater_id = v_partner),

    e.tracking_carrier,
    e.tracking_number
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
