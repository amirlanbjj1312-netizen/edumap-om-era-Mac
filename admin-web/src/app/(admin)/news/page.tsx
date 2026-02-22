'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createNewsItem,
  deleteNewsItem,
  loadNewsFeed,
  updateNewsItem,
} from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';

const isModerator = (role: string) => role === 'moderator' || role === 'superadmin';

const splitList = (value: string) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const joinList = (value: string[] = []) => value.filter(Boolean).join(', ');

const initialForm = {
  title: '',
  titleEn: '',
  titleKk: '',
  summary: '',
  summaryEn: '',
  summaryKk: '',
  category: 'Announcements',
  tags: '',
  imageUrls: '',
  videoUrls: '',
  content: '',
  contentEn: '',
  contentKk: '',
  publishedAt: '',
};
const CATEGORY_OPTIONS = [
  { value: 'announcements', labels: { ru: 'Объявления', en: 'Announcements', kk: 'Хабарландырулар' } },
  { value: 'tips', labels: { ru: 'Полезные советы', en: 'Useful tips', kk: 'Пайдалы кеңестер' } },
  { value: 'events', labels: { ru: 'События', en: 'Events', kk: 'Оқиғалар' } },
  { value: 'competitions', labels: { ru: 'Конкурсы', en: 'Competitions', kk: 'Байқаулар' } },
];
const normalizeCategoryValue = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase();
const mapCategoryToOptionValue = (value: string) => {
  const normalized = normalizeCategoryValue(value);
  if (!normalized) return 'announcements';
  if (
    ['announcements', 'announcement', 'объявления', 'объявление', 'хабарландырулар'].includes(normalized)
  ) {
    return 'announcements';
  }
  if (['tips', 'useful tips', 'полезные советы', 'пайдалы кеңестер'].includes(normalized)) {
    return 'tips';
  }
  if (['events', 'события', 'оқиғалар'].includes(normalized)) {
    return 'events';
  }
  if (['competitions', 'contests', 'конкурсы', 'байқаулар'].includes(normalized)) {
    return 'competitions';
  }
  return 'announcements';
};

export default function AdminNewsPage() {
  const { locale, setLocale, t } = useAdminLocale();
  const [authReady, setAuthReady] = useState(false);
  const [actorRole, setActorRole] = useState('user');
  const [actorEmail, setActorEmail] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [mediaMessage, setMediaMessage] = useState('');
  const [message, setMessage] = useState('');
  const [news, setNews] = useState<any[]>([]);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState(initialForm);
  const localeKey = (locale === 'ru' || locale === 'en' || locale === 'kk' ? locale : 'ru') as
    | 'ru'
    | 'en'
    | 'kk';
  const textFieldKeyMap = useMemo(
    () => ({
      title: locale === 'en' ? 'titleEn' : locale === 'kk' ? 'titleKk' : 'title',
      summary: locale === 'en' ? 'summaryEn' : locale === 'kk' ? 'summaryKk' : 'summary',
      content: locale === 'en' ? 'contentEn' : locale === 'kk' ? 'contentKk' : 'content',
    }),
    [locale]
  );
  const localeBadge = locale === 'kk' ? 'KZ' : locale.toUpperCase();
  const localizedFieldLabels = useMemo(
    () =>
      locale === 'en'
        ? {
            title: 'Title',
            summary: 'Summary',
            content: 'Content',
            category: 'Category',
            tags: 'Tags (comma separated)',
            imageUrls: 'Image URLs (comma separated)',
            videoUrls: 'Video URLs (comma separated)',
            publishedAt: 'Published at (ISO, optional)',
          }
        : locale === 'kk'
        ? {
            title: 'Атауы',
            summary: 'Қысқаша сипаттама',
            content: 'Мәтін',
            category: 'Санат',
            tags: 'Тегтер (үтір арқылы)',
            imageUrls: 'Сурет URL-дары (үтір арқылы)',
            videoUrls: 'Видео URL-дары (үтір арқылы)',
            publishedAt: 'Жарияланған уақыты (ISO, міндетті емес)',
          }
        : {
            title: 'Название',
            summary: 'Краткое описание',
            content: 'Текст',
            category: 'Категория',
            tags: 'Теги (через запятую)',
            imageUrls: 'URL изображений (через запятую)',
            videoUrls: 'URL видео (через запятую)',
            publishedAt: 'Дата публикации (ISO, необязательно)',
          },
    [locale]
  );
  const setLocalizedField = useCallback(
    (field: 'title' | 'summary' | 'content', value: string) => {
      const key = textFieldKeyMap[field];
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [textFieldKeyMap]
  );
  const getLocalizedField = useCallback(
    (field: 'title' | 'summary' | 'content') => {
      const key = textFieldKeyMap[field];
      return String((form as any)[key] || '');
    },
    [form, textFieldKeyMap]
  );

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      setToken(session?.access_token || '');
      setActorEmail(session?.user?.email || '');
      setActorRole(
        session?.user?.user_metadata?.role || session?.user?.app_metadata?.role || 'user'
      );
      setAuthReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await loadNewsFeed();
      setNews(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      setMessage((error as Error)?.message || t('saveError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    reload();
  }, [reload]);

  const resetForm = useCallback(() => {
    setEditId('');
    setForm(initialForm);
    setMediaMessage('');
  }, []);

  const startEdit = useCallback((item: any) => {
    setEditId(item?.id || '');
    setMediaMessage('');
    setForm({
      title: item?.title || '',
      titleEn: item?.titleEn || '',
      titleKk: item?.titleKk || '',
      summary: item?.summary || '',
      summaryEn: item?.summaryEn || '',
      summaryKk: item?.summaryKk || '',
      category: mapCategoryToOptionValue(item?.category || 'announcements'),
      tags: joinList(item?.tags || []),
      imageUrls: joinList(item?.imageUrls || []),
      videoUrls: joinList(item?.videoUrls || []),
      content: item?.content || '',
      contentEn: item?.contentEn || '',
      contentKk: item?.contentKk || '',
      publishedAt: item?.publishedAt || '',
    });
  }, []);
  const uploadNewsImages = useCallback(
    async (files: File[]) => {
      if (!files.length) return [];
      const configuredBucket = (process.env.NEXT_PUBLIC_MEDIA_BUCKET || '').trim();
      const buckets = Array.from(
        new Set([configuredBucket, 'school media', 'school-media'].filter(Boolean))
      );
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const baseId = (actorEmail || 'moderator').replace(/[^a-zA-Z0-9-_.]/g, '-');
      const uploadedUrls: string[] = [];
      let lastError: any = null;

      for (const file of files) {
        const safeName = file.name.replace(/\s+/g, '-').toLowerCase();
        const dotIndex = safeName.lastIndexOf('.');
        const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
        const ext = dotIndex > 0 ? safeName.slice(dotIndex + 1) : 'bin';
        const path = `news/${baseId}/images/${Date.now()}-${baseName}.${ext}`;

        let uploaded = false;
        for (const bucket of buckets) {
          const { error } = await supabase.storage.from(bucket).upload(path, file, {
            upsert: true,
            contentType: file.type || undefined,
          });
          if (error) {
            lastError = error;
            if (/bucket not found/i.test(error.message || '')) {
              continue;
            }
            throw error;
          }
          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          const publicUrl =
            data?.publicUrl ||
            (supabaseUrl
              ? `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(
                  bucket
                )}/${path}`
              : '');
          if (publicUrl) {
            uploadedUrls.push(publicUrl);
          }
          uploaded = true;
          break;
        }
        if (!uploaded) {
          throw lastError || new Error('Bucket not found');
        }
      }
      return uploadedUrls;
    },
    [actorEmail]
  );
  const handleImageUpload = useCallback(
    async (event: any) => {
      const files = Array.from(event?.target?.files || []) as File[];
      if (!files.length) return;
      try {
        setUploadingImages(true);
        setMediaMessage('');
        const urls = await uploadNewsImages(files);
        if (urls.length) {
          setForm((prev) => ({
            ...prev,
            imageUrls: joinList([...splitList(prev.imageUrls), ...urls]),
          }));
          setMediaMessage(t('saved'));
        }
      } catch (error: any) {
        setMediaMessage(
          error?.message || t('newsAdminImageUploadError')
        );
      } finally {
        if (event?.currentTarget) {
          event.currentTarget.value = '';
        }
        setUploadingImages(false);
      }
    },
    [t, uploadNewsImages]
  );

  const submit = useCallback(async () => {
    if (!token || !isModerator(actorRole)) return;
    if (!form.title.trim()) {
      setMessage('Title is required');
      return;
    }

    setSaving(true);
    setMessage('');
    const payload = {
      title: form.title.trim(),
      titleEn: form.titleEn.trim(),
      titleKk: form.titleKk.trim(),
      summary: form.summary.trim(),
      summaryEn: form.summaryEn.trim(),
      summaryKk: form.summaryKk.trim(),
      category: mapCategoryToOptionValue(form.category) || 'announcements',
      tags: splitList(form.tags),
      imageUrls: splitList(form.imageUrls),
      videoUrls: splitList(form.videoUrls),
      content: form.content.trim(),
      contentEn: form.contentEn.trim(),
      contentKk: form.contentKk.trim(),
      publishedAt: form.publishedAt.trim(),
    };

    try {
      if (editId) {
        const result = await updateNewsItem(token, editId, payload);
        const updated = result?.data;
        setNews((prev) => prev.map((item) => (item.id === editId ? updated : item)));
      } else {
        const result = await createNewsItem(token, payload);
        const created = result?.data;
        setNews((prev) => [created, ...prev]);
      }
      resetForm();
      setMessage(t('saved'));
    } catch (error) {
      setMessage((error as Error)?.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [actorRole, editId, form, resetForm, t, token]);

  const remove = useCallback(
    async (id: string) => {
      if (!token || !isModerator(actorRole) || !id) return;
      setMessage('');
      try {
        await deleteNewsItem(token, id);
        setNews((prev) => prev.filter((item) => item.id !== id));
      } catch (error) {
        setMessage((error as Error)?.message || t('saveError'));
      }
    },
    [actorRole, t, token]
  );

  const sorted = useMemo(
    () =>
      [...news].sort(
        (a, b) =>
          new Date(b?.publishedAt || 0).getTime() -
          new Date(a?.publishedAt || 0).getTime()
      ),
    [news]
  );

  if (!authReady) {
    return <div className="card">{t('checkingSession')}</div>;
  }

  if (!isModerator(actorRole)) {
    return <div className="card">{t('newsAdminForbidden')}</div>;
  }

  return (
    <div className="card">
      <div className="locale-toggle" style={{ marginBottom: 8 }}>
        {(['ru', 'en', 'kk'] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            className={`locale-chip${locale === lang ? ' active' : ''}`}
            onClick={() => setLocale(lang)}
          >
            {lang === 'kk' ? 'KZ' : lang.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="requests-head">
        <h2>{t('newsAdminTitle')}</h2>
        <button type="button" className="button secondary" onClick={reload}>
          {t('newsAdminRefresh')}
        </button>
      </div>
      <p className="muted">{t('newsAdminHint')}</p>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="upload-choice-note" style={{ marginTop: 0 }}>
          <span className="or-badge">{localeBadge}</span>
          {t('newsAdminSingleLocaleHint')}
        </div>
        <Field label={localizedFieldLabels.title} value={getLocalizedField('title')} onChange={(value) => setLocalizedField('title', value)} />
        <Field label={localizedFieldLabels.summary} value={getLocalizedField('summary')} onChange={(value) => setLocalizedField('summary', value)} textarea />
        <label className="field" style={{ marginBottom: 10 }}>
          <span>{localizedFieldLabels.category}</span>
          <select
            value={mapCategoryToOptionValue(form.category)}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, category: event.target.value }))
            }
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.labels[localeKey]}
              </option>
            ))}
          </select>
        </label>
        <Field label={localizedFieldLabels.tags} value={form.tags} onChange={(value) => setForm((p) => ({ ...p, tags: value }))} />
        <Field label={localizedFieldLabels.imageUrls} value={form.imageUrls} onChange={(value) => setForm((p) => ({ ...p, imageUrls: value }))} textarea />
        <label className="field" style={{ marginBottom: 10 }}>
          <span>{t('newsAdminImageUploadLabel')}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            disabled={uploadingImages || saving}
          />
        </label>
        <p className="upload-choice-note">
          <span className="or-badge">ИЛИ</span>
          {t('newsAdminImageUploadHint')}
          {uploadingImages ? ` ${t('newsAdminImageUploading')}` : ''}
        </p>
        {mediaMessage ? <p className="muted">{mediaMessage}</p> : null}
        <Field label={localizedFieldLabels.videoUrls} value={form.videoUrls} onChange={(value) => setForm((p) => ({ ...p, videoUrls: value }))} textarea />
        <Field label={localizedFieldLabels.content} value={getLocalizedField('content')} onChange={(value) => setLocalizedField('content', value)} textarea rows={6} />
        <Field
          label={localizedFieldLabels.publishedAt}
          value={form.publishedAt}
          onChange={(value) => setForm((p) => ({ ...p, publishedAt: value }))}
        />

        <div className="actions">
          <button type="button" className="primary" onClick={submit} disabled={saving}>
            {saving ? t('saving') : editId ? t('newsAdminUpdate') : t('newsAdminPublish')}
          </button>
          {editId ? (
            <button type="button" className="button secondary" onClick={resetForm}>
              {t('newsAdminCancel')}
            </button>
          ) : null}
          {message ? <span className="status">{message}</span> : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        {loading ? (
          <p className="muted">{t('usersLoading')}</p>
        ) : sorted.length ? (
          <div className="schools-admin-list">
            {sorted.map((item) => (
              <div key={item.id} className="schools-admin-card">
                <p className="request-title">{item.title || item.id}</p>
                <p className="muted">{item.summary || '—'}</p>
                <p className="muted">{item.publishedAt ? new Date(item.publishedAt).toLocaleString() : '—'}</p>
                <div className="schools-admin-actions">
                  <button type="button" className="button secondary" onClick={() => startEdit(item)}>
                    {t('newsAdminEdit')}
                  </button>
                  <button type="button" className="button secondary" onClick={() => remove(item.id)}>
                    {t('newsAdminDelete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">{t('newsAdminEmpty')}</p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <label className="field" style={{ marginBottom: 10 }}>
      <span>{label}</span>
      {textarea ? (
        <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}
