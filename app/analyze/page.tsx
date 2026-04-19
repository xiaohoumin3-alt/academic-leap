'use client';

import { useRouter } from 'next/navigation';
import AnalyzePage from '@/components/AnalyzePage';

export default function AnalyzePageRoute() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/');
  };

  return <AnalyzePage onBack={handleBack} />;
}
