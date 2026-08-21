export const runtime = "edge";

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ぐんぐん 管理画面',
  description: 'ユーザー・商品・通報の管理とアプリ設定',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
