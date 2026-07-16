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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const value = useMemo<AuthState>(
    () => ({
      authed,
      signIn: () => setAuthed(true),
      signOut: () => setAuthed(false),
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
