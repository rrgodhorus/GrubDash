"use client";

import { AuthProvider } from 'react-oidc-context';
import { UserManager } from 'oidc-client-ts';

const userManager = new UserManager({
  authority: process.env.NEXT_PUBLIC_COGNITO_AUTHORITY!,
  client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
  redirect_uri: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI!,
  response_type: 'code',
  scope: 'openid email phone',
});

export function OIDCProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider userManager={userManager}>
      {children}
    </AuthProvider>
  );
}
