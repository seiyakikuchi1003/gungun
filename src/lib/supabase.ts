import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
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

/** supabase が未設定のときに分かりやすく落とすためのヘルパー */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase 未設定です。EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を .env に設定してください。'
    );
  }
  return supabase;
}
