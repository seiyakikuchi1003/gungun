import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { notificationRoute } from '@/lib/notificationRoute';

/**
 * プッシュ通知をタップしたら、その通知が指す画面へ飛ばす。
 *
 * 通知一覧の行タップと同じ遷移先を使う（notificationRoute に集約）。
 *
 * 2通りある：
 *   ・アプリを起動中／バックグラウンドでタップ → addNotificationResponseReceivedListener
 *   ・アプリが終了した状態でタップして起動 → getLastNotificationResponseAsync
 * 後者を忘れると「通知から開いたのにホームが出る」になるので両方見る。
 *
 * Web では何もしない（expo-notifications は実機向け）。
 */
export function usePushNavigation() {
  // 同じ通知で二度遷移しないよう、処理済みを覚えておく
  const handled = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    let subscription: { remove: () => void } | null = null;
    let alive = true;

    const go = (data: Record<string, unknown> | undefined, key: string) => {
      if (!data || handled.current.has(key)) return;
      handled.current.add(key);
      const type = typeof data.type === 'string' ? data.type : '';
      const relatedId = typeof data.related_id === 'string' ? data.related_id : null;
      router.push(notificationRoute(type, relatedId) as never);
    };

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (!alive) return;

        // 終了状態から通知で起動された場合
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last && alive) {
          go(last.notification.request.content.data, last.notification.request.identifier);
        }

        subscription = Notifications.addNotificationResponseReceivedListener((res) => {
          go(res.notification.request.content.data, res.notification.request.identifier);
        });
      } catch {
        // 通知が使えない環境では何もしない
      }
    })();

    return () => {
      alive = false;
      subscription?.remove();
    };
  }, []);
}
