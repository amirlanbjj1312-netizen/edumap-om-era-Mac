'use client';

import { useAdminLocale } from '@/lib/adminLocale';

export default function StatisticsPage() {
  const { t } = useAdminLocale();

  return (
    <div className="card">
      <h2>{t('statisticsTitle')}</h2>
      <p>{t('statisticsStub')}</p>
    </div>
  );
}
