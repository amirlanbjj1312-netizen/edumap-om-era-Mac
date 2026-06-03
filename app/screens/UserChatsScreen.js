import React, { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLocale } from '../context/LocaleContext';
import { getRoom } from '../services/chatApi';

export default function UserChatsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const roomKey = String(route.params?.roomKey || 'general');
  const supportTitleRaw = t('chat.group.support');
  const supportTitle =
    supportTitleRaw && supportTitleRaw !== 'chat.group.support'
      ? supportTitleRaw
      : 'Поддержка';
  const roomTitle =
    route.params?.title || (roomKey === 'support' ? supportTitle : t('chat.group.title'));

  const openGeneralChat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const room = await getRoom(roomKey);
      const roomId = String(room?.roomId || roomKey);
      navigation.navigate('ChatRoom', {
        roomId,
        title: roomTitle,
      });
    } catch (e) {
      setError(e?.message || t('chat.group.openError'));
    } finally {
      setLoading(false);
    }
  }, [navigation, roomKey, roomTitle, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>{roomTitle}</Text>
        <Text style={styles.description}>{t('chat.group.description')}</Text>
        <Pressable
          style={[styles.openButton, loading && styles.openButtonDisabled]}
          onPress={openGeneralChat}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.openButtonText}>{t('chat.group.open')}</Text>
          )}
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#E9EEF6' },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'exoSemibold',
    fontSize: 28,
    color: '#1E2740',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontFamily: 'exo',
    fontSize: 15,
    color: '#5D6881',
    textAlign: 'center',
    marginBottom: 18,
  },
  openButton: {
    backgroundColor: '#3D63DD',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 190,
    alignItems: 'center',
  },
  openButtonDisabled: { backgroundColor: '#9CADDF' },
  openButtonText: { fontFamily: 'exoSemibold', color: '#FFFFFF', fontSize: 15 },
  error: {
    fontFamily: 'exo',
    color: '#B13838',
    marginTop: 12,
    textAlign: 'center',
  },
});
