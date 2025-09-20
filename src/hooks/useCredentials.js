/**
 * Custom hook for managing API credentials
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredCredentials } from '@/utils/api';

export const useCredentials = (redirectTo = '/register') => {
  const router = useRouter();
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedCredentials = getStoredCredentials();
    
    if (storedCredentials) {
      setCredentials(storedCredentials);
    } else if (redirectTo) {
      router.push(redirectTo);
    }
    
    setLoading(false);
  }, [router, redirectTo]);

  return { credentials, loading, setCredentials };
};
