'use client';

import { useRouter } from 'next/navigation';
import ConsolePage from '@/components/ConsolePage';

export default function ConsolePageRoute() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/');
  };

  return <ConsolePage onExit={handleBack} />;
}
