import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase クライアント（Phase 2 以降で使用）。
 *
 * URL / anon key は環境変数から読む（.env / app 設定）。未設定の間は null を返し、
 * アプリはモック（src/store/tree.tsx）で動く。プロジェクトができたら
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY を入れるだけで接続に切り替わる。
 *
 * ネイティブでは AsyncStorage にセッションを永続化。Web は既定のストレージ。
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** 環境変数が揃っていれば true（＝実DBに接続できる） */
export const isSupabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url!, anonKey!, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

/**
 * トークンの自動更新をアプリの前面／背面に合わせて開始・停止する。
 *
 * supabase-js の autoRefreshToken はタイマーで動くが、React Native では
 * アプリが背面にいる間タイマーが止まる。これを繋いでいないと、
 * しばらく背面に置いたあと戻したときに更新の機会を逃したままになり、
 * リフレッシュトークンの期限が切れてセッションごと消える。
 * ＝「アプリを開くとログインが外れている／別のアカウントになっている」
 * （2026-08-21 指摘：アプリ更新するたびにアカウントが変わる）。
 *
 * Supabase の React Native 向けの手順どおり AppState に繋ぐ。
 * Web はブラウザのタイマーが止まらないので不要。
 */
if (supabase && Platform.OS !== 'web') {
  // 起動直後は前面にいる前提で回し始める
  supabase.auth.startAutoRefresh();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** supabase が未設定のときに分かりやすく落とすためのヘルパー */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase 未設定です。EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を .env に設定してください。'
    );
  }
  return supabase;
}
