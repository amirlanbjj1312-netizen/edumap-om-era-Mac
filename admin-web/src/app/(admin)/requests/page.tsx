'use client';

import { useAdminLocale } from '@/lib/adminLocale';

export default function RequestsPage() {
  const { t } = useAdminLocale();

  return (
    <div className="card">
      <h2>{t('requestsTitle')}</h2>
      <p>{t('requestsStub')}</p>
    </div>
  );
}
