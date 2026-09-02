-- ============================================================================
-- 0042_migrations_ledger_rls.sql — 適用台帳を外から触れないようにする
--
-- Supabase のセキュリティ通知（2026-08-31）で "Table publicly accessible" として
-- 挙がったのは _gungun_migrations だった。これはマイグレーションの適用台帳で、
-- apply-schema.mjs / apply-schema-api.mjs が自動生成している。
-- アプリのテーブル24件は全部 RLS 済みだったが、この1件だけ付け忘れていた。
--
-- 中身はファイル名と適用日時だけなので漏れて困る情報はない。問題は書き込みの方で、
-- anon に INSERT/UPDATE/DELETE が通っていた。台帳の行を消されたり足されたりすると、
-- 次の db:apply が「適用済みを再実行」または「未適用を飛ばす」動きになり DB が壊れる。
--
-- ポリシーは作らない。適用スクリプトは postgres 権限（テーブル所有者）で動くので
-- RLS を素通りでき、anon / authenticated からは一切見えなくなる。
-- ============================================================================

alter table public._gungun_migrations enable row level security;

revoke all on public._gungun_migrations from anon, authenticated;
