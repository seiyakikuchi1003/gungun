-- ============================================================================
-- 0028_receive_completes_items.sql — 取引が終わった商品を「完了」に戻す
--
-- 【見つかり方】
-- npm run check:harvest の「評価が揃った商品が completed になる」が落ちた。
-- 実際、輪の全員が受け取り終わっても商品が trading のままだった。
--
-- 【原因】
-- 0006 の receive_exchange には「輪の全員が受け取ったら items を completed に
-- する」処理があったが、その後 通知文言を直すために関数を丸ごと書き直した際に、
-- その1ブロックだけが引き継がれずに消えていた。
-- create or replace で関数を作り直すときの典型的な取りこぼし。
--
-- 【影響】
-- 取引が終わった商品がいつまでも「取引中」と表示され、
-- マイページの履歴や木の表示でも終わったことが分からない状態になっていた。
--
-- 今の定義（発送の滞留防止・通知の文面）はそのままに、完了処理を戻す。
-- ============================================================================

create or replace function receive_exchange(p_exchange_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e exchanges;
  v_mine exchanges;
  v_who text;
  v_item text;
  v_remaining int;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e.id is null then raise exception '取引が見つかりません'; end if;
  if e.to_user_id <> auth.uid() then raise exception '自分の受け取りではありません'; end if;
  if e.status <> 'shipped' then raise exception 'まだ発送されていません'; end if;

  -- 自分が発送していないうちは受け取れない（滞留防止）
  select * into v_mine from exchanges
   where harvest_id = e.harvest_id and from_user_id = auth.uid();
  if v_mine.id is not null and v_mine.status = 'pending' then
    raise exception '先にご自身の発送を完了してください';
  end if;

  update exchanges set status = 'received', received_at = now() where id = p_exchange_id;

  select nickname into v_who from profiles where id = e.to_user_id;
  select name into v_item from items where id = e.item_id;
  insert into notifications (user_id, type, body, related_id)
  values (
    e.from_user_id, 'received',
    coalesce(v_who, '相手') || 'さんが「' || coalesce(v_item, '商品') || '」を受け取りました',
    p_exchange_id
  );

  -- 輪の全員が受け取り終わったら、その輪の商品を完了にする（0006 から復活）
  select count(*) into v_remaining
    from exchanges where harvest_id = e.harvest_id and status <> 'received';

  if v_remaining = 0 then
    update items set status = 'completed'
     where id in (select item_id from exchanges where harvest_id = e.harvest_id)
       and status = 'trading';
  end if;
end $$;

-- ── 取りこぼしていた分の手当て ──────────────────────────────
-- すでに全員が受け取り終わっているのに trading のままの商品を完了にする
update items i
   set status = 'completed'
 where i.status = 'trading'
   and exists (
     select 1 from exchanges e
      where e.item_id = i.id
        and not exists (
          select 1 from exchanges x
           where x.harvest_id = e.harvest_id and x.status <> 'received'
        )
   );
