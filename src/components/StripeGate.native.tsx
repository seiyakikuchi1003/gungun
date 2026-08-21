import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

/** 支払いシート（Apple Pay を含む）を使うための土台。publishable キーは公開前提のもの。 */
export function StripeGate({ children }: { children: React.ReactElement }) {
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      merchantIdentifier="merchant.com.warashibe.gungun"
      urlScheme="gungun"
    >
      {children}
    </StripeProvider>
  );
}
