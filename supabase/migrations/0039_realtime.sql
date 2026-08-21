-- ============================================================================
-- 0039_realtime.sql — 即時反映のためのテーブル登録（2026-08-21）
--
-- アプリは次の3つを Realtime で受けて画面を更新している。
--   ・notifications … 通知の赤ポチ
--   ・exchanges     … ボトムナビの取引バッジ
--   ・messages      … 取引メッセージ
--
-- ところが supabase_realtime の publication に何も登録されていなかったため、
-- 購読しても通知が飛ばず、画面が古いままになっていた
-- （対応が終わっているのに取引の赤ポチが消えない、という形で表に出た）。
--
-- ※ Realtime は RLS を尊重するので、他人の行が流れることはない。
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table exchanges;
alter publication supabase_realtime add table messages;
