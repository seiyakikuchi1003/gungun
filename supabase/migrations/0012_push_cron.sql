-- ============================================================================
-- 0012_push_cron.sql — プッシュ通知の定期送信（pg_cron → Edge Function）
--
-- 0009 で用意した notifications_to_push（未送信ぶんだけを出すビュー）を、
-- Edge Function send-push が1分おきに読んで Expo Push API に投げる。
-- その呼び出しをDB側の cron から行う。
--
-- 【前提】Edge Function がデプロイ済みであること
--   supabase functions deploy send-push --no-verify-jwt
--
-- 【呼び出し先をハードコードしない理由】
--   本番はめたん様のアカウントの別プロジェクトになる。URL を SQL に埋め込むと
--   移行後も開発用プロジェクトの関数を叩き続けてしまうため、app_settings から読む。
--   移行時は functions_base_url の行を新しいプロジェクトのものに差し替えるだけでよい。
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 呼び出し先（プロジェクトごとに差し替える） ──────────────────────────
insert into app_settings (key, value)
values (
  'functions_base_url',
  to_jsonb('https://bypjhlfcqzebmukwzthi.supabase.co/functions/v1'::text)
)
on conflict (key) do nothing;

-- ── 毎分実行のジョブを登録（登録済みなら一度外してから入れ直す） ────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-push') then
    perform cron.unschedule('send-push');
  end if;
end
$$;

select cron.schedule(
  'send-push',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select value #>> '{}' from public.app_settings where key = 'functions_base_url')
             || '/send-push',
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  $job$
);
