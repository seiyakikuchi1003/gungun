import React from 'react';

/**
 * Web では Stripe のネイティブSDKを読み込まない（書き出しが失敗するため）。
 * 実機用は StripeGate.native.tsx にある。
 */
export function StripeGate({ children }: { children: React.ReactElement }) {
  return <>{children}</>;
}
