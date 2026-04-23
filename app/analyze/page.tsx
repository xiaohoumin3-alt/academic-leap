'use client';

import { useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import AnalyzePage from '@/components/AnalyzePage';

export default function AnalyzePageRoute() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/');
  };

  return (
    <SessionProvider>
      <AnalyzePage onBack={handleBack} />
    </SessionProvider>
  );
}
