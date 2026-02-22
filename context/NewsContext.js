import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NEWS_SEED } from '../data/newsSeed';
import { createNews, fetchNewsFeed, updateNews } from '../services/newsApi';

const STORAGE_KEY = 'EDUMAP_NEWS_ITEMS_V1';

const NewsContext = createContext({
  newsItems: [],
  addNewsItem: async () => {},
  updateNewsItem: async () => {},
});

const normalizeMedia = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => v?.trim?.()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

export const NewsProvider = ({ children }) => {
  const [newsItems, setNewsItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const remote = await fetchNewsFeed();
        if (remote.length && isMounted) {
          const normalizedRemote = remote.map((item) => ({
            ...item,
            imageUrls: normalizeMedia(item.imageUrls || item.imageUrl),
            videoUrls: normalizeMedia(item.videoUrls || item.videoUrl),
          }));
          setNewsItems(normalizedRemote);
        } else {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw && isMounted) {
            const parsed = JSON.parse(raw);
            const seedById = Object.fromEntries(
              NEWS_SEED.map((seedItem) => [seedItem.id, seedItem])
            );
            const normalized = Array.isArray(parsed)
              ? parsed.map((item) => {
                  const seed = seedById[item.id];
                  const updated = {
                    ...item,
                    imageUrls: normalizeMedia(item.imageUrls || item.imageUrl),
                    videoUrls: normalizeMedia(item.videoUrls || item.videoUrl),
                  };
                  if (!seed) return updated;
                  if (!updated.titleEn && seed.titleEn) {
                    updated.titleEn = seed.titleEn;
                  }
                  if (!updated.summaryEn && seed.summaryEn) {
                    updated.summaryEn = seed.summaryEn;
                  }
                  if (!updated.contentEn && seed.contentEn) {
                    updated.contentEn = seed.contentEn;
                  }
                  if (!updated.titleKk && seed.titleKk) {
                    updated.titleKk = seed.titleKk;
                  }
                  if (!updated.summaryKk && seed.summaryKk) {
                    updated.summaryKk = seed.summaryKk;
                  }
                  if (!updated.contentKk && seed.contentKk) {
                    updated.contentKk = seed.contentKk;
                  }
                  if (seed.titleEn && updated.title === seed.titleEn) {
                    updated.title = seed.title;
                  }
                  if (seed.summaryEn && updated.summary === seed.summaryEn) {
                    updated.summary = seed.summary;
                  }
                  if (seed.contentEn && updated.content === seed.contentEn) {
                    updated.content = seed.content;
                  }
                  return updated;
                })
              : [];
            setNewsItems(normalized);
          } else if (isMounted) {
            setNewsItems(NEWS_SEED);
          }
        }
      } catch (error) {
        console.warn('[NewsProvider] Failed to load news', error);
        if (isMounted) {
          setNewsItems(NEWS_SEED);
        }
      } finally {
        if (isMounted) setHydrated(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newsItems));
      } catch (error) {
        console.warn('[NewsProvider] Failed to persist news', error);
      }
    })();
  }, [newsItems, hydrated]);

  const addNewsItem = async (item) => {
    const now = new Date().toISOString();
    const payload = {
      id: item.id || `news-${Date.now()}`,
      title: item.title?.trim() || 'Untitled',
      titleEn: item.titleEn?.trim?.() || '',
      titleKk: item.titleKk?.trim?.() || '',
      summary: item.summary?.trim() || '',
      summaryEn: item.summaryEn?.trim?.() || '',
      summaryKk: item.summaryKk?.trim?.() || '',
      category: item.category?.trim() || 'Announcements',
      author: item.author?.trim() || 'Admin',
      tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : [],
      publishedAt: item.publishedAt || now,
      imageUrls: normalizeMedia(item.imageUrls || item.imageUrl),
      videoUrls: normalizeMedia(item.videoUrls || item.videoUrl),
      content: item.content?.trim?.() || '',
      contentEn: item.contentEn?.trim?.() || '',
      contentKk: item.contentKk?.trim?.() || '',
    };
    try {
      const saved = await createNews(payload);
      setNewsItems((prev) => [saved || payload, ...prev]);
    } catch (error) {
      console.warn('[NewsProvider] Failed to create news via API, fallback local', error);
      setNewsItems((prev) => [payload, ...prev]);
    }
  };

  const updateNewsItem = async (id, updates) => {
    const normalizeUpdatedItem = (item) => ({
      ...item,
      ...updates,
      imageUrls: updates.imageUrls
        ? normalizeMedia(updates.imageUrls)
        : item.imageUrls,
      videoUrls: updates.videoUrls
        ? normalizeMedia(updates.videoUrls)
        : item.videoUrls,
    });
    try {
      const saved = await updateNews(id, updates);
      setNewsItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...saved } : item
        )
      );
    } catch (error) {
      console.warn('[NewsProvider] Failed to update news via API, fallback local', error);
      setNewsItems((prev) =>
        prev.map((item) => (item.id === id ? normalizeUpdatedItem(item) : item))
      );
    }
  };

  const value = useMemo(
    () => ({ newsItems, addNewsItem, updateNewsItem }),
    [newsItems]
  );

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
};

export const useNews = () => useContext(NewsContext);
