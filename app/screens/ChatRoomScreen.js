import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeftIcon, PaperAirplaneIcon } from 'react-native-heroicons/solid';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { getRoomMessages, sendRoomMessage } from '../services/chatApi';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateLabel = (value, locale = 'ru') => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const todayLabel = locale === 'en' ? 'Today' : locale === 'kk' ? 'Бүгін' : 'Сегодня';
  const yesterdayLabel = locale === 'en' ? 'Yesterday' : locale === 'kk' ? 'Кеше' : 'Вчера';
  if (isSameDay(date, today)) return todayLabel;
  if (isSameDay(date, yesterday)) return yesterdayLabel;
  const dateLocale = locale === 'en' ? 'en-US' : locale === 'kk' ? 'kk-KZ' : 'ru-RU';
  return date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' });
};

const getDateKey = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const AVATAR_COLORS = [
  '#5B8DEF', '#EF5B5B', '#5BEF8D', '#EF9E5B',
  '#A05BEF', '#5BEFEF', '#EF5BA0', '#8DEF5B',
];

const getAvatarColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name = '') => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export default function ChatRoomScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { account } = useAuth();
  const { t, locale } = useLocale();
  const title = String(route.params?.title || t('chat.group.title'));
  const roomId = String(route.params?.roomId || 'general');
  const currentUserId = account?.id || '';
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const flatListRef = useRef(null);

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const data = await getRoomMessages(roomId);
      setMessages(data);
    } catch (e) {
      setError(e?.message || (locale === 'en' ? 'Failed to load messages' : locale === 'kk' ? 'Хабарламаларды жүктеу мүмкін болмады' : 'Не удалось загрузить сообщения'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadMessages();
    const timer = setInterval(() => loadMessages({ silent: true }), 3500);
    return () => clearInterval(timer);
  }, [loadMessages]);

  const onSend = useCallback(async () => {
    const body = String(text || '').trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    setText('');
    try {
      const sent = await sendRoomMessage({ roomKey: roomId, body });
      if (sent) {
        setMessages((prev) => [...prev, sent]);
      } else {
        await loadMessages({ silent: true });
      }
    } catch (e) {
      setError(e?.message || (locale === 'en' ? 'Failed to send message' : locale === 'kk' ? 'Хабарлама жіберу мүмкін болмады' : 'Не удалось отправить сообщение'));
      setText(body);
    } finally {
      setSending(false);
    }
  }, [loadMessages, roomId, sending, text]);

  const sorted = useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      ),
    [messages]
  );

  // Build list items with date separators
  const listItems = useMemo(() => {
    const items = [];
    let lastDateKey = null;
    sorted.forEach((msg) => {
      const dk = getDateKey(msg.created_at);
      if (dk && dk !== lastDateKey) {
        items.push({ type: 'date', key: `date-${dk}`, label: formatDateLabel(msg.created_at, locale) });
        lastDateKey = dk;
      }
      items.push({ type: 'message', key: msg.id, data: msg });
    });
    return items;
  }, [sorted]);

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && listItems.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [listItems.length]);

  useEffect(() => {
    const timeout = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeout);
  }, [listItems.length, scrollToBottom]);

  const renderItem = useCallback(({ item }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{item.label}</Text>
        </View>
      );
    }

    const msg = item.data;
    const mine = msg.sender_id === currentUserId;
    const senderName = msg.sender_name || '';

    return (
      <View style={[styles.messageRow, mine ? styles.mineRow : styles.otherRow]}>
        {!mine && (
          <View style={[styles.avatar, { backgroundColor: getAvatarColor(senderName) }]}>
            <Text style={styles.avatarText}>{getInitials(senderName)}</Text>
          </View>
        )}
        <View style={[styles.bubble, mine ? styles.mineBubble : styles.otherBubble]}>
          {!mine && senderName ? (
            <Text style={[styles.senderName, { color: getAvatarColor(senderName) }]}>
              {senderName}
            </Text>
          ) : null}
          <Text style={[styles.messageText, mine ? styles.mineText : styles.otherText]}>
            {msg.body}
          </Text>
          <View style={styles.timeLine}>
            <Text style={[styles.timeText, mine ? styles.mineTime : styles.otherTime]}>
              {formatTime(msg.created_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [currentUserId]);

  const canSend = text.trim().length > 0 && !sending;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeftIcon size={22} color="#111827" />
        </Pressable>
        <View style={[styles.headerAvatar, { backgroundColor: getAvatarColor(title) }]}>
          <Text style={styles.headerAvatarText}>{getInitials(title)}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#2563EB" size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={listItems}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            onContentSizeChange={scrollToBottom}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>{t('chat.room.empty')}</Text>
              </View>
            }
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('chat.room.placeholder')}
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              multiline
              maxLength={2000}
            />
          </View>
          <Pressable
            style={[styles.sendBtn, canSend ? styles.sendBtnActive : styles.sendBtnInactive]}
            onPress={onSend}
            disabled={!canSend}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <PaperAirplaneIcon size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FB' },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(17,24,39,0.1)',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    fontFamily: 'exoSemibold',
    fontSize: 14,
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'exoSemibold',
    fontSize: 17,
    color: '#111827',
  },

  // List
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: 'exo',
    color: '#9CA3AF',
    fontSize: 14,
  },

  // Date separator
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dateSeparatorText: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },

  // Messages
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-end',
  },
  mineRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 2,
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: 'exoSemibold',
    fontSize: 11,
    color: '#fff',
  },
  bubble: {
    maxWidth: '76%',
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 5,
    borderRadius: 18,
  },
  mineBubble: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  senderName: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    marginBottom: 3,
  },
  messageText: {
    fontFamily: 'exo',
    fontSize: 15,
    lineHeight: 21,
  },
  mineText: { color: '#FFFFFF' },
  otherText: { color: '#111827' },
  timeLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  timeText: {
    fontFamily: 'exo',
    fontSize: 11,
  },
  mineTime: { color: 'rgba(255,255,255,0.7)' },
  otherTime: { color: '#9CA3AF' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(17,24,39,0.1)',
    gap: 8,
  },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  input: {
    fontFamily: 'exo',
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#2563EB',
  },
  sendBtnInactive: {
    backgroundColor: '#D1D5DB',
  },

  error: {
    fontFamily: 'exo',
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
});
