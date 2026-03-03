import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { getGeneralMessages, sendGeneralMessage } from '../services/chatApi';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ChatRoomScreen() {
  const route = useRoute();
  const { account } = useAuth();
  const { t } = useLocale();
  const title = String(route.params?.title || t('chat.group.title'));
  const currentUserId = account?.id || '';
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getGeneralMessages();
      setMessages(data);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить сообщения');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 3500);
    return () => clearInterval(timer);
  }, [loadMessages]);

  const onSend = useCallback(async () => {
    const body = String(text || '').trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    setText('');
    try {
      const sent = await sendGeneralMessage(body);
      if (sent) {
        setMessages((prev) => [...prev, sent]);
      } else {
        await loadMessages();
      }
    } catch (e) {
      setError(e?.message || 'Не удалось отправить сообщение');
      setText(body);
    } finally {
      setSending(false);
    }
  }, [loadMessages, sending, text]);

  const sorted = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      ),
    [messages]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {loading ? (
          <ActivityIndicator color="#3D63DD" style={{ marginTop: 12 }} />
        ) : (
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={sorted}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const mine = item.sender_id === currentUserId;
              return (
                <View style={[styles.messageRow, mine ? styles.mineRow : styles.otherRow]}>
                  <View style={[styles.bubble, mine ? styles.mineBubble : styles.otherBubble]}>
                    {!mine && item?.sender_name ? (
                      <Text style={styles.senderName} numberOfLines={1}>
                        {item.sender_name}
                      </Text>
                    ) : null}
                    <Text style={[styles.messageText, mine ? styles.mineText : styles.otherText]}>
                      {item.body}
                    </Text>
                    <Text style={[styles.timeText, mine ? styles.mineTime : styles.otherTime]}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t('chat.room.empty')}</Text>
            }
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('chat.room.placeholder')}
            placeholderTextColor="#8A94A6"
            style={styles.input}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
            onPress={onSend}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendButtonText}>
              {sending ? t('chat.room.sending') : t('chat.room.send')}
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EEF1F6' },
  container: { flex: 1, paddingHorizontal: 14 },
  title: {
    fontFamily: 'exoSemibold',
    fontSize: 20,
    color: '#1E2740',
    marginTop: 6,
    marginBottom: 8,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 12 },
  messageRow: { width: '100%', marginBottom: 8 },
  mineRow: { alignItems: 'flex-end' },
  otherRow: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '84%',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mineBubble: { backgroundColor: '#3D63DD' },
  otherBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DCE2F0',
  },
  messageText: { fontFamily: 'exo', fontSize: 15 },
  senderName: {
    fontFamily: 'exoSemibold',
    fontSize: 12,
    color: '#3D63DD',
    marginBottom: 2,
  },
  mineText: { color: '#fff' },
  otherText: { color: '#1E2740' },
  timeText: { fontFamily: 'exo', fontSize: 11, marginTop: 4 },
  mineTime: { color: 'rgba(255,255,255,0.9)' },
  otherTime: { color: '#7A859F' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingBottom: 8,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6DDEE',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'exo',
    color: '#1E2740',
  },
  sendButton: {
    backgroundColor: '#3D63DD',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  sendButtonDisabled: { backgroundColor: '#9CADDF' },
  sendButtonText: { color: '#fff', fontFamily: 'exoSemibold', fontSize: 14 },
  emptyText: { fontFamily: 'exo', color: '#6E7893', marginTop: 8 },
  error: { fontFamily: 'exo', color: '#B13838', fontSize: 13, marginBottom: 8 },
});
