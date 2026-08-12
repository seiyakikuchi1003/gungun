-- ============================================================================
-- 0019_notification_actor.sql — 通知に「誰が起こしたか」を持たせる（2026-08-12）
--
-- 通知一覧の相手アイコンが、実データでは中身の無い丸になっていた。
-- 誰が起こした通知かを持っていなかったため。
--
-- 【なぜ既定値が auth.uid() なのか】
--   通知は「その操作をした人」の処理の中で作られる（水やり・収穫・発送・コメント）。
--   つまり挿入時点の auth.uid() が、そのまま「起こした人」になる。
--   これを既定値にすれば、通知を作っている10か所の関数を1つも触らずに済む。
--   cron や service_role からの挿入では null になり、画面は種類アイコンで代替する。
-- ============================================================================

alter table notifications
  add column if not exists actor_id uuid references profiles on delete set null default auth.uid();

comment on column notifications.actor_id is
  'この通知を起こした人。挿入時の auth.uid() が既定。運営・自動処理からの通知では null';

create index if not exists notifications_actor_idx on notifications (actor_id);
