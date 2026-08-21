-- ============================================================================
-- 0033_receive_message.sql — 受け取り報告のエラー文言を正しくする（項目5の続き）
--
-- 受け取り済みの取引にもう一度「受け取りを報告」すると
-- 「まだ発送されていません」と出ていた。status <> 'shipped' をまとめて
-- ひとつの文言で断っていたため、received のときも同じ文が出ていた。
--
-- 通信のやり直しや二重タップで簡単に踏むうえ、
-- 「発送されていない」と言われると相手を疑うことになる。状態ごとに言い分ける。
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

  -- すでに受け取り済みなら、それは失敗ではない。二重タップ・再送信で普通に起きる
  if e.status = 'received' then return; end if;
  if e.status = 'pending' then
    raise exception 'まだ相手が発送していません。発送されると通知が届きます';
  end if;

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

  -- 輪の全員が受け取り終わったら、その輪の商品を完了にする（0028）
  select count(*) into v_remaining
    from exchanges where harvest_id = e.harvest_id and status <> 'received';

  if v_remaining = 0 then
    update items set status = 'completed'
     where id in (select item_id from exchanges where harvest_id = e.harvest_id)
       and status = 'trading';
  end if;
end $$;

-- 発送も同じ考え方。すでに発送済みなら黙って成功にする（二重タップ対策）
create or replace function ship_exchange(p_exchange_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  e exchanges;
  v_who text;
  v_item text;
begin
  select * into e from exchanges where id = p_exchange_id;
  if e.id is null then raise exception '取引が見つかりません'; end if;
  if e.from_user_id <> auth.uid() then raise exception '自分の発送ではありません'; end if;
  if e.status <> 'pending' then return; end if;   -- すでに発送済み

  update exchanges set status = 'shipped', shipped_at = now() where id = p_exchange_id;

  select nickname into v_who from profiles where id = e.from_user_id;
  select name into v_item from items where id = e.item_id;
  insert into notifications (user_id, type, body, related_id)
  values (
    e.to_user_id, 'shipped',
    coalesce(v_who, '相手') || 'さんが「' || coalesce(v_item, '商品') || '」を発送しました',
    p_exchange_id
  );
end $$;
