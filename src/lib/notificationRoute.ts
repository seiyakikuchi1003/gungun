import type { NotificationType } from '@/data/mockSocial';

/**
 * 通知の種類ごとの遷移先（要件定義 第11章「通知タップで該当ページに遷移する」）。
 *
 * 通知一覧の行タップと、プッシュ通知のタップの両方から使う。
 * 片方だけ直すと挙動がずれるので、ここ1か所に集約する。
 *
 * relatedId が指すものは種類によって違う：
 *   watered                      → 商品ID
 *   harvested                    → ★収穫ID（商品IDではない）
 *   shipped / received / message → 取引ID
 *   board_comment                → 投稿ID
 *   item_comment                 → 商品ID
 *   ring_completed               → 収穫ID（お祝い画面）
 *
 * relatedId が無い通知（古いデータ・DBが埋め忘れ）は、種類に応じた一覧へ寄せる。
 */
export function notificationRoute(type: NotificationType | string, relatedId?: string | null): string {
  const id = relatedId || null;
  switch (type) {
    case 'watered':
      // 水やりされた＝自分の商品に子が付いた。その商品の木を見せる
      return id ? `/tree/${id}` : '/(tabs)/harvest';
    case 'harvested':
      // 本文は「収穫が成立しました。発送をお願いします」なので、次にすることは発送。
      // relatedId は収穫IDで、商品IDではない。以前は /harvest/<収穫ID> に飛ばしており、
      // 対象が見つからず真っ白な画面で戻れなくなっていた（2026-08-12 修正）。
      // 取引一覧に寄せる（自分の取引が「送る」タブに並ぶ）。
      return '/exchange';
    case 'shipped':
    case 'received':
    case 'message':
      return id ? `/exchange/${id}` : '/exchange';
    case 'board_comment':
      return id ? `/board/${id}` : '/(tabs)/board';
    case 'ring_completed':
      // 輪が一周した。全体がどう繋がったかをお祝い画面で見せる
      return id ? `/celebration/${id}` : '/exchange';
    case 'item_comment':
      // 以前は商品コメントも board_comment 型で入れていたため、
      // /board/<商品ID> に飛んで真っ白な画面になっていた（2026-08-12 修正）
      return id ? `/item/${id}` : '/(tabs)';
    default:
      return '/(tabs)';
  }
}
