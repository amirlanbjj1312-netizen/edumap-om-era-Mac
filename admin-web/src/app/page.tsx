'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAuth as supabase } from '@/lib/supabaseAuth';
import { setGuestMode } from '@/lib/guestMode';
import { portalHomeByRole, resolvePortalRole } from '@/lib/portalRole';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      if (!session) {
        setGuestMode(true);
        router.replace('/parent/schools');
        return;
      }
      const role = resolvePortalRole(
        session.user?.user_metadata?.role || session.user?.app_metadata?.role
      );
      router.replace(portalHomeByRole(role));
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="page">
      <div className="container">
        <div className="card">Перенаправляем...</div>
      </div>
    </div>
  );
}
