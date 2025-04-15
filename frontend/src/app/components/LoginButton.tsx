"use client";

import { useAuth } from 'react-oidc-context';

export default function LoginButton() {
  const auth = useAuth();

  const signOutRedirect = () => {
    auth.signoutSilent();
    window.location.href = `${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/logout?client_id=${process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI!)}`;
  };

  if (auth.isLoading) return <div>Loading...</div>;
  if (auth.error) return <div>Error: {auth.error.message}</div>;

  if (auth.isAuthenticated) {
    const email = auth.user?.profile.email;

    return (
      <div>
        <p>Hello <strong>{email}</strong></p>
        <button className='bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded'
        onClick={() => signOutRedirect()}>Sign out</button>
      </div>
    );
  }

  return <button className='bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded'
   onClick={() => auth.signinRedirect()}>Sign in</button>;
}
