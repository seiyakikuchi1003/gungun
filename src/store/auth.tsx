import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * モック用の簡易認証ストア（React Context）。
 * ネイティブ化の際は Supabase Auth のセッションに置き換える。
 */
type AuthState = {
  authed: boolean;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

// Webプレビューではリロードでログアウトに戻ると不便なので保持する。
// （ネイティブ化の際は Supabase セッションに置き換えるため、この永続化ごと破棄）
const KEY = 'gungun.mock.authed';
function loadAuthed(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
function saveAuthed(v: boolean) {
  try {
    globalThis.localStorage?.setItem(KEY, v ? '1' : '0');
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(loadAuthed);
  const value = useMemo<AuthState>(
    () => ({
      authed,
      signIn: () => { saveAuthed(true); setAuthed(true); },
      signOut: () => { saveAuthed(false); setAuthed(false); },
    }),
    [authed]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
