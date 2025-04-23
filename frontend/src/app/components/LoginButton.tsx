"use client";

import { useAuth } from 'react-oidc-context';

export default function LoginButton() {
  const auth = useAuth();

  const signOutRedirect = () => {
    auth.signoutSilent();
    window.location.href = `${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/logout?client_id=${process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI!)}`;
  };

  // if (auth.isLoading) return <div>Loading...</div>;
  if (auth.error) return <div>Error: {auth.error.message}</div>;

  if (auth.isAuthenticated) {
    const email = auth.user?.profile.email;

    return (
      <div>
        <p>Hello <strong>{email}</strong></p>
        <button className='bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md'
        onClick={() => signOutRedirect()}>Sign out</button>
      </div>
    );
  }

  return <button className='bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md'
   onClick={() => auth.signinRedirect()}>Sign in</button>;
}
