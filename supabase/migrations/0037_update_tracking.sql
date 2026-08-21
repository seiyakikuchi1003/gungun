-- ============================================================================
-- 0037_update_tracking.sql — 追跡番号をあとから直せるようにする（2026-08-17）
--
-- 発送報告のときに一度だけ入力する作りだったので、打ち間違えると直せなかった。
-- 受け取る側は番号を頼りに荷物を追うので、間違ったままだと確認できない。
--
-- 直せるのは発送した本人だけ。受け取り済みになったあとは触らせない
-- （記録として残すため）。
-- ============================================================================

create or replace function update_tracking(
  p_exchange_id uuid,
  p_carrier text,
  p_tracking text
) returns void language plpgsql security definer set search_path = public as $$
declare
  e exchanges;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e.id is null then raise exception '取引が見つかりません'; end if;
  if e.from_user_id <> auth.uid() then raise exception '自分の発送ではありません'; end if;
  if e.status <> 'shipped' then
    raise exception '発送済みの取引だけ変更できます';
  end if;

  update exchanges
     set tracking_carrier = nullif(trim(p_carrier), ''),
         tracking_number = nullif(trim(p_tracking), '')
   where id = p_exchange_id;
end $$;

comment on function update_tracking is
  '発送後に配送業者・追跡番号を訂正する。発送した本人のみ、受け取り前まで';

revoke execute on function update_tracking(uuid, text, text) from public, anon;
grant execute on function update_tracking(uuid, text, text) to authenticated;
