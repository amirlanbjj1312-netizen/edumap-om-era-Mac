import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Linking, useWindowDimensions, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNews } from '../context/NewsContext';
import RenderHTML from 'react-native-render-html';
import { useNavigation } from '@react-navigation/native';
import { formatCategoryLabel, getCategoryFilters, resolveCategoryKey } from '../data/newsCategories';
import { useLocale } from '../context/LocaleContext';

const Chip = ({ label }) => (
  <View className="px-2 py-1 bg-bgPurple/10 rounded-full mr-2 mb-2">
    <Text className="text-bgPurple font-exo text-xs">{label}</Text>
  </View>
);

const CategoryChip = ({ label, active, onPress }) => (
  <Pressable
    className={`px-4 py-2 rounded-full mr-3 border ${
      active ? 'bg-[#1FA6FF] border-[#1FA6FF]' : 'bg-white border-[#1FA6FF]'
    }`}
    onPress={onPress}
  >
    <Text
      className={`font-exoSemibold text-sm ${
        active ? 'text-white' : 'text-[#1FA6FF]'
      }`}
    >
      {label}
    </Text>
  </Pressable>
);

const NewsCard = ({ item, onPress, locale }) => {
  const title =
    locale === 'en'
      ? item.titleEn || item.title
      : locale === 'kk'
      ? item.titleKk || item.title
      : item.title;
  const summary =
    locale === 'en'
      ? item.summaryEn || item.summary
      : locale === 'kk'
      ? item.summaryKk || item.summary
      : item.summary;
  const dateLabel = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString()
    : '';
  const firstImage = item.imageUrls?.[0];
  return (
    <Pressable
      className="bg-white rounded-3xl p-4 mb-4 shadow-sm shadow-black/10"
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-bgPurple font-exoSemibold text-xs uppercase">
          {formatCategoryLabel(item.category, locale)}
        </Text>
        {dateLabel ? (
          <Text className="text-darkGrayText/60 font-exo text-xs">{dateLabel}</Text>
        ) : null}
      </View>
      <Text className="text-darkGrayText font-exoSemibold text-lg mb-1">
        {title}
      </Text>
      {summary ? (
        <Text className="text-darkGrayText/80 font-exo text-sm mb-3">
          {summary}
        </Text>
      ) : null}
      {firstImage ? (
        <Image
          source={{ uri: firstImage }}
          style={{ width: '100%', height: 180, borderRadius: 16 }}
          resizeMode="cover"
        />
      ) : null}
      <View className="flex-row flex-wrap mt-3">
        {item.tags?.slice(0, 3).map((tag) => (
          <Chip key={tag} label={`#${tag}`} />
        ))}
      </View>
    </Pressable>
  );
};

export default function NewsScreen() {
  const { newsItems } = useNews();
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = useState('all');
  const { t, locale } = useLocale();

  const sortedNews = useMemo(
    () =>
      [...newsItems].sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      ),
    [newsItems]
  );

  const filteredNews = useMemo(() => {
    if (activeFilter === 'all') return sortedNews;
    return sortedNews.filter(
      (item) => resolveCategoryKey(item.category) === activeFilter
    );
  }, [sortedNews, activeFilter]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#44C5F5' }}>
      <LinearGradient
        colors={['#44C5F5', '#7E73F4', '#44C5F5']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="flex-1 px-6 pt-6"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-white font-exoSemibold text-3xl mb-6">
            {t('news.title')}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
            contentContainerStyle={{ paddingRight: 24 }}
          >
            {getCategoryFilters(locale, t('news.filters.all')).map((item) => (
              <CategoryChip
                key={item.id}
                label={item.label}
                active={activeFilter === item.id}
                onPress={() => setActiveFilter(item.id)}
              />
            ))}
          </ScrollView>

          {filteredNews.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              locale={locale}
              onPress={() => navigation.navigate('NewsDetail', { newsId: item.id })}
            />
          ))}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
