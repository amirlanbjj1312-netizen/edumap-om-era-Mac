import React, { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLocale } from '../context/LocaleContext';
import { getGeneralRoom } from '../services/chatApi';

export default function UserChatsScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openGeneralChat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const room = await getGeneralRoom();
      const roomId = String(room?.roomId || 'general');
      navigation.navigate('ChatRoom', {
        roomId,
        title: t('chat.group.title'),
      });
    } catch (e) {
      setError(e?.message || t('chat.group.openError'));
    } finally {
      setLoading(false);
    }
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      openGeneralChat();
    }, [openGeneralChat])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('chat.group.title')}</Text>
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
  safe: { flex: 1, backgroundColor: '#EEF1F6' },
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

