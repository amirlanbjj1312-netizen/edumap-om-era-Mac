import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Image, Pressable, Linking, useWindowDimensions } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useNews } from '../context/NewsContext';
import RenderHTML from 'react-native-render-html';
import { ArrowLeftIcon } from 'react-native-heroicons/outline';
import { formatCategoryLabel } from '../data/newsCategories';
import { useLocale } from '../context/LocaleContext';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

export default function NewsDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { newsItems } = useNews();
  const { locale, t } = useLocale();
  const { width } = useWindowDimensions();
  const newsId = route.params?.newsId;

  const news = useMemo(
    () => newsItems.find((item) => item.id === newsId) || newsItems[0],
    [newsId, newsItems]
  );

  if (!news) {
    return null;
  }
  const title = locale === 'en' ? news.titleEn || news.title : news.title;
  const summary = locale === 'en' ? news.summaryEn || news.summary : news.summary;
  const content = locale === 'en' ? news.contentEn || news.content : news.content;

  const openLink = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  const tagsStyles = {
    p: {
      marginTop: 0,
      marginBottom: 12,
      color: '#364356',
      fontFamily: 'exo',
      fontSize: 14,
      lineHeight: 20,
    },
    strong: { fontWeight: '700', color: '#364356' },
    em: { fontStyle: 'italic', color: '#364356' },
    ul: { paddingLeft: 18, listStyleType: 'disc', marginBottom: 12 },
    ol: { paddingLeft: 18, listStyleType: 'decimal', marginBottom: 12 },
    li: {
      marginBottom: 6,
      color: '#364356',
      fontFamily: 'exo',
      fontSize: 14,
      lineHeight: 20,
      listStylePosition: 'inside',
    },
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#FFFFFF' }}>
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <Pressable
          className="w-10 h-10 rounded-full bg-bgPurple/10 items-center justify-center"
          onPress={() => navigation.goBack()}
        >
          <ArrowLeftIcon size={20} color="#7E73F4" />
        </Pressable>
        <Text className="flex-1 text-center text-darkGrayText font-exoSemibold text-lg">
          {t('news.detailTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white rounded-3xl p-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-bgPurple font-exoSemibold">
              {formatCategoryLabel(news.category, locale)}
            </Text>
            <Text className="text-darkGrayText/60 font-exo text-xs">
              {formatDate(news.publishedAt)}
            </Text>
          </View>
          <Text className="text-darkGrayText font-exoSemibold text-2xl mb-3">
            {title}
          </Text>
          {summary ? (
            <Text className="text-darkGrayText/80 font-exo text-sm mb-4">
              {summary}
            </Text>
          ) : null}

          {news.imageUrls?.map((url) => (
            <Image
              key={url}
              source={{ uri: url }}
              style={{
                width: '100%',
                height: 200,
                borderRadius: 16,
                marginBottom: 12,
              }}
              resizeMode="cover"
            />
          ))}

          {content ? (
            <View className="mb-6">
              <RenderHTML
                contentWidth={width - 48}
                source={{ html: content }}
                baseStyle={{ color: '#364356', fontFamily: 'exo', fontSize: 14, lineHeight: 20 }}
                tagsStyles={tagsStyles}
              />
            </View>
          ) : null}

          <View className="flex-row flex-wrap mb-3">
            {news.tags?.map((tag) => (
              <View
                key={tag}
                className="px-3 py-1 bg-bgPurple/10 rounded-full mr-2 mb-2"
              >
                <Text className="text-bgPurple font-exo text-xs">#{tag}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {news.videoUrls?.map((url) => (
              <Pressable
                key={url}
                className="bg-bgPurple/10 rounded-full px-3 py-2 mr-2 mb-2"
                onPress={() => openLink(url)}
              >
                <Text className="text-bgPurple font-exoSemibold text-sm">
                  ▶️ {t('news.watchVideo')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
