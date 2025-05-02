"use client";

import { useAuth } from 'react-oidc-context';

export default function LoginButton() {
  const auth = useAuth();
  
  if (auth.error) return <div>Error: {auth.error.message}</div>;

  if (auth.isAuthenticated) {
    return (
      <div>
        <button className='bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md'
        onClick={() => auth.signoutSilent()}>Sign out</button>
      </div>
    );
  }

  return <button className='bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-2 rounded-lg shadow-md'
  onClick={() => auth.signinRedirect()}>Sign in</button>;
}
