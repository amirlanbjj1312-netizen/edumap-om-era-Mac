'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createNewsItem,
  deleteNewsItem,
  loadNewsFeed,
  updateNewsItem,
} from '@/lib/api';
import { useAdminLocale } from '@/lib/adminLocale';
import { supabase } from '@/lib/supabaseClient';
import { useImageCropper } from '@/lib/useImageCropper';

const isModerator = (role: string) => role === 'moderator' || role === 'superadmin';

const splitList = (value: string) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const joinList = (value: string[] = []) => value.filter(Boolean).join(', ');
const mergeMediaUrls = (prevValue: string, nextUrls: string[], maxItems = 20) => {
  const merged = [...splitList(prevValue), ...nextUrls]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const unique = Array.from(new Set(merged));
  return joinList(unique.slice(0, maxItems));
};
const normalizeTag = (value: string) =>
  String(value || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .toLowerCase();
const toDateTimeLocalValue = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = parsed.getFullYear();
  const month = pad(parsed.getMonth() + 1);
  const day = pad(parsed.getDate());
  const hours = pad(parsed.getHours());
  const minutes = pad(parsed.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};
const isImportantNews = (item: any) => {
  const raw = item?.isImportant ?? item?.is_important ?? false;
  if (typeof raw === 'boolean') return raw;
  const normalized = String(raw || '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};
const getViewsCount = (item: any) => {
  const raw =
    item?.views_count ??
    item?.views ??
    item?.popularity_score ??
    item?.popularityScore ??
    0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
};
const isPublishedNews = (item: any) => {
  const status = String(item?.status || '')
    .trim()
    .toLowerCase();
  if (status === 'draft') return false;
  if (status === 'published') return true;
  const raw = item?.isPublished ?? item?.is_published;
  if (typeof raw === 'boolean') return raw;
  const normalized = String(raw || '')
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

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
  isImportant: false,
  viewsCount: '0',
};
const CATEGORY_OPTIONS = [
  { value: 'announcements', labels: { ru: 'Объявления', en: 'Announcements', kk: 'Хабарландырулар' } },
  { value: 'tips', labels: { ru: 'Полезные советы', en: 'Useful tips', kk: 'Пайдалы кеңестер' } },
  { value: 'events', labels: { ru: 'События', en: 'Events', kk: 'Оқиғалар' } },
  { value: 'competitions', labels: { ru: 'Конкурсы', en: 'Competitions', kk: 'Байқаулар' } },
];
const FONT_OPTIONS = ['Times New Roman', 'Arial', 'Georgia', 'Verdana', 'Tahoma'];
const FONT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24, 28, 32];
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
  const [uploadingVideos, setUploadingVideos] = useState(false);
  const [mediaMessage, setMediaMessage] = useState('');
  const [uploadInputsKey, setUploadInputsKey] = useState(0);
  const [message, setMessage] = useState('');
  const [news, setNews] = useState<any[]>([]);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [listMode, setListMode] = useState<'all' | 'important' | 'latest' | 'popular'>('all');
  const [tagInput, setTagInput] = useState('');
  const [activeFontFamily, setActiveFontFamily] = useState(FONT_OPTIONS[0]);
  const [activeFontSize, setActiveFontSize] = useState('16');
  const [activeTextColor, setActiveTextColor] = useState('#1f2a44');
  const { openImageCropper, cropperModal } = useImageCropper();
  const contentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);
  const inlineVideoInputRef = useRef<HTMLInputElement | null>(null);
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
            tags: 'Hashtags',
            imageUrls: 'Image URLs (comma separated)',
            videoUrls: 'Video URLs (comma separated)',
            publishedAt: 'Publish date and time (optional)',
            isImportant: 'Important news',
            viewsCount: 'Popularity (views)',
          }
        : locale === 'kk'
        ? {
            title: 'Атауы',
            summary: 'Қысқаша сипаттама',
            content: 'Мәтін',
            category: 'Санат',
            tags: 'Хэштегтер',
            imageUrls: 'Сурет URL-дары (үтір арқылы)',
            videoUrls: 'Видео URL-дары (үтір арқылы)',
            publishedAt: 'Жариялау күні мен уақыты (міндетті емес)',
            isImportant: 'Маңызды жаңалық',
            viewsCount: 'Танымалдық (қаралым саны)',
          }
        : {
            title: 'Название',
            summary: 'Краткое описание',
            content: 'Текст',
            category: 'Категория',
            tags: 'Хештеги',
            imageUrls: 'URL изображений (через запятую)',
            videoUrls: 'URL видео (через запятую)',
            publishedAt: 'Дата и время публикации (необязательно)',
            isImportant: 'Важная новость',
            viewsCount: 'Популярность (просмотры)',
          },
    [locale]
  );
  const localizedTagPlaceholder = useMemo(
    () =>
      locale === 'en'
        ? 'type hashtag and press Enter'
        : locale === 'kk'
        ? 'хэштег жазыңыз және Enter басыңыз'
        : 'введите хештег и нажмите Enter',
    [locale]
  );
  const localizedTagExample = useMemo(
    () =>
      locale === 'en'
        ? '#example: #admission #school-life #olympiad'
        : locale === 'kk'
        ? '#мысал: #қабылдау #мектеп-өмірі #олимпиада'
        : '#пример: #поступление #школьнаяжизнь #олимпиада',
    [locale]
  );
  const localizedVideoUpload = useMemo(
    () =>
      locale === 'en'
        ? {
            label: 'Upload video files',
            hint: 'or upload video files and links will be added automatically',
            uploading: 'Uploading videos...',
            error: 'Failed to upload videos',
          }
        : locale === 'kk'
        ? {
            label: 'Видео файлдарды жүктеу',
            hint: 'немесе видео файлдарды жүктеп, сілтемелерді автоматты түрде қосу',
            uploading: 'Видеолар жүктелуде...',
            error: 'Видеоларды жүктеу мүмкін болмады',
          }
        : {
            label: 'Загрузить видеофайлы',
            hint: 'или загрузите видеофайлы, ссылки добавятся автоматически',
            uploading: 'Загружаем видео...',
            error: 'Не удалось загрузить видео',
          },
    [locale]
  );
  const contentToolbarLabels = useMemo(
    () =>
      locale === 'en'
        ? {
            bold: 'B',
            italic: 'I',
            underline: 'U',
            h1: 'H1',
            h2: 'H2',
            bullets: '• List',
            numbers: '1. List',
            link: 'Link',
            image: 'Image',
            video: 'Video',
            color: 'Color',
            left: 'Left',
            center: 'Center',
            right: 'Right',
            justify: 'Justify',
            placeholder: 'Text',
          }
        : locale === 'kk'
        ? {
            bold: 'B',
            italic: 'I',
            underline: 'U',
            h1: 'H1',
            h2: 'H2',
            bullets: '• Тізім',
            numbers: '1. Тізім',
            link: 'Сілтеме',
            image: 'Сурет',
            video: 'Видео',
            color: 'Түс',
            left: 'Сол',
            center: 'Орта',
            right: 'Оң',
            justify: 'Енімен',
            placeholder: 'Мәтін',
          }
        : {
            bold: 'B',
            italic: 'I',
            underline: 'U',
            h1: 'H1',
            h2: 'H2',
            bullets: '• Список',
            numbers: '1. Список',
            link: 'Ссылка',
            image: 'Фото',
            video: 'Видео',
            color: 'Цвет',
            left: 'Лево',
            center: 'Центр',
            right: 'Право',
            justify: 'Ширина',
            placeholder: 'Текст',
          },
    [locale]
  );
  const tagsList = useMemo(() => splitList(form.tags), [form.tags]);
  const imageCount = useMemo(() => splitList(form.imageUrls).length, [form.imageUrls]);
  const videoCount = useMemo(() => splitList(form.videoUrls).length, [form.videoUrls]);
  const prepareImageFiles = useCallback(
    async (files: File[]) => {
      const prepared: File[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          prepared.push(file);
          continue;
        }
        const cropped = await openImageCropper(file, {
          title: locale === 'en' ? 'Crop image' : locale === 'kk' ? 'Суретті қию' : 'Обрезать фото',
          aspect: 16 / 9,
        });
        if (!cropped) {
          // Если обрезку отменили для одного файла — не блокируем остальные.
          continue;
        }
        prepared.push(cropped);
      }
      return prepared;
    },
    [locale, openImageCropper]
  );
  const publishedAtInputValue = useMemo(
    () => toDateTimeLocalValue(form.publishedAt),
    [form.publishedAt]
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
    setTagInput('');
    setMediaMessage('');
    setUploadInputsKey((prev) => prev + 1);
  }, []);

  const startEdit = useCallback((item: any) => {
    setEditId(item?.id || '');
    setMediaMessage('');
    setUploadInputsKey((prev) => prev + 1);
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
      isImportant: isImportantNews(item),
      viewsCount: String(getViewsCount(item)),
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
        const preparedFiles = await prepareImageFiles(files);
        if (!preparedFiles?.length) {
          setMediaMessage(
            locale === 'en'
              ? 'No images were added'
              : locale === 'kk'
              ? 'Суреттер қосылмады'
              : 'Фото не были добавлены'
          );
          return;
        }
        const urls = await uploadNewsImages(preparedFiles);
        if (urls.length) {
          setForm((prev) => ({
            ...prev,
            imageUrls: mergeMediaUrls(prev.imageUrls, urls, 20),
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
    [locale, prepareImageFiles, t, uploadNewsImages]
  );
  const uploadNewsVideos = useCallback(
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
        const path = `news/${baseId}/videos/${Date.now()}-${baseName}.${ext}`;

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
  const handleVideoUpload = useCallback(
    async (event: any) => {
      const files = Array.from(event?.target?.files || []) as File[];
      if (!files.length) return;
      try {
        setUploadingVideos(true);
        setMediaMessage('');
        const urls = await uploadNewsVideos(files);
        if (urls.length) {
          setForm((prev) => ({
            ...prev,
            videoUrls: mergeMediaUrls(prev.videoUrls, urls, 20),
          }));
          setMediaMessage(t('saved'));
        }
      } catch (error: any) {
        setMediaMessage(error?.message || localizedVideoUpload.error);
      } finally {
        if (event?.currentTarget) {
          event.currentTarget.value = '';
        }
        setUploadingVideos(false);
      }
    },
    [localizedVideoUpload.error, t, uploadNewsVideos]
  );

  const submit = useCallback(async (publish: boolean) => {
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
      publishedAt: form.publishedAt.trim() || (publish ? new Date().toISOString() : ''),
      isImportant: Boolean(form.isImportant),
      views_count: getViewsCount({ views_count: form.viewsCount }),
      popularity_score: getViewsCount({ popularity_score: form.viewsCount }),
      isPublished: publish,
      status: publish ? 'published' : 'draft',
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

  const addTag = useCallback((rawValue: string) => {
    const normalized = normalizeTag(rawValue);
    if (!normalized) return;
    setForm((prev) => {
      const existing = splitList(prev.tags).map(normalizeTag).filter(Boolean);
      if (existing.includes(normalized)) return prev;
      return { ...prev, tags: joinList([...existing, normalized]) };
    });
  }, []);

  const removeTag = useCallback((tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    setForm((prev) => {
      const next = splitList(prev.tags)
        .map(normalizeTag)
        .filter((item) => item && item !== normalized);
      return { ...prev, tags: joinList(next) };
    });
  }, []);
  const applyContentFormat = useCallback(
    (before: string, after: string, fallbackText?: string) => {
      const node = contentInputRef.current;
      const currentValue = getLocalizedField('content');
      const defaultText = fallbackText || contentToolbarLabels.placeholder;
      if (!node) {
        setLocalizedField('content', `${currentValue}${before}${defaultText}${after}`);
        return;
      }
      const start = node.selectionStart ?? currentValue.length;
      const end = node.selectionEnd ?? currentValue.length;
      const selectedText = currentValue.slice(start, end);
      const insertText = `${before}${selectedText || defaultText}${after}`;
      const nextValue =
        currentValue.slice(0, start) + insertText + currentValue.slice(end);
      setLocalizedField('content', nextValue);
      requestAnimationFrame(() => {
        node.focus();
        const cursor = start + insertText.length;
        node.setSelectionRange(cursor, cursor);
      });
    },
    [contentToolbarLabels.placeholder, getLocalizedField, setLocalizedField]
  );
  const applyFontFamily = useCallback(
    (font: string) => {
      setActiveFontFamily(font);
      const safeFont = font.replace(/["<>]/g, '');
      applyContentFormat(`<span style="font-family:${safeFont};">`, '</span>');
    },
    [applyContentFormat]
  );
  const applyFontSize = useCallback(
    (size: string) => {
      setActiveFontSize(size);
      const numeric = Number(size);
      const finalSize = Number.isFinite(numeric) ? numeric : 16;
      applyContentFormat(`<span style="font-size:${finalSize}px;">`, '</span>');
    },
    [applyContentFormat]
  );
  const applyTextColor = useCallback(
    (color: string) => {
      setActiveTextColor(color);
      applyContentFormat(`<span style="color:${color};">`, '</span>');
    },
    [applyContentFormat]
  );
  const insertIntoContent = useCallback(
    (snippet: string) => {
      const node = contentInputRef.current;
      const currentValue = getLocalizedField('content');
      if (!node) {
        setLocalizedField('content', `${currentValue}${snippet}`);
        return;
      }
      const start = node.selectionStart ?? currentValue.length;
      const end = node.selectionEnd ?? currentValue.length;
      const nextValue = currentValue.slice(0, start) + snippet + currentValue.slice(end);
      setLocalizedField('content', nextValue);
      requestAnimationFrame(() => {
        node.focus();
        const cursor = start + snippet.length;
        node.setSelectionRange(cursor, cursor);
      });
    },
    [getLocalizedField, setLocalizedField]
  );
  const insertInlineMedia = useCallback(
    (urls: string[], kind: 'image' | 'video') => {
      if (!urls.length) return;
      const blocks = urls
        .map((url) => {
          const safeUrl = String(url || '').replace(/"/g, '%22').trim();
          if (!safeUrl) return '';
          if (kind === 'image') {
            return `<img src="${safeUrl}" alt="news-image" style="max-width:100%;border-radius:12px;" />`;
          }
          return `<video controls src="${safeUrl}" style="max-width:100%;border-radius:12px;"></video>`;
        })
        .filter(Boolean)
        .join('\n');
      if (!blocks) return;
      insertIntoContent(`\n${blocks}\n`);
    },
    [insertIntoContent]
  );
  const handleInlineImageUpload = useCallback(
    async (event: any) => {
      const files = Array.from(event?.target?.files || []) as File[];
      if (!files.length) return;
      try {
        setUploadingImages(true);
        setMediaMessage('');
        const preparedFiles = await prepareImageFiles(files);
        if (!preparedFiles?.length) return;
        const urls = await uploadNewsImages(preparedFiles);
        insertInlineMedia(urls, 'image');
        setMediaMessage(t('saved'));
      } catch (error: any) {
        setMediaMessage(error?.message || t('newsAdminImageUploadError'));
      } finally {
        if (event?.currentTarget) {
          event.currentTarget.value = '';
        }
        setUploadingImages(false);
      }
    },
    [insertInlineMedia, prepareImageFiles, t, uploadNewsImages]
  );
  const handleInlineVideoUpload = useCallback(
    async (event: any) => {
      const files = Array.from(event?.target?.files || []) as File[];
      if (!files.length) return;
      try {
        setUploadingVideos(true);
        setMediaMessage('');
        const urls = await uploadNewsVideos(files);
        insertInlineMedia(urls, 'video');
        setMediaMessage(t('saved'));
      } catch (error: any) {
        setMediaMessage(error?.message || localizedVideoUpload.error);
      } finally {
        if (event?.currentTarget) {
          event.currentTarget.value = '';
        }
        setUploadingVideos(false);
      }
    },
    [insertInlineMedia, localizedVideoUpload.error, t, uploadNewsVideos]
  );

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
  const filteredNews = useMemo(() => {
    if (listMode === 'important') {
      return sorted.filter((item) => isImportantNews(item));
    }
    if (listMode === 'latest') {
      return sorted;
    }
    if (listMode === 'popular') {
      return [...sorted].sort((a, b) => getViewsCount(b) - getViewsCount(a));
    }
    return sorted;
  }, [listMode, sorted]);

  if (!authReady) {
    return <div className="card">{t('checkingSession')}</div>;
  }

  if (!isModerator(actorRole)) {
    return <div className="card">{t('newsAdminForbidden')}</div>;
  }

  return (
    <div className="card">
      <div className="locale-toggle" style={{ marginBottom: 8 }}>
        {(['ru', 'kk', 'en'] as const).map((lang) => (
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
        <label className="field" style={{ marginBottom: 10 }}>
          <span>{localizedFieldLabels.tags}</span>
          {tagsList.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {tagsList.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="option-chip"
                  onClick={() => removeTag(tag)}
                  title={locale === 'en' ? 'Remove tag' : locale === 'kk' ? 'Тегті өшіру' : 'Удалить тег'}
                >
                  #{normalizeTag(tag)} ×
                </button>
              ))}
            </div>
          ) : null}
          <input
            value={tagInput}
            placeholder={localizedTagPlaceholder}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
                event.preventDefault();
                addTag(tagInput);
                setTagInput('');
                return;
              }
              if (event.key === 'Backspace' && !tagInput.trim() && tagsList.length) {
                removeTag(tagsList[tagsList.length - 1]);
              }
            }}
            onBlur={() => {
              if (!tagInput.trim()) return;
              addTag(tagInput);
              setTagInput('');
            }}
          />
          <p className="upload-choice-note" style={{ marginTop: 6 }}>{localizedTagExample}</p>
        </label>
        <Field label={localizedFieldLabels.imageUrls} value={form.imageUrls} onChange={(value) => setForm((p) => ({ ...p, imageUrls: value }))} textarea />
        <p className="muted" style={{ marginTop: -6, marginBottom: 8 }}>
          {locale === 'en'
            ? `Added images: ${imageCount}`
            : locale === 'kk'
            ? `Қосылған суреттер: ${imageCount}`
            : `Добавлено фото: ${imageCount}`}
        </p>
        <label className="field" style={{ marginBottom: 10 }}>
          <span>{t('newsAdminImageUploadLabel')}</span>
          <input
            key={`news-image-upload-${uploadInputsKey}`}
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
        <p className="muted" style={{ marginTop: -6, marginBottom: 8 }}>
          {locale === 'en'
            ? `Added videos: ${videoCount}`
            : locale === 'kk'
            ? `Қосылған видеолар: ${videoCount}`
            : `Добавлено видео: ${videoCount}`}
        </p>
        <label className="field" style={{ marginBottom: 10 }}>
          <span>{localizedVideoUpload.label}</span>
          <input
            key={`news-video-upload-${uploadInputsKey}`}
            type="file"
            accept="video/*"
            multiple
            onChange={handleVideoUpload}
            disabled={uploadingVideos || saving}
          />
        </label>
        <p className="upload-choice-note">
          <span className="or-badge">ИЛИ</span>
          {localizedVideoUpload.hint}
          {uploadingVideos ? ` ${localizedVideoUpload.uploading}` : ''}
        </p>
        <label className="field" style={{ marginBottom: 10 }}>
          <span>{localizedFieldLabels.content}</span>
          <div className="news-editor-toolbar">
            <div className="news-editor-group">
              <select
                className="news-editor-select"
                value={activeFontFamily}
                onChange={(event) => applyFontFamily(event.target.value)}
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
              <select
                className="news-editor-select news-editor-select-size"
                value={activeFontSize}
                onChange={(event) => applyFontSize(event.target.value)}
              >
                {FONT_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={String(size)}>
                    {size}
                  </option>
                ))}
              </select>
              <button type="button" className="news-editor-button" onClick={() => applyContentFormat('<strong>', '</strong>')}>
                {contentToolbarLabels.bold}
              </button>
              <button type="button" className="news-editor-button news-editor-italic" onClick={() => applyContentFormat('<em>', '</em>')}>
                {contentToolbarLabels.italic}
              </button>
              <button type="button" className="news-editor-button news-editor-underline" onClick={() => applyContentFormat('<u>', '</u>')}>
                {contentToolbarLabels.underline}
              </button>
              <button type="button" className="news-editor-button" onClick={() => applyContentFormat('<h1>', '</h1>')}>
                {contentToolbarLabels.h1}
              </button>
              <button type="button" className="news-editor-button" onClick={() => applyContentFormat('<h2>', '</h2>')}>
                {contentToolbarLabels.h2}
              </button>
            </div>
            <div className="news-editor-divider" />
            <div className="news-editor-group">
              <button
                type="button"
                className="news-editor-button"
                onClick={() =>
                  applyContentFormat('<ul><li>', '</li></ul>', contentToolbarLabels.placeholder)
                }
              >
                {contentToolbarLabels.bullets}
              </button>
              <button
                type="button"
                className="news-editor-button"
                onClick={() =>
                  applyContentFormat('<ol><li>', '</li></ol>', contentToolbarLabels.placeholder)
                }
              >
                {contentToolbarLabels.numbers}
              </button>
              <button
                type="button"
                className="news-editor-button"
                onClick={() => applyContentFormat('<a href="https://" target="_blank">', '</a>', 'https://')}
              >
                {contentToolbarLabels.link}
              </button>
              <button
                type="button"
                className="news-editor-button"
                onClick={() => inlineImageInputRef.current?.click()}
              >
                {contentToolbarLabels.image}
              </button>
              <button
                type="button"
                className="news-editor-button"
                onClick={() => inlineVideoInputRef.current?.click()}
              >
                {contentToolbarLabels.video}
              </button>
              <label className="news-editor-color">
                <span>{contentToolbarLabels.color}</span>
                <input
                  type="color"
                  value={activeTextColor}
                  onChange={(event) => applyTextColor(event.target.value)}
                />
              </label>
            </div>
            <div className="news-editor-divider" />
            <div className="news-editor-group">
              <button type="button" className="news-editor-button" onClick={() => applyContentFormat('<div style="text-align:left;">', '</div>')}>
                {contentToolbarLabels.left}
              </button>
              <button type="button" className="news-editor-button" onClick={() => applyContentFormat('<div style="text-align:center;">', '</div>')}>
                {contentToolbarLabels.center}
              </button>
              <button type="button" className="news-editor-button" onClick={() => applyContentFormat('<div style="text-align:right;">', '</div>')}>
                {contentToolbarLabels.right}
              </button>
              <button type="button" className="news-editor-button" onClick={() => applyContentFormat('<div style="text-align:justify;">', '</div>')}>
                {contentToolbarLabels.justify}
              </button>
            </div>
          </div>
          <textarea
            ref={contentInputRef}
            className="news-editor-textarea"
            value={getLocalizedField('content')}
            rows={6}
            onChange={(event) => setLocalizedField('content', event.target.value)}
          />
          <input
            ref={inlineImageInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleInlineImageUpload}
            disabled={uploadingImages || saving}
          />
          <input
            ref={inlineVideoInputRef}
            type="file"
            accept="video/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleInlineVideoUpload}
            disabled={uploadingVideos || saving}
          />
        </label>
        <Field
          label={localizedFieldLabels.publishedAt}
          value={publishedAtInputValue}
          onChange={(value) =>
            setForm((p) => ({
              ...p,
              publishedAt: value ? new Date(value).toISOString() : '',
            }))
          }
          type="datetime-local"
        />
        <label className="field" style={{ marginBottom: 10 }}>
          <span>{localizedFieldLabels.isImportant}</span>
          <label className="checkbox-inline" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={Boolean(form.isImportant)}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isImportant: event.target.checked }))
              }
            />
            <span>
              {locale === 'en'
                ? 'Show in important block'
                : locale === 'kk'
                ? 'Маңызды блокта көрсету'
                : 'Показывать в блоке важных новостей'}
            </span>
          </label>
        </label>
        <Field
          label={localizedFieldLabels.viewsCount}
          value={String(form.viewsCount)}
          onChange={(value) => setForm((prev) => ({ ...prev, viewsCount: value }))}
          type="number"
        />

        <div className="actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => submit(false)}
            disabled={saving}
          >
            {saving
              ? t('saving')
              : locale === 'en'
              ? editId
                ? 'Update draft'
                : 'Save draft'
              : locale === 'kk'
              ? editId
                ? 'Қараламаны жаңарту'
                : 'Қаралама ретінде сақтау'
              : editId
              ? 'Обновить черновик'
              : 'Сохранить как черновик'}
          </button>
          <button type="button" className="primary" onClick={() => submit(true)} disabled={saving}>
            {saving
              ? t('saving')
              : editId
              ? locale === 'en'
                ? 'Update and publish'
                : locale === 'kk'
                ? 'Жаңартып жариялау'
                : 'Обновить и опубликовать'
              : t('newsAdminPublish')}
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
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
          }}
        >
          {[
            {
              key: 'all' as const,
              label: locale === 'en' ? 'All' : locale === 'kk' ? 'Барлығы' : 'Все',
            },
            {
              key: 'important' as const,
              label: locale === 'en' ? 'Important' : locale === 'kk' ? 'Маңызды' : 'Важные',
            },
            {
              key: 'latest' as const,
              label: locale === 'en' ? 'Latest' : locale === 'kk' ? 'Соңғылары' : 'Последние',
            },
            {
              key: 'popular' as const,
              label: locale === 'en' ? 'Popular' : locale === 'kk' ? 'Танымал' : 'Популярные',
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="option-chip"
              onClick={() => setListMode(tab.key)}
              style={
                listMode === tab.key
                  ? { background: 'rgba(80, 105, 245, 0.18)', borderColor: '#5069f5' }
                  : undefined
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="muted">{t('usersLoading')}</p>
        ) : filteredNews.length ? (
          <div className="schools-admin-list">
            {filteredNews.map((item) => (
              <div key={item.id} className="schools-admin-card">
                <p className="request-title">{item.title || item.id}</p>
                <p className="muted">{item.summary || '—'}</p>
                <p className="muted">
                  {(isPublishedNews(item)
                    ? locale === 'en'
                      ? 'Published'
                      : locale === 'kk'
                      ? 'Жарияланған'
                      : 'Опубликовано'
                    : locale === 'en'
                    ? 'Draft'
                    : locale === 'kk'
                    ? 'Қаралама'
                    : 'Черновик') +
                    ' • ' +
                    (isImportantNews(item)
                    ? locale === 'en'
                      ? 'Important'
                      : locale === 'kk'
                      ? 'Маңызды'
                      : 'Важная'
                    : locale === 'en'
                    ? 'Regular'
                    : locale === 'kk'
                    ? 'Қалыпты'
                    : 'Обычная') +
                    ` • ${localizedFieldLabels.viewsCount}: ${getViewsCount(item)}`}
                </p>
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
      {cropperModal}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
  rows = 3,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  rows?: number;
  type?: string;
}) {
  return (
    <label className="field" style={{ marginBottom: 10 }}>
      <span>{label}</span>
      {textarea ? (
        <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}
