import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * 触覚フィードバック（バイブ）のヘルパー。
 * iOS の Taptic Engine を使用（expo-haptics）。Web では何もしない。
 * 失敗しても無視（サイレント設定・古い端末などで throw しないように）。
 *
 * 使い分けの目安：
 *  - tap()     … ボタン・カードを押した瞬間の「コッ」（軽い）
 *  - medium()  … タブ切り替え・モーダル表示など少し重めの「トン」
 *  - success() … 水やり完了・収穫・ボーナス受け取りなどの「タタン♪」
 *  - warning() … 取り消せない操作の前や失敗時
 */

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export function tap() {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function medium() {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** いいね・水やりなどリアクション用。インスタ/X風のしっかりした「ドッ」。 */
export function like() {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

export function success() {
  if (!isNative) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warning() {
  if (!isNative) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
