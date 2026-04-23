'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConsolePage from '@/components/ConsolePage';
import MaterialIcon from '../../components/MaterialIcon';

export default function ConsolePageRoute() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    fetch('/api/admin/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        if (data.success) {
          setIsAuthenticated(true);
        } else {
          router.push('/console/login');
        }
      })
      .catch(() => {
        router.push('/console/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const handleBack = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return <ConsolePage onExit={handleBack} />;
}
