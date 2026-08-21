-- ============================================================================
-- 0017_notification_prefs.sql — 通知設定のスイッチを実際に効かせる（2026-08-12）
--
-- 個人情報設定に「水やり／収穫／発送・受け取り／取引メッセージ／掲示板コメント」の
-- スイッチがあったが、画面の中だけの状態で保存もされず、送信側も見ていなかった。
-- 切っても通知が届く状態だったため、保存先を作って送信キューで参照する。
--
-- 【なぜ jsonb 1列か】
--   種類が増えるたびに列を足すと、そのつどマイグレーションと画面の両方を触ることになる。
--   キーが増えても DB は変えずに済む形にする。既定は「掲示板コメント以外はオン」。
-- ============================================================================

alter table profiles
  add column if not exists notification_prefs jsonb not null default
    '{"watered": true, "harvested": true, "ship": true, "message": true, "board": false}'::jsonb;

comment on column profiles.notification_prefs is
  '通知の種類ごとの受け取り設定。キーは画面のスイッチと対応（ship は発送・受け取りの両方）';

-- ── 送信キューで設定を見る ─────────────────────────────────
-- 通知の種類（enum）と画面のスイッチのキーを対応させる。
-- 設定に無いキーは「オン」とみなす（後から種類が増えても止まらないように）。
create or replace view notifications_to_push as
  select n.id,
         n.user_id,
         n.type,
         n.body,
         n.related_id,
         n.created_at,
         t.token,
         t.platform
    from notifications n
    join push_tokens t on t.user_id = n.user_id
    join profiles p on p.id = n.user_id
   where n.pushed_at is null
     and n.read_at is null
     and coalesce(
           (p.notification_prefs ->> (
              case n.type
                when 'watered'       then 'watered'
                when 'harvested'     then 'harvested'
                when 'shipped'       then 'ship'
                when 'received'      then 'ship'
                when 'message'       then 'message'
                when 'board_comment' then 'board'
              end
            ))::boolean,
           true
         );

comment on view notifications_to_push is
  'まだプッシュしていない通知 × 端末トークン。本人が受け取る設定にしている種類だけを出す';
