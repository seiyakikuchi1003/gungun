import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';

/**
 * プッシュ通知（要件定義 第11章 / 仕様書 Phase 8）。
 *
 * 【流れ】
 *   1. ログイン後に registerForPush() を呼ぶ
 *      → 権限を聞く → Expo Push Token を取得 → RPC register_push_token() で DB に保存
 *   2. サーバ側の送信ワーカーが notifications_to_push ビューを読んで送信し、
 *      notifications.pushed_at を埋める（＝二重送信しない）
 *   3. 通知をタップしたら該当ページへ遷移（app/_layout.tsx の usePushNavigation）
 *
 * 【Web では何もしない】
 *   Expo の push は実機（iOS/Android）向け。Web ビルドで expo-notifications を
 *   読み込むと動かないので、Platform で分けて動的 import する。
 *   ここを静的 import にすると Cloudflare Pages のプレビューが壊れる。
 *
 * 【実機での確認が必要】
 *   Expo Go では SDK 53 以降 push token を取れない。
 *   development build か TestFlight で確認する（docs/NEXT.md D-1）。
 */

/**
 * いまこの端末で登録しているトークン。
 *
 * ログアウト時に外すために覚えておく。unregister は auth.uid() を使うので
 * **サインアウトより前に**呼ぶ必要がある（後だと「ログインしていません」で失敗する）。
 */
let currentToken: string | null = null;

/** 端末が push を扱えるか（Web・シミュレータは不可） */
function isSupportedPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * EAS のプロジェクトID。getExpoPushTokenAsync に必須。
 * app.json の extra.eas.projectId か、EAS ビルド時に注入される値から読む。
 */
function easProjectId(): string | undefined {
  const c = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return c?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

/**
 * 通知の許可を求めて、トークンを DB に登録する。
 * 戻り値は登録できたトークン（できなければ null）。
 *
 * 断られても例外は投げない。通知が来ないだけでアプリは使えるべきなので。
 */
export async function registerForPush(): Promise<string | null> {
  if (!isSupportedPlatform() || !isSupabaseEnabled || !supabase) return null;

  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    // シミュレータでは取得できない
    if (!Device.isDevice) return null;

    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    const projectId = easProjectId();
    if (!projectId) {
      // EAS プロジェクトIDが無いと取得できない。設定漏れに気づけるよう警告だけ出す
      console.warn('[push] eas.projectId が未設定のため、プッシュ通知トークンを取得できません');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS,
    });
    if (error) throw error;
    currentToken = token;

    // Android は通知チャンネルが必要（無いと表示されない）
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '通知',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    return token;
  } catch (e) {
    // 権限拒否・ネットワーク断などで落とさない
    console.warn('[push] 登録できませんでした', e);
    return null;
  }
}

/**
 * ログアウト時に端末のトークンを外す（前の人に通知が飛ばないように）。
 *
 * ★ サインアウトより前に呼ぶこと。auth.uid() を使うため。
 * 失敗しても致命的ではない（同じ端末で誰かが再ログインすれば付け替わる）。
 */
export async function unregisterCurrentPush(): Promise<void> {
  const token = currentToken;
  currentToken = null;
  if (!token || !isSupportedPlatform() || !isSupabaseEnabled || !supabase) return;
  try {
    await supabase.rpc('unregister_push_token', { p_token: token });
  } catch {
    // 何もしない
  }
}

/**
 * 通知が届いたときの見せ方。アプリ起動中でもバナーを出す。
 * 実機のみ。Web では何もしない。
 */
export async function configureNotificationHandler(): Promise<void> {
  if (!isSupportedPlatform()) return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // 通知の見せ方が設定できなくてもアプリは動く
  }
}
