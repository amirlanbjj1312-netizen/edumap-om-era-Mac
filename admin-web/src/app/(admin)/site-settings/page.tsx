'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { loadParentFooterSettings, updateParentFooterSettings } from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';

type FooterSettingsDraft = {
  socials: {
    instagram_url: string;
    telegram_url: string;
    whatsapp_url: string;
  };
  contacts: {
    phone_primary: string;
    phone_secondary: string;
    email: string;
  };
  legal: {
    privacy_url: string;
    privacy_name: string;
    terms_url: string;
    terms_name: string;
    faq_url: string;
  };
  updated_at?: string;
  updated_by?: string;
};

const EMPTY_DRAFT: FooterSettingsDraft = {
  socials: {
    instagram_url: '',
    telegram_url: '',
    whatsapp_url: '',
  },
  contacts: {
    phone_primary: '',
    phone_secondary: '',
    email: '',
  },
  legal: {
    privacy_url: '',
    privacy_name: '',
    terms_url: '',
    terms_name: '',
    faq_url: '',
  },
};

const toSafeFilePart = (name: string) => {
  const trimmed = name.trim().toLowerCase();
  const normalized = trimmed
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return normalized || 'file';
};

export default function SiteSettingsPage() {
  const { locale } = useAdminLocale();
  const [draft, setDraft] = useState<FooterSettingsDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const ui = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Site settings',
            subtitle: 'Parent footer',
            socials: 'Social links',
            contacts: 'Contacts',
            legal: 'Legal documents',
            instagram: 'Instagram link',
            telegram: 'Telegram link',
            whatsapp: 'WhatsApp link',
            phonePrimary: 'Primary phone',
            phoneSecondary: 'Secondary phone',
            email: 'Email',
            privacy: 'Privacy policy file',
            terms: 'Terms of use file',
            faq: 'FAQ link',
            current: 'Current file',
            save: 'Save',
            saving: 'Saving...',
            saved: 'Saved',
            loadError: 'Failed to load site settings.',
            uploadError: 'Failed to upload file. Check Supabase Storage bucket.',
          }
        : locale === 'kk'
          ? {
              title: 'Сайт баптаулары',
              subtitle: 'Ата-ана футері',
              socials: 'Әлеуметтік желілер',
              contacts: 'Байланыс',
              legal: 'Құқықтық құжаттар',
              instagram: 'Instagram сілтемесі',
              telegram: 'Telegram сілтемесі',
              whatsapp: 'WhatsApp сілтемесі',
              phonePrimary: 'Негізгі телефон',
              phoneSecondary: 'Қосымша телефон',
              email: 'Email',
              privacy: 'Құпиялық саясаты файлы',
              terms: 'Қолдану ережелері файлы',
              faq: 'FAQ сілтемесі',
              current: 'Ағымдағы файл',
              save: 'Сақтау',
              saving: 'Сақталуда...',
              saved: 'Сақталды',
              loadError: 'Сайт баптауларын жүктеу сәтсіз.',
              uploadError: 'Файлды жүктеу сәтсіз. Supabase Storage bucket тексеріңіз.',
            }
          : {
              title: 'Настройки сайта',
              subtitle: 'Футер родительского кабинета',
              socials: 'Соцсети',
              contacts: 'Контакты',
              legal: 'Правовые документы',
              instagram: 'Ссылка Instagram',
              telegram: 'Ссылка Telegram',
              whatsapp: 'Ссылка WhatsApp',
              phonePrimary: 'Основной телефон',
              phoneSecondary: 'Доп. телефон',
              email: 'Email',
              privacy: 'Файл политики конфиденциальности',
              terms: 'Файл правил пользования',
              faq: 'Ссылка на FAQ',
              current: 'Текущий файл',
              save: 'Сохранить',
              saving: 'Сохраняем...',
              saved: 'Сохранено',
              loadError: 'Не удалось загрузить настройки сайта.',
              uploadError: 'Не удалось загрузить файл. Проверь bucket в Supabase Storage.',
            },
    [locale]
  );

  useEffect(() => {
    let active = true;
    loadParentFooterSettings()
      .then((payload) => {
        if (!active) return;
        setDraft({
          ...EMPTY_DRAFT,
          ...(payload?.data || {}),
          socials: { ...EMPTY_DRAFT.socials, ...(payload?.data?.socials || {}) },
          contacts: { ...EMPTY_DRAFT.contacts, ...(payload?.data?.contacts || {}) },
          legal: { ...EMPTY_DRAFT.legal, ...(payload?.data?.legal || {}) },
        });
      })
      .catch(() => {
        if (!active) return;
        setStatus(ui.loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ui.loadError]);

  const setField = (section: 'socials' | 'contacts' | 'legal', key: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const uploadLegalFile = async (file: File, target: 'privacy' | 'terms') => {
    const configuredBucket = (process.env.NEXT_PUBLIC_MEDIA_BUCKET || '').trim();
    const buckets = Array.from(new Set([configuredBucket, 'school media', 'school-media'].filter(Boolean)));
    const safeName = toSafeFilePart(file.name);
    const path = `site/footer/legal/${Date.now()}-${safeName}`;
    let lastError: any = null;

    for (const bucket of buckets) {
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (error) {
        lastError = error;
        if (/bucket not found/i.test(error.message || '')) continue;
        throw error;
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = data?.publicUrl || '';
      setDraft((prev) => ({
        ...prev,
        legal: {
          ...prev.legal,
          [`${target}_url`]: publicUrl,
          [`${target}_name`]: file.name,
        } as FooterSettingsDraft['legal'],
      }));
      return;
    }

    throw lastError || new Error(ui.uploadError);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>, target: 'privacy' | 'terms') => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setStatus('');
      await uploadLegalFile(file, target);
    } catch {
      setStatus(ui.uploadError);
    } finally {
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('');
    try {
      const token = await supabase.auth.getSession().then(({ data }) => data?.session?.access_token || '');
      if (!token) throw new Error('No token');
      await updateParentFooterSettings(token, draft);
      setStatus(ui.saved);
    } catch {
      setStatus(ui.loadError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card" style={{ display: 'grid', gap: 20 }}>
          <div>
            <h1 style={{ margin: 0 }}>{ui.title}</h1>
            <p className="muted" style={{ margin: '8px 0 0' }}>{ui.subtitle}</p>
          </div>

          {loading ? <p className="muted">Loading...</p> : null}

          {!loading ? (
            <>
              <div style={{ display: 'grid', gap: 14 }}>
                <h3 style={{ margin: 0 }}>{ui.socials}</h3>
                <input value={draft.socials.instagram_url} onChange={(e) => setField('socials', 'instagram_url', e.target.value)} placeholder={ui.instagram} />
                <input value={draft.socials.telegram_url} onChange={(e) => setField('socials', 'telegram_url', e.target.value)} placeholder={ui.telegram} />
                <input value={draft.socials.whatsapp_url} onChange={(e) => setField('socials', 'whatsapp_url', e.target.value)} placeholder={ui.whatsapp} />
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                <h3 style={{ margin: 0 }}>{ui.contacts}</h3>
                <input value={draft.contacts.phone_primary} onChange={(e) => setField('contacts', 'phone_primary', e.target.value)} placeholder={ui.phonePrimary} />
                <input value={draft.contacts.phone_secondary} onChange={(e) => setField('contacts', 'phone_secondary', e.target.value)} placeholder={ui.phoneSecondary} />
                <input value={draft.contacts.email} onChange={(e) => setField('contacts', 'email', e.target.value)} placeholder={ui.email} />
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                <h3 style={{ margin: 0 }}>{ui.legal}</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  <label>{ui.privacy}</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFile(e, 'privacy')} />
                  {draft.legal.privacy_url ? (
                    <a href={draft.legal.privacy_url} target="_blank" rel="noreferrer">
                      {ui.current}: {draft.legal.privacy_name || draft.legal.privacy_url}
                    </a>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <label>{ui.terms}</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFile(e, 'terms')} />
                  {draft.legal.terms_url ? (
                    <a href={draft.legal.terms_url} target="_blank" rel="noreferrer">
                      {ui.current}: {draft.legal.terms_name || draft.legal.terms_url}
                    </a>
                  ) : null}
                </div>
                <input value={draft.legal.faq_url} onChange={(e) => setField('legal', 'faq_url', e.target.value)} placeholder={ui.faq} />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button type="button" className="topnav-logout" onClick={handleSave} disabled={saving}>
                  {saving ? ui.saving : ui.save}
                </button>
                {status ? <span className="muted">{status}</span> : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
