import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { registerForPush, unregisterCurrentPush } from '@/lib/push';

/**
 * 認証ストア。
 *
 * .env に Supabase の接続情報があれば **Supabase Auth を使う**。
 * 無ければ従来どおりモック（Webプレビュー用）で動く。
 * 画面側はどちらでも同じ API を呼ぶだけでよい。
 */

export type Profile = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  fertilizer: number;
  isPremium: boolean;
};

/** 各操作の戻り値。error が null なら成功 */
export type Result = { error: string | null };
/** サインアップは「メール確認が要るか」も返す */
export type SignUpResult = Result & { needsVerification: boolean };

type AuthState = {
  /** 起動時のセッション復元が終わったか（false の間は画面を出さない） */
  ready: boolean;
  authed: boolean;
  /** 実DB接続時のみ入る。モックでは null */
  profile: Profile | null;
  /** true なら本物の認証、false ならモック */
  live: boolean;

  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (email: string, password: string, nickname: string) => Promise<SignUpResult>;
  /** サインアップ／再設定メールの6桁コードを確認する */
  verifyCode: (email: string, code: string, purpose: 'signup' | 'recovery') => Promise<Result>;
  resendCode: (email: string) => Promise<Result>;
  /** パスワード再設定メールを送る */
  sendResetCode: (email: string) => Promise<Result>;
  /** ログイン中／コード確認直後にパスワードを変える */
  updatePassword: (password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  /** 退会（アカウントごと削除） */
  deleteAccount: () => Promise<Result>;
  /** 肥料残高などを取り直す */
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// ── モック用の永続化（Webプレビューでリロードしても保つ）──────
const KEY = 'gungun.mock.authed';
function loadMockAuthed(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
function saveMockAuthed(v: boolean) {
  try {
    globalThis.localStorage?.setItem(KEY, v ? '1' : '0');
  } catch {}
}

// ── Supabase のエラーを日本語にする ────────────────────────
// 英語のまま出すとユーザーが何をすればよいか分からないため。
function jp(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'メールアドレスまたはパスワードが違います';
  if (m.includes('email not confirmed')) return 'メールアドレスの確認が済んでいません。届いたコードを入力してください';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'このメールアドレスは既に登録されています';
  if (m.includes('password should be at least')) return 'パスワードは8文字以上にしてください';
  if (m.includes('weak password')) return 'パスワードが簡単すぎます。英数字を混ぜてください';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'メールアドレスの形式が正しくありません';
  if (m.includes('token has expired') || m.includes('expired'))
    return 'コードの有効期限が切れています。再送信してください';
  if (m.includes('invalid token') || m.includes('otp')) return 'コードが違います';
  if (m.includes('for security purposes') || m.includes('rate limit') || m.includes('too many'))
    return '試行が多すぎます。少し時間をおいてからお試しください';
  if (m.includes('fetch') || m.includes('network')) return '通信に失敗しました。電波の良い場所でお試しください';
  return message;
}

function toProfile(row: any): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url ?? null,
    bio: row.bio ?? null,
    fertilizer: row.fertilizer ?? 0,
    isPremium: Boolean(row.is_premium),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const live = isSupabaseEnabled;

  const [ready, setReady] = useState(!live); // モックなら復元不要
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mockAuthed, setMockAuthed] = useState(loadMockAuthed);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data ? toProfile(data) : null);
  }, []);

  // 起動時のセッション復元と、以降の状態変化の監視
  useEffect(() => {
    if (!live || !supabase) return;
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) {
        fetchProfile(data.session.user.id).finally(() => setReady(true));
        // 端末のプッシュ通知トークンを登録（Web・シミュレータでは何もしない）
        registerForPush();
      } else {
        setReady(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) {
        fetchProfile(s.user.id);
        if (event === 'SIGNED_IN') registerForPush();
      } else {
        setProfile(null);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [live, fetchProfile]);

  const value = useMemo<AuthState>(() => {
    // ── モック（Supabase 未接続）─────────────────────────
    if (!live || !supabase) {
      const noop = async (): Promise<Result> => ({ error: null });
      return {
        ready: true,
        authed: mockAuthed,
        profile: null,
        live: false,
        signIn: async () => {
          saveMockAuthed(true);
          setMockAuthed(true);
          return { error: null };
        },
        signUp: async () => {
          saveMockAuthed(true);
          setMockAuthed(true);
          return { error: null, needsVerification: false };
        },
        verifyCode: noop,
        resendCode: noop,
        sendResetCode: noop,
        updatePassword: noop,
        signOut: async () => {
          saveMockAuthed(false);
          setMockAuthed(false);
        },
        deleteAccount: async () => {
          saveMockAuthed(false);
          setMockAuthed(false);
          return { error: null };
        },
        reloadProfile: async () => {},
      };
    }

    // ── 本番（Supabase Auth）───────────────────────────
    const db = supabase;
    return {
      ready,
      authed: Boolean(session),
      profile,
      live: true,

      signIn: async (email, password) => {
        const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
        return { error: error ? jp(error.message) : null };
      },

      signUp: async (email, password, nickname) => {
        const { data, error } = await db.auth.signUp({
          email: email.trim(),
          password,
          // handle_new_user トリガがこの nickname で profiles を作る
          options: { data: { nickname: nickname.trim() } },
        });
        if (error) return { error: jp(error.message), needsVerification: false };
        // メール確認が有効なプロジェクトでは session が返らない
        return { error: null, needsVerification: !data.session };
      },

      verifyCode: async (email, code, purpose) => {
        const { error } = await db.auth.verifyOtp({
          email: email.trim(),
          token: code,
          type: purpose === 'signup' ? 'signup' : 'recovery',
        });
        return { error: error ? jp(error.message) : null };
      },

      resendCode: async (email) => {
        const { error } = await db.auth.resend({ type: 'signup', email: email.trim() });
        return { error: error ? jp(error.message) : null };
      },

      sendResetCode: async (email) => {
        const { error } = await db.auth.resetPasswordForEmail(email.trim());
        return { error: error ? jp(error.message) : null };
      },

      updatePassword: async (password) => {
        const { error } = await db.auth.updateUser({ password });
        return { error: error ? jp(error.message) : null };
      },

      signOut: async () => {
        // ★ サインアウトより前に外す（RPC が auth.uid() を使うため）
        await unregisterCurrentPush();
        await db.auth.signOut();
      },

      deleteAccount: async () => {
        await unregisterCurrentPush();
        const { error } = await db.rpc('delete_own_account');
        if (error) return { error: jp(error.message) };
        await db.auth.signOut();
        return { error: null };
      },

      reloadProfile: async () => {
        if (session) await fetchProfile(session.user.id);
      },
    };
  }, [live, ready, session, profile, mockAuthed, fetchProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
