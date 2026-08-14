-- ============================================================================
-- 0035_tracking_and_cancel.sql — 配送番号と、取引の取り消し（2026-08-14）
--
-- 【1. 配送番号】
-- 発送したあと「本当に送られたのか」「今どこにあるのか」を確かめる手段が無く、
-- 受け取る側は待つしかなかった。発送報告のときに配送業者と追跡番号を残せるようにする。
-- 追跡URLの組み立てはアプリ側（業者ごとの形式が変わっても配信で直せるように）。
-- 番号は任意。手渡しや、番号の出ない発送方法もあるため必須にはしない。
--
-- 【2. 取引の取り消し】
-- 収穫して輪ができたあと、事情が変わっても止める手段が無かった。
-- ただし物が動いたあとに巻き戻すと、誰の手元に何があるか分からなくなる。
-- そこで「まだ誰も発送していない」ときに限って、輪ごと取り消せるようにする。
--   ・1人でも発送済み → 取り消し不可（アプリ側は運営への連絡に誘導する）
--   ・取り消すと商品はすべて growing に戻り、また水やり・収穫の対象になる
--   ・参加者全員に通知する（黙って消えると不信感につながるため）
-- ============================================================================

alter table exchanges
  add column if not exists tracking_carrier text,
  add column if not exists tracking_number text;

comment on column exchanges.tracking_carrier is '配送業者（yamato / japanpost / sagawa / other）';
comment on column exchanges.tracking_number is '追跡番号。任意';

-- ── 発送報告に配送情報を添えられるようにする ────────────────
create or replace function ship_exchange(
  p_exchange_id uuid,
  p_carrier text default null,
  p_tracking text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  e exchanges;
  v_who text;
  v_item text;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e.id is null then raise exception '取引が見つかりません'; end if;
  if e.from_user_id <> auth.uid() then raise exception '自分の発送ではありません'; end if;
  if e.status <> 'pending' then return; end if;   -- すでに発送済み

  update exchanges
     set status = 'shipped',
         shipped_at = now(),
         tracking_carrier = nullif(trim(p_carrier), ''),
         tracking_number = nullif(trim(p_tracking), '')
   where id = p_exchange_id;

  select nickname into v_who from profiles where id = e.from_user_id;
  select name into v_item from items where id = e.item_id;
  insert into notifications (user_id, type, body, related_id)
  values (
    e.to_user_id, 'shipped',
    coalesce(v_who, '相手') || 'さんが「' || coalesce(v_item, '商品') || '」を発送しました'
      || case when nullif(trim(p_tracking), '') is not null then '（追跡番号あり）' else '' end,
    p_exchange_id
  );
end $$;

-- ── 輪ごと取り消す ─────────────────────────────────────────
create or replace function cancel_harvest(p_harvest_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_shipped int;
  v_root text;
  v_who text;
  v_member uuid;
begin
  if not exists (
    select 1 from exchanges
     where harvest_id = p_harvest_id and v_me in (from_user_id, to_user_id)
  ) then
    raise exception 'この取引の当事者ではありません';
  end if;

  select count(*) into v_shipped
    from exchanges where harvest_id = p_harvest_id and status <> 'pending';
  if v_shipped > 0 then
    raise exception 'すでに発送された商品があるため取り消せません。運営にご相談ください';
  end if;

  select i.name into v_root
    from harvests h join items i on i.id = h.root_item_id
   where h.id = p_harvest_id;
  select nickname into v_who from profiles where id = v_me;

  -- 先に知らせる（この後 exchanges を消すので、参加者を引けなくなる）
  for v_member in
    select distinct u from (
      select from_user_id as u from exchanges where harvest_id = p_harvest_id
      union
      select to_user_id   as u from exchanges where harvest_id = p_harvest_id
    ) m
  loop
    if v_member is not null then
      insert into notifications (user_id, type, body, related_id)
      values (
        v_member, 'harvested',
        coalesce(v_who, '参加者') || 'さんの申し出により「' || coalesce(v_root, 'タネ')
          || '」の取引は取り消されました'
          || case when nullif(trim(p_reason), '') is not null
                  then '（理由：' || left(trim(p_reason), 40) || '）' else '' end,
        null
      );
    end if;
  end loop;

  -- 商品を出品中に戻してから、輪を消す
  update items set status = 'growing'
   where id in (select item_id from exchanges where harvest_id = p_harvest_id)
     and status = 'trading';

  delete from exchanges where harvest_id = p_harvest_id;
  delete from harvests where id = p_harvest_id;
end $$;

comment on function cancel_harvest is
  'まだ誰も発送していない輪を取り消す。商品は出品中に戻り、参加者全員に通知する';

revoke execute on function cancel_harvest(uuid, text) from public, anon;
grant execute on function cancel_harvest(uuid, text) to authenticated;

-- 引数の少ない旧版が残っていると、名前付きで呼んだときにどちらか決まらず
-- 「function is not unique」で落ちる。新しい方に一本化する。
drop function if exists ship_exchange(uuid);
