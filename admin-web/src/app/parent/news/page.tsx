'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadNewsFeed } from '@/lib/api';
import { isGuestMode } from '@/lib/guestMode';
import { useParentLocale } from '@/lib/parentLocale';

type NewsItem = {
  id: string;
  title?: unknown;
  titleEn?: unknown;
  titleKk?: unknown;
  title_ru?: unknown;
  title_en?: unknown;
  title_kk?: unknown;
  summary?: unknown;
  summaryEn?: unknown;
  summaryKk?: unknown;
  summary_ru?: unknown;
  summary_en?: unknown;
  summary_kk?: unknown;
  content?: unknown;
  contentEn?: unknown;
  contentKk?: unknown;
  content_ru?: unknown;
  content_en?: unknown;
  content_kk?: unknown;
  category?: unknown;
  published_at?: string;
  publishedAt?: string;
  status?: unknown;
  tags?: unknown;
  hashtags?: unknown;
  tag_list?: unknown;
  isPublished?: unknown;
  is_published?: unknown;
  isImportant?: unknown;
  is_important?: unknown;
  views?: unknown;
  views_count?: unknown;
  popularity_score?: unknown;
  popularityScore?: unknown;
  imageUrls?: unknown;
  image_urls?: unknown;
  images?: unknown;
  updatedAt?: string;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const picked = localized.ru ?? localized.kk ?? localized.en;
    if (typeof picked === 'string') return picked;
    if (typeof picked === 'number') return String(picked);
  }
  return '';
};
const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => toText(entry).trim())
      .filter(Boolean);
  }
  const text = toText(value).trim();
  if (!text) return [];
  return text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};
const pickImageUrl = (item: NewsItem): string => {
  const list = [
    ...toList(item.imageUrls),
    ...toList(item.image_urls),
    ...toList(item.images),
  ];
  return list[0] || '';
};
const pickSummary = (item: NewsItem, locale: 'ru' | 'en' | 'kk') => {
  if (locale === 'en') {
    return (
      toText(item.summary_en) ||
      toText(item.summaryEn) ||
      toText(item.summary_ru) ||
      toText(item.summary_kk) ||
      toText(item.summaryKk) ||
      toText(item.summary) ||
      ''
    );
  }
  if (locale === 'kk') {
    return (
      toText(item.summary_kk) ||
      toText(item.summaryKk) ||
      toText(item.summary_ru) ||
      toText(item.summary_en) ||
      toText(item.summaryEn) ||
      toText(item.summary) ||
      ''
    );
  }
  return (
    toText(item.summary_ru) ||
    toText(item.summary) ||
    toText(item.summary_en) ||
    toText(item.summaryEn) ||
    toText(item.summary_kk) ||
    toText(item.summaryKk) ||
    ''
  );
};
const pickContent = (item: NewsItem, locale: 'ru' | 'en' | 'kk') => {
  if (locale === 'en') {
    return (
      toText(item.content_en) ||
      toText(item.contentEn) ||
      toText(item.content_ru) ||
      toText(item.content_kk) ||
      toText(item.contentKk) ||
      toText(item.content) ||
      ''
    );
  }
  if (locale === 'kk') {
    return (
      toText(item.content_kk) ||
      toText(item.contentKk) ||
      toText(item.content_ru) ||
      toText(item.content_en) ||
      toText(item.contentEn) ||
      toText(item.content) ||
      ''
    );
  }
  return (
    toText(item.content_ru) ||
    toText(item.content) ||
    toText(item.content_en) ||
    toText(item.contentEn) ||
    toText(item.content_kk) ||
    toText(item.contentKk) ||
    ''
  );
};
const pickTags = (item: NewsItem): string[] =>
  toList(item.tags || item.hashtags || item.tag_list).map((tag) =>
    String(tag || '').replace(/^#+/, '').trim()
  );

const pickLocalized = (item: NewsItem, locale: 'ru' | 'en' | 'kk') => {
  if (locale === 'en') {
    return (
      toText(item.title_en) ||
      toText(item.titleEn) ||
      toText(item.title_ru) ||
      toText(item.title_kk) ||
      toText(item.titleKk) ||
      toText(item.title) ||
      'News'
    );
  }
  if (locale === 'kk') {
    return (
      toText(item.title_kk) ||
      toText(item.titleKk) ||
      toText(item.title_ru) ||
      toText(item.title_en) ||
      toText(item.titleEn) ||
      toText(item.title) ||
      'Жаңалық'
    );
  }
  return (
    toText(item.title_ru) ||
    toText(item.title) ||
    toText(item.title_en) ||
    toText(item.titleEn) ||
    toText(item.title_kk) ||
    toText(item.titleKk) ||
    'Новость'
  );
};

const toCategory = (item: NewsItem) => String(item.category || '').trim().toLowerCase();
const toTimestamp = (item: NewsItem) => {
  const raw = String(item.published_at || item.publishedAt || item.updatedAt || '').trim();
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
};
const toViews = (item: NewsItem) => {
  const raw = Number(
    item.views_count ?? item.views ?? item.popularity_score ?? item.popularityScore ?? 0
  );
  return Number.isFinite(raw) ? raw : 0;
};
const isImportantNews = (item: NewsItem) => {
  const raw = item.isImportant ?? item.is_important ?? false;
  if (typeof raw === 'boolean') return raw;
  const normalized = String(raw || '')
    .trim()
    .toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
};
const isPublishedNews = (item: NewsItem) => {
  const status = String(item.status || '')
    .trim()
    .toLowerCase();
  if (status === 'draft') return false;
  if (status === 'published') return true;
  const raw = item.isPublished ?? item.is_published;
  if (typeof raw === 'boolean') return raw;
  const normalized = String(raw || '')
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  return ['true', '1', 'yes', 'on'].includes(normalized);
};

const CATEGORY_ORDER = ['announcements', 'tips', 'events', 'competitions'] as const;
type NewsCategory = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<NewsCategory, { ru: string; en: string; kk: string }> = {
  announcements: { ru: 'Объявления', en: 'Announcements', kk: 'Хабарландырулар' },
  tips: { ru: 'Полезные советы', en: 'Useful tips', kk: 'Пайдалы кеңестер' },
  events: { ru: 'События', en: 'Events', kk: 'Оқиғалар' },
  competitions: { ru: 'Конкурсы', en: 'Competitions', kk: 'Байқаулар' },
};

export default function ParentNewsPage() {
  const { locale } = useParentLocale();
  const [guest] = useState(() => isGuestMode());
  const [rows, setRows] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('announcements');
  const [feedMode, setFeedMode] = useState<'latest' | 'popular'>('latest');
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  useEffect(() => {
    let mounted = true;
    loadNewsFeed()
      .then((payload) => {
        if (!mounted) return;
        setRows(Array.isArray(payload?.data) ? payload.data : []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const ui =
    locale === 'en'
      ? {
          title: 'News',
          guest: 'Guest mode: news and school catalog are available.',
          loading: 'Loading...',
          empty: 'No news yet.',
          important: 'Important news',
          latest: 'Latest',
          popular: 'Popular',
          noTypeNews: 'No news in this category yet.',
        }
      : locale === 'kk'
        ? {
            title: 'Жаңалықтар',
            guest: 'Қонақ режимі: жаңалықтар мен мектептер каталогы қолжетімді.',
            loading: 'Жүктелуде...',
            empty: 'Әзірге жаңалық жоқ.',
            important: 'Маңызды жаңалықтар',
            latest: 'Соңғылары',
            popular: 'Танымал',
            noTypeNews: 'Бұл санатта жаңалық әлі жоқ.',
          }
        : {
            title: 'Новости',
            guest: 'Гостевой режим: доступны просмотр новостей и каталога школ.',
            loading: 'Загрузка...',
            empty: 'Новостей пока нет.',
            important: 'Важные новости',
            latest: 'Последние',
            popular: 'Популярные',
            noTypeNews: 'В этом типе новостей пока пусто.',
          };

  const visibleRows = useMemo(() => rows.filter((item) => isPublishedNews(item)), [rows]);

  const importantNews = useMemo(() => {
    const flagged = visibleRows
      .filter((item) => isImportantNews(item))
      .sort((a, b) => toTimestamp(b) - toTimestamp(a));
    if (flagged.length) return flagged;
    return visibleRows
      .filter((item) => toCategory(item) === 'announcements')
      .sort((a, b) => toTimestamp(b) - toTimestamp(a));
  }, [visibleRows]);
  const categoryNews = useMemo(
    () =>
      visibleRows
        .filter((item) => toCategory(item) === activeCategory)
        .sort((a, b) => toTimestamp(b) - toTimestamp(a)),
    [visibleRows, activeCategory]
  );
  const popularNews = useMemo(
    () =>
      [...categoryNews].sort((a, b) => {
        const byViews = toViews(b) - toViews(a);
        if (byViews !== 0) return byViews;
        return toTimestamp(b) - toTimestamp(a);
      }),
    [categoryNews]
  );
  const rightNews = feedMode === 'latest' ? categoryNews : popularNews;
  const hero = importantNews[0];

  return (
    <div className="card">
      <h2 className="section-title">{ui.title}</h2>
      {guest ? <p className="muted">{ui.guest}</p> : null}
      <div className="parent-news-tabs">
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            className={`parent-news-tab${activeCategory === category ? ' active' : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {CATEGORY_LABELS[category][locale]}
          </button>
        ))}
      </div>
      {loading ? <p className="muted">{ui.loading}</p> : null}
      {!loading && !visibleRows.length ? <p className="muted">{ui.empty}</p> : null}
      {!loading && visibleRows.length ? (
        <div className="parent-news-layout">
          <section className="parent-news-left">
            <p className="parent-news-side-title">{ui.important}</p>
            {hero ? (
              <article
                className="parent-news-hero-card parent-news-clickable"
                onClick={() => setSelectedNews(hero)}
              >
                <div className="parent-news-hero-media">
                  {pickImageUrl(hero) ? (
                    <img
                      className="parent-news-hero-image"
                      src={pickImageUrl(hero)}
                      alt={pickLocalized(hero, locale)}
                    />
                  ) : (
                    <div className="parent-news-hero-empty">
                      {locale === 'en'
                        ? 'No photo for this news'
                        : locale === 'kk'
                        ? 'Бұл жаңалыққа фото қосылмаған'
                        : 'Для этой новости фото не добавлено'}
                    </div>
                  )}
                  <div className="parent-news-hero-overlay">
                    <h3>{pickLocalized(hero, locale)}</h3>
                    <time>
                      {hero.published_at || hero.publishedAt
                        ? new Date(hero.published_at || hero.publishedAt || '').toLocaleString()
                        : '—'}
                    </time>
                  </div>
                </div>
              </article>
            ) : (
              <p className="muted">{ui.empty}</p>
            )}
          </section>
          <aside className="parent-news-right">
            <div className="parent-news-right-tabs">
              <button
                type="button"
                className={`parent-news-right-tab${feedMode === 'latest' ? ' active' : ''}`}
                onClick={() => setFeedMode('latest')}
              >
                {ui.latest}
              </button>
              <button
                type="button"
                className={`parent-news-right-tab${feedMode === 'popular' ? ' active' : ''}`}
                onClick={() => setFeedMode('popular')}
              >
                {ui.popular}
              </button>
            </div>
            <div className="parent-news-list">
              {rightNews.length ? (
                rightNews.slice(0, 10).map((item) => (
                  <article
                    key={item.id}
                    className="parent-news-list-item parent-news-clickable"
                    onClick={() => setSelectedNews(item)}
                  >
                    <p className="parent-news-list-title">{pickLocalized(item, locale)}</p>
                    <p className="muted">
                      {item.published_at || item.publishedAt
                        ? new Date(item.published_at || item.publishedAt || '').toLocaleString()
                        : '—'}
                    </p>
                  </article>
                ))
              ) : (
                <p className="muted">{ui.noTypeNews}</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
      {selectedNews ? (
        <div className="news-modal-overlay" onClick={() => setSelectedNews(null)}>
          <div className="news-modal-card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="news-modal-close"
              onClick={() => setSelectedNews(null)}
              aria-label="Close"
            >
              ×
            </button>
            <p className="news-modal-date">
              {selectedNews.published_at || selectedNews.publishedAt
                ? new Date(
                    selectedNews.published_at || selectedNews.publishedAt || ''
                  ).toLocaleString()
                : '—'}
            </p>
            <h3 className="news-modal-title">{pickLocalized(selectedNews, locale)}</h3>
            {pickSummary(selectedNews, locale) ? (
              <p className="news-modal-summary">{pickSummary(selectedNews, locale)}</p>
            ) : null}
            {pickImageUrl(selectedNews) ? (
              <img
                className="news-modal-image"
                src={pickImageUrl(selectedNews)}
                alt={pickLocalized(selectedNews, locale)}
              />
            ) : null}
            <div
              className="news-modal-content"
              dangerouslySetInnerHTML={{
                __html:
                  pickContent(selectedNews, locale) ||
                  (locale === 'en'
                    ? 'No full text yet.'
                    : locale === 'kk'
                    ? 'Толық мәтін әлі жоқ.'
                    : 'Полный текст пока не добавлен.'),
              }}
            />
            {pickTags(selectedNews).length ? (
              <div className="news-modal-tags">
                {pickTags(selectedNews).map((tag) => (
                  <span key={tag} className="news-modal-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
