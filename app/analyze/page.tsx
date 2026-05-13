'use client';

import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import AnalyzePage from '@/components/AnalyzePage';

function AnalyzePageContent({ onBack }: { onBack: () => void }) {
  return <AnalyzePage onBack={onBack} />;
}

export default function AnalyzePageRoute() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/');
  };

  return (
    <Suspense fallback={<div className="p-8 text-center">加载中...</div>}>
      <AnalyzePageContent onBack={handleBack} />
    </Suspense>
  );
}
