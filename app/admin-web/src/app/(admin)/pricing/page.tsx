'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/school-info');
  }, [router]);

  return <div className="card">Перенаправляем...</div>;
}
