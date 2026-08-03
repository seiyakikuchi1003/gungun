import type { NotificationType } from '@/data/mockSocial';

/**
 * 通知の種類ごとの遷移先（要件定義 第11章「通知タップで該当ページに遷移する」）。
 *
 * 通知一覧の行タップと、プッシュ通知のタップの両方から使う。
 * 片方だけ直すと挙動がずれるので、ここ1か所に集約する。
 *
 * relatedId が指すものは種類によって違う：
 *   watered / harvested → 商品ID
 *   shipped / received / message → 取引ID
 *   board_comment → 投稿ID
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
      return id ? `/harvest/${id}` : '/(tabs)/harvest';
    case 'shipped':
    case 'received':
    case 'message':
      return id ? `/exchange/${id}` : '/exchange';
    case 'board_comment':
      return id ? `/board/${id}` : '/(tabs)/board';
    default:
      return '/(tabs)';
  }
}
