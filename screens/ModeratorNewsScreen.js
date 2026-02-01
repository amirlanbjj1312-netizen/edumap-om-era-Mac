import React, { useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, ScrollView, Text, View, Pressable, TextInput, Linking, useWindowDimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNews } from '../context/NewsContext';
import { PlusIcon } from 'react-native-heroicons/outline';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import RenderHTML from 'react-native-render-html';
import { formatCategoryLabel, getCategoryChoices, NEWS_CATEGORY_CHOICES } from '../data/newsCategories';
import { useLocale } from '../context/LocaleContext';

const Chip = ({ label }) => (
  <View className="px-2 py-1 bg-bgPurple/10 rounded-full mr-2 mb-2">
    <Text className="text-bgPurple font-exo text-xs">{label}</Text>
  </View>
);

const CategoryChip = ({ label, active, onPress }) => (
  <Pressable
    className={`px-4 py-2 rounded-full mr-2 mb-2 border ${
      active ? 'bg-bgPurple border-bgPurple' : 'bg-bgPurple/5 border-bgPurple/30'
    }`}
    onPress={onPress}
  >
    <Text
      className={`font-exoSemibold text-sm ${
        active ? 'text-white' : 'text-bgPurple'
      }`}
    >
      {label}
    </Text>
  </Pressable>
);

const NewsCard = ({ item, onEdit }) => {
  const firstImage = item.imageUrls?.[0];
  return (
    <View className="bg-white rounded-2xl border border-bgPurple/15 p-4 mb-4 shadow-sm shadow-black/5">
      {firstImage ? (
        <Image
          source={{ uri: firstImage }}
          style={{ width: '100%', height: 160, borderRadius: 14, marginBottom: 10 }}
          resizeMode="cover"
        />
      ) : null}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-darkGrayText font-exoSemibold text-lg flex-1 mr-3">
          {item.title}
        </Text>
        <Pressable
          className="bg-bgPurple/10 rounded-full px-3 py-2"
          onPress={() => onEdit(item)}
        >
          <Text className="text-bgPurple font-exoSemibold text-sm">Edit</Text>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap mt-1">
        {item.tags?.map((tag) => (
          <Chip key={tag} label={`#${tag}`} />
        ))}
      </View>
    </View>
  );
};

export default function ModeratorNewsScreen() {
  const { newsItems, addNewsItem, updateNewsItem } = useNews();
  const { locale } = useLocale();
  const richRef = useRef(null);
  const richEnRef = useRef(null);
  const { width } = useWindowDimensions();
  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryEn, setSummaryEn] = useState('');
  const [category, setCategory] = useState(NEWS_CATEGORY_CHOICES[0].label);
  const [tags, setTags] = useState('');
  const [photoInput, setPhotoInput] = useState('');
  const [videoInput, setVideoInput] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);
  const [content, setContent] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [editId, setEditId] = useState(null);

  const sortedNews = useMemo(() => {
    return [...newsItems].sort(
      (a, b) =>
        new Date(b.publishedAt || 0).getTime() -
        new Date(a.publishedAt || 0).getTime()
    );
  }, [newsItems]);

  const handlePublish = async () => {
    if (
      !title.trim() ||
      !summary.trim() ||
      !content.trim() ||
      !titleEn.trim() ||
      !summaryEn.trim() ||
      !contentEn.trim()
    ) {
      Alert.alert('Missing fields', 'Please заполните RU и EN версии заголовка, описания и текста.');
      return;
    }
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (editId) {
      await updateNewsItem(editId, {
        title,
        titleEn,
        summary,
        summaryEn,
        category,
        tags: tagList,
        author: 'Moderator',
        imageUrls,
        videoUrls,
        content,
        contentEn,
      });
    } else {
      await addNewsItem({
        title,
        titleEn,
        summary,
        summaryEn,
        category,
        tags: tagList,
        author: 'Moderator',
        imageUrls,
        videoUrls,
        content,
        contentEn,
      });
    }
    setTitle('');
    setTitleEn('');
    setSummary('');
    setSummaryEn('');
    setCategory('Updates');
    setTags('');
    setPhotoInput('');
    setVideoInput('');
    setImageUrls([]);
    setVideoUrls([]);
    setContent('');
    setContentEn('');
    setEditId(null);
  };

  const addPhoto = () => {
    if (!photoInput.trim()) return;
    setImageUrls((prev) => [...prev, photoInput.trim()]);
    setPhotoInput('');
  };

  const addVideo = () => {
    if (!videoInput.trim()) return;
    setVideoUrls((prev) => [...prev, videoInput.trim()]);
    setVideoInput('');
  };

  const removePhoto = (url) =>
    setImageUrls((prev) => prev.filter((item) => item !== url));
  const removeVideo = (url) =>
    setVideoUrls((prev) => prev.filter((item) => item !== url));

  const startEdit = (item) => {
    setEditId(item.id);
    setTitle(item.title || '');
    setTitleEn(item.titleEn || '');
    setSummary(item.summary || '');
    setSummaryEn(item.summaryEn || '');
    setCategory(formatCategoryLabel(item.category, locale));
    setTags((item.tags || []).join(', '));
    setImageUrls(item.imageUrls || []);
    setVideoUrls(item.videoUrls || []);
    setContent(item.content || '');
    setContentEn(item.contentEn || '');
    setPhotoInput('');
    setVideoInput('');
    richRef.current?.setContentHTML(item.content || '');
    richEnRef.current?.setContentHTML(item.contentEn || '');
  };

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
          contentContainerStyle={{ paddingBottom: 32 }}
          className="px-6 pt-6"
        >
          <Text className="text-white font-exoSemibold text-3xl mb-4">
            Manage news
          </Text>
        <View className="bg-white rounded-2xl border border-bgPurple/15 p-4 mb-6">
          <View className="flex-row items-center mb-3">
            <View className="w-10 h-10 rounded-full bg-bgPurple/10 items-center justify-center mr-2">
              <PlusIcon color="#7E73F4" size={18} />
            </View>
            <Text className="text-darkGrayText font-exoSemibold text-lg">
              Publish news
            </Text>
          </View>
          <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
            <TextInput
              placeholder="Title (RU)"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={setTitle}
              className="font-exo text-darkGrayText"
            />
          </View>
          <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
            <TextInput
              placeholder="Summary (RU)"
              placeholderTextColor="#94A3B8"
              value={summary}
              onChangeText={setSummary}
              className="font-exo text-darkGrayText"
              multiline
            />
          </View>
          <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
            <TextInput
              placeholder="Title (EN)"
              placeholderTextColor="#94A3B8"
              value={titleEn}
              onChangeText={setTitleEn}
              className="font-exo text-darkGrayText"
            />
          </View>
          <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
            <TextInput
              placeholder="Summary (EN)"
              placeholderTextColor="#94A3B8"
              value={summaryEn}
              onChangeText={setSummaryEn}
              className="font-exo text-darkGrayText"
              multiline
            />
          </View>
          <View className="mb-3">
            <Text className="text-darkGrayText font-exoSemibold text-sm mb-2">
              News type
            </Text>
            <View className="flex-row flex-wrap">
              {getCategoryChoices(locale).map((option) => (
                <CategoryChip
                  key={option.id}
                  label={option.label}
                  active={category === option.label}
                  onPress={() => setCategory(option.label)}
                />
              ))}
            </View>
          </View>
          <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
            <TextInput
              placeholder="Tags (comma separated)"
              placeholderTextColor="#94A3B8"
              value={tags}
              onChangeText={setTags}
              className="font-exo text-darkGrayText"
            />
          </View>
          <View className="mb-4">
            <Text className="text-darkGrayText font-exoSemibold text-sm mb-2">
              Content (RU)
            </Text>
            <View className="bg-bgPurple/5 rounded-xl px-3 py-3">
              <RichToolbar
                editor={richRef}
                selectedIconTint="#7E73F4"
                iconTint="#6B7280"
                actions={[
                  actions.setBold,
                  actions.setItalic,
                  actions.setUnderline,
                  actions.insertBulletsList,
              actions.insertOrderedList,
              actions.alignLeft,
              actions.alignCenter,
              actions.alignRight,
              actions.insertLink,
            ]}
            style={{
              backgroundColor: '#E5E7EB',
              borderRadius: 10,
              paddingHorizontal: 6,
              minHeight: 44,
              alignItems: 'center',
              marginBottom: 8,
            }}
          />
          <View
            className="rounded-lg bg-bgPurple/5"
            style={{ height: 200, overflow: 'visible' }}
          >
            <RichEditor
              ref={richRef}
              initialContentHTML={content}
              placeholder="Content (full text, RU)"
              onChange={setContent}
              initialHeight={200}
              nestedScrollEnabled
              scrollEnabled
              editorStyle={{
                backgroundColor: 'transparent',
                color: '#364356',
                placeholderColor: '#94A3B8',
                contentCSSText:
                  'font-family: exo; font-size: 14px; padding: 12px; outline: none; border: none; height: 100%; max-height: 200px; overflow-y: auto; ul,ol{padding-left:22px; margin-top:0; margin-bottom:8px; list-style-position: inside;} ul li{list-style-type: disc; display:list-item;} ol li{list-style-type: decimal; display:list-item;} li{margin-bottom:6px; color:#364356;}',
              }}
              style={{ height: 200 }}
            />
          </View>
        </View>
      </View>
          <View className="mb-4">
            <Text className="text-darkGrayText font-exoSemibold text-sm mb-2">
              Content (EN)
            </Text>
            <View className="bg-bgPurple/5 rounded-xl px-3 py-3">
              <RichToolbar
                editor={richEnRef}
                selectedIconTint="#7E73F4"
                iconTint="#6B7280"
                actions={[
                  actions.setBold,
                  actions.setItalic,
                  actions.setUnderline,
                  actions.insertBulletsList,
                  actions.insertOrderedList,
                  actions.alignLeft,
                  actions.alignCenter,
                  actions.alignRight,
                  actions.insertLink,
                ]}
                style={{
                  backgroundColor: '#E5E7EB',
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  minHeight: 44,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              />
              <View
                className="rounded-lg bg-bgPurple/5"
                style={{ height: 200, overflow: 'visible' }}
              >
                <RichEditor
                  ref={richEnRef}
                  initialContentHTML={contentEn}
                  placeholder="Content (full text, EN)"
                  onChange={setContentEn}
                  initialHeight={200}
                  nestedScrollEnabled
                  scrollEnabled
                  editorStyle={{
                    backgroundColor: 'transparent',
                    color: '#364356',
                    placeholderColor: '#94A3B8',
                    contentCSSText:
                      'font-family: exo; font-size: 14px; padding: 12px; outline: none; border: none; height: 100%; max-height: 200px; overflow-y: auto; ul,ol{padding-left:22px; margin-top:0; margin-bottom:8px; list-style-position: inside;} ul li{list-style-type: disc; display:list-item;} ol li{list-style-type: decimal; display:list-item;} li{margin-bottom:6px; color:#364356;}',
                  }}
                  style={{ height: 200 }}
                />
              </View>
            </View>
          </View>
          <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-3">
            <TextInput
              placeholder="Photo URL (optional)"
              placeholderTextColor="#94A3B8"
              value={photoInput}
              onChangeText={setPhotoInput}
              className="font-exo text-darkGrayText"
            />
            <Pressable
              className="bg-white rounded-full py-2 px-4 self-start mt-2"
              onPress={addPhoto}
            >
              <Text className="text-bgPurple font-exoSemibold text-sm">
                Add photo
              </Text>
            </Pressable>
          </View>
          {imageUrls.length ? (
            <View className="flex-row flex-wrap mb-4">
              {imageUrls.map((url) => (
                <Pressable
                  key={url}
                  className="bg-white/60 rounded-full px-3 py-1 mr-2 mb-2"
                  onPress={() => removePhoto(url)}
                >
                  <Text className="text-bgPurple font-exo text-xs">
                    📷 {url.length > 18 ? `${url.slice(0, 18)}…` : url}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View className="bg-bgPurple/5 rounded-xl px-4 py-3 mb-4">
            <TextInput
              placeholder="Video URL (optional)"
              placeholderTextColor="#94A3B8"
              value={videoInput}
              onChangeText={setVideoInput}
              className="font-exo text-darkGrayText"
            />
            <Pressable
              className="bg-white rounded-full py-2 px-4 self-start mt-2"
              onPress={addVideo}
            >
              <Text className="text-bgPurple font-exoSemibold text-sm">
                Add video
              </Text>
            </Pressable>
          </View>
          {videoUrls.length ? (
            <View className="flex-row flex-wrap mb-4">
              {videoUrls.map((url) => (
                <Pressable
                  key={url}
                  className="bg-white/60 rounded-full px-3 py-1 mr-2 mb-2"
                  onPress={() => removeVideo(url)}
                >
                  <Text className="text-bgPurple font-exo text-xs">
                    ▶️ {url.length > 18 ? `${url.slice(0, 18)}…` : url}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            className="bg-bgPurple rounded-full py-3 items-center"
            onPress={handlePublish}
            disabled={
              !title.trim() ||
              !summary.trim() ||
              !content.trim() ||
              !titleEn.trim() ||
              !summaryEn.trim() ||
              !contentEn.trim()
            }
            style={{
              opacity:
                !title.trim() ||
                !summary.trim() ||
                !content.trim() ||
                !titleEn.trim() ||
                !summaryEn.trim() ||
                !contentEn.trim()
                  ? 0.5
                  : 1,
            }}
          >
            <Text className="text-white font-exoSemibold">
              {editId ? 'Update' : 'Publish'}
            </Text>
          </Pressable>
        </View>

        <Text className="text-white font-exoSemibold text-xl mb-3">
          Published
        </Text>
        {sortedNews.map((item) => (
          <NewsCard key={item.id} item={item} onEdit={startEdit} />
        ))}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
