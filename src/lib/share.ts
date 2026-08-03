import { Platform, Share } from 'react-native';

export type ShareResult = 'shared' | 'copied' | 'cancelled';

/**
 * テキストを共有する。
 *
 * 実機（iOS/Android）は OS の共有シート。
 * Web は navigator.share が使えればそれ、無ければクリップボードにコピーする。
 * 呼び出し側が「コピーしました」を出せるよう、どの経路を通ったかを返す。
 */
export async function shareText(message: string): Promise<ShareResult> {
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ text: message });
        return 'shared';
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(message);
        return 'copied';
      }
      return 'cancelled';
    }
    const res = await Share.share({ message });
    return res.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    // ユーザーがキャンセルした場合など
    return 'cancelled';
  }
}
