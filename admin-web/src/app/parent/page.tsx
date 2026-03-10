'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParentHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/parent/news');
  }, [router]);

  return (
    <div className="card">
      <p className="muted">Загружаем кабинет родителя...</p>
    </div>
  );
}
