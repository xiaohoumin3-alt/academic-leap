'use client';

import { useRouter } from 'next/navigation';
import HomePage from '@/components/HomePage';

export default function Home() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/practice');
  };

  const handleAssess = () => {
    router.push('/practice?mode=diagnostic');
  };

  const handleOpenConsole = () => {
    router.push('/console');
  };

  return (
    <HomePage
      onStart={handleStart}
      onAssess={handleAssess}
      onOpenConsole={handleOpenConsole}
    />
  );
}
