"use client";

import { useAuth } from 'react-oidc-context';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CallbackPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading) {
      if (auth.isAuthenticated) router.push('/');
      else router.push('/login');  // fallback
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return <div>Processing login...</div>;
}
