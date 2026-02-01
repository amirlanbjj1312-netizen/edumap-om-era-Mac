import React, { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { loadConsultationRequests } from '../services/consultationRequests';
import { useLocale } from '../context/LocaleContext';

const GRADIENT_COLORS = ['#786AFF', '#4FCCFF'];

export default function AdminStatisticsScreen() {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState('notifications');
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const tabs = [
    { key: 'notifications', label: t('adminStats.tabs.notifications') },
    { key: 'analytics', label: t('adminStats.tabs.analytics') },
  ];

  const refreshRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const data = await loadConsultationRequests();
      setRequests(data);
    } catch (error) {
      console.warn('load consultation requests failed', error);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshRequests();
    }, [refreshRequests])
  );

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={GRADIENT_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} className="px-6 pt-6">
          <Text className="text-white font-exoSemibold text-3xl mb-4">
            {t('adminStats.title')}
          </Text>

          <View className="flex-row bg-bgPurple/10 rounded-2xl p-1 mb-5">
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                className={`flex-1 py-3 rounded-xl ${activeTab === tab.key ? 'bg-white shadow-sm' : ''}`}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  className={`text-center font-exoSemibold ${
                    activeTab === tab.key ? 'text-bgPurple' : 'text-darkGrayText/70'
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

        {activeTab === 'notifications' ? (
          <View className="bg-white rounded-2xl border border-bgPurple/15 p-4 gap-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-exoSemibold text-darkGrayText text-base">
                {t('adminStats.requests.title')}
              </Text>
              <Pressable onPress={refreshRequests} className="px-3 py-1 rounded-full bg-bgPurple/10">
                <Text className="font-exoSemibold text-bgPurple text-sm">
                  {t('adminStats.action.refresh')}
                </Text>
              </Pressable>
            </View>
            {loadingRequests ? (
              <Text className="font-exo text-darkGrayText/80 text-sm">
                {t('adminStats.requests.loading')}
              </Text>
            ) : requests.length ? (
              requests.slice(0, 10).map((request) => (
                <TouchableOpacity
                  key={request.id}
                  activeOpacity={0.85}
                  onPress={() =>
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      next.has(request.id) ? next.delete(request.id) : next.add(request.id);
                      return next;
                    })
                  }
                  style={[
                    styles.requestCard,
                    selectedIds.has(request.id)
                      ? styles.requestCardActive
                      : styles.requestCardIdle,
                  ]}
                >
                  <View
                    style={styles.requestCheckbox}
                    className={`w-6 h-6 rounded-md border ${
                      selectedIds.has(request.id)
                        ? 'bg-bgPurple border-bgPurple'
                        : 'border-bgPurple/30 bg-white'
                    } items-center justify-center`}
                  >
                    {selectedIds.has(request.id) ? (
                      <Text className="text-white font-exoSemibold">✓</Text>
                    ) : null}
                  </View>

                  <View className="flex-1">
                    <Text className="font-exoSemibold text-darkGrayText text-base">
                      {request.parentName} → {request.childName}
                    </Text>
                    <Text className="font-exo text-darkGrayText/70 text-sm">
                      {request.consultationType} · {new Date(request.createdAt).toLocaleString()}
                    </Text>
                    <Text className="font-exo text-darkGrayText/80 text-sm mt-1">
                      {t('adminStats.requests.phone')} {request.parentPhone}
                    </Text>
                    {request.parentEmail ? (
                      <Text className="font-exo text-darkGrayText/80 text-sm">
                        {t('adminStats.requests.email')} {request.parentEmail}
                      </Text>
                    ) : null}
                    {request.comment ? (
                      <Text className="font-exo text-darkGrayText/80 text-sm mt-1">
                        {t('adminStats.requests.comment')} {request.comment}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text className="font-exo text-darkGrayText/80 text-sm">
                {t('adminStats.requests.empty')}
              </Text>
            )}
          </View>
        ) : (
          <View className="gap-3">
            <View className="bg-white rounded-2xl border border-bgPurple/15 p-4">
              <Text className="font-exoSemibold text-darkGrayText text-lg">
                {t('adminStats.analytics.rating')}
              </Text>
              <Text className="font-exo text-darkGrayText/75 text-sm mt-1">
                {t('adminStats.analytics.ratingHint')}
              </Text>
            </View>
            <View className="bg-white rounded-2xl border border-bgPurple/15 p-4">
              <Text className="font-exoSemibold text-darkGrayText text-lg">
                {t('adminStats.analytics.visits')}
              </Text>
              <Text className="font-exo text-darkGrayText/75 text-sm mt-1">
                {t('adminStats.analytics.visitsHint')}
              </Text>
            </View>
          </View>
        )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GRADIENT_COLORS[0],
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  requestCard: {
    borderRadius: 24,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
  },
  requestCheckbox: {
    marginRight: 12,
  },
  requestCardActive: {
    borderColor: '#4F46E5',
    backgroundColor: 'rgba(79,70,229,0.08)',
  },
  requestCardIdle: {
    borderColor: 'rgba(79,70,229,0.25)',
    backgroundColor: '#FFFFFF',
  },
});
