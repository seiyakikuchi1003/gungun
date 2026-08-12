-- ============================================================================
-- 0018_push_immediate.sql — 通知を即座に送る（2026-08-12）
--
-- これまでは1分おきの巡回だけだったので、最大1分の遅れが出ていた。
-- 通知が入った時点で送信ワーカーを起こし、体感の遅れを数秒にする。
--
-- 【1件ごとではなく文単位で起こす理由】
--   収穫すると通知が3件まとめて入る。行ごとに起こすと同じ処理を3回呼ぶことになる。
--   ワーカーは毎回キュー全体を処理するので、1回起こせば足りる。
--
-- 【cron は残す】
--   起動に失敗した／その瞬間ワーカーが落ちていた場合の取りこぼしを拾う保険。
--   二重に呼ばれても pushed_at と一意制約で二重送信にはならない。
-- ============================================================================

create or replace function wake_push_worker()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text;
begin
  select value #>> '{}' into v_url from app_settings where key = 'functions_base_url';
  if v_url is null then
    return null;   -- 送信先が未設定なら何もしない（cron が拾う）
  end if;

  -- 非同期。ここでHTTPの完了を待たないので、通知を作る処理は遅くならない
  perform net.http_post(
    url := v_url || '/send-push',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return null;
exception when others then
  -- 送信の起動に失敗しても、通知そのものの登録は成功させる（cron が拾う）
  return null;
end;
$$;

comment on function wake_push_worker is
  '通知が入ったら送信ワーカーを起こす。取りこぼしは1分おきの cron が拾う';

drop trigger if exists notifications_wake_push on notifications;
create trigger notifications_wake_push
  after insert on notifications
  for each statement
  execute function wake_push_worker();
