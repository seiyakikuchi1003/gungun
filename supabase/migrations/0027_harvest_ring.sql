-- ============================================================================
-- 0027_harvest_ring.sql — 収穫完了（お祝い）画面のためのデータ（2026-08-12 項目9）
--
-- 【なぜ RPC が要るか】
-- exchanges の RLS は「自分が当事者の取引だけ」に絞っている。正しい制限だが、
-- お祝い画面は輪の全員（誰が何を受け取ったか）を見せる必要があるので、
-- そのままでは自分の1〜2件しか読めない。
-- そこで「その輪に参加している人にだけ、輪の全体を返す」RPC を用意する。
-- 参加していない人が呼んでも空になる。
--
-- 【輪の考え方】
-- exchanges.position が輪の中の順番（0始まり）。
-- position 0 が「種を植てた人が受け取る」ぶん＝輪の閉じ目にあたる。
-- 切り離された苗木（detach_children で外れた枝）は exchanges を持たないので、
-- 自然とこの輪には入らない＝指示書の「携わった人だけ」を満たす。
-- ============================================================================

create or replace function harvest_ring(p_harvest_id uuid)
returns table (
  -- position は予約語なので使えない（ring_position にしている）
  ring_position int,
  exchange_id uuid,
  status exchange_status,
  item_id uuid,
  item_name text,
  item_image text,
  giver_id uuid,
  giver_name text,
  giver_avatar text,
  receiver_id uuid,
  receiver_name text,
  receiver_avatar text
) language sql security definer set search_path = public stable as $$
  select
    e.position,
    e.id,
    e.status,
    e.item_id,
    coalesce(i.name, '削除された商品'),
    (select im.url from item_images im
      where im.item_id = e.item_id order by im.sort_order limit 1),
    e.from_user_id,
    coalesce(gp.nickname, '退会したユーザー'),
    gp.avatar_url,
    e.to_user_id,
    coalesce(rp.nickname, '退会したユーザー'),
    rp.avatar_url
  from exchanges e
  -- 退会・出品削除で item_id / user_id が NULL になることがある（0009 で set null）。
  -- inner join にすると輪から行が消えてしまうので left join にする。
  left join items i on i.id = e.item_id
  left join profiles gp on gp.id = e.from_user_id
  left join profiles rp on rp.id = e.to_user_id
  where e.harvest_id = p_harvest_id
    -- 呼び出した人がこの輪に参加しているときだけ返す
    and exists (
      select 1 from exchanges x
       where x.harvest_id = p_harvest_id
         and auth.uid() in (x.from_user_id, x.to_user_id)
    )
  order by e.position;
$$;

comment on function harvest_ring is
  '収穫でできた玉突きの輪の全体。参加者にだけ返す（お祝い画面用）';

grant execute on function harvest_ring(uuid) to authenticated;

-- ── 輪が閉じたら全員に知らせる ─────────────────────────────
create or replace function notify_ring_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_open int;
  v_root text;
  v_member uuid;
begin
  -- 受け取り以外が1つでも残っていれば、まだ輪は閉じていない
  select count(*) into v_open
    from exchanges
   where harvest_id = new.harvest_id
     and status <> 'received';
  if v_open > 0 then return new; end if;

  -- 二重に送らない（同じ輪の通知が既にあれば何もしない）
  if exists (
    select 1 from notifications
     where type = 'ring_completed' and related_id = new.harvest_id
  ) then
    return new;
  end if;

  select i.name into v_root
    from harvests h join items i on i.id = h.root_item_id
   where h.id = new.harvest_id;

  -- 輪の参加者（送った人・受け取った人）に重複なく配る
  for v_member in
    select distinct u from (
      select from_user_id as u from exchanges where harvest_id = new.harvest_id
      union
      select to_user_id   as u from exchanges where harvest_id = new.harvest_id
    ) m
  loop
    insert into notifications (user_id, type, body, related_id)
    values (
      v_member, 'ring_completed',
      '「' || coalesce(v_root, 'タネ') || '」の輪が完成しました！みんなの受け取りが終わりました🎉',
      new.harvest_id
    );
  end loop;

  return new;
end $$;

drop trigger if exists trg_notify_ring_completed on exchanges;
create trigger trg_notify_ring_completed
  after update of status on exchanges
  for each row when (new.status = 'received')
  execute function notify_ring_completed();
