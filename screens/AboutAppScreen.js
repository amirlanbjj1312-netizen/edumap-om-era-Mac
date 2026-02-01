import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Pressable, Linking, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeftIcon, EnvelopeIcon } from 'react-native-heroicons/outline';
import { useLocale } from '../context/LocaleContext';

export default function AboutAppScreen({ navigation }) {
  const { t } = useLocale();
  const [openDoc, setOpenDoc] = useState(null); // 'offer' | 'privacy' | null
  const openEmail = () => {
    Linking.openURL('mailto:hello@edumap.app').catch(() => {});
  };

  const SectionCard = ({ title, children }) => (
    <View className="bg-white rounded-2xl border border-bgPurple/15 p-4 mb-4">
      <Text className="text-darkGrayText font-exoSemibold text-lg mb-2">
        {title}
      </Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#44C5F5' }}>
      <LinearGradient
        colors={['#44C5F5', '#7E73F4', '#44C5F5']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        <View className="flex-row items-center px-4 pt-4 pb-2">
          <Pressable
            className="w-11 h-11 rounded-full bg-white/20 items-center justify-center"
            onPress={() => navigation.goBack()}
          >
            <ArrowLeftIcon size={22} color="#FFFFFF" />
          </Pressable>
          <Text className="flex-1 text-center text-white font-exoSemibold text-xl">
            {t('aboutApp.title')}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <SectionCard title={t('aboutApp.section.whatTitle')}>
            <Text className="text-darkGrayText font-exo leading-5">
              {t('aboutApp.section.whatBody')}
            </Text>
          </SectionCard>

          <SectionCard title={t('aboutApp.section.contactTitle')}>
            <Pressable
              className="flex-row items-center bg-bgPurple/10 rounded-xl px-3 py-2"
              onPress={openEmail}
            >
              <EnvelopeIcon size={18} color="#7E73F4" />
              <Text className="text-bgPurple font-exoSemibold text-base ml-2">
                hello@edumap.app
              </Text>
            </Pressable>
          </SectionCard>

          <SectionCard title={t('aboutApp.section.legalTitle')}>
            <Pressable
              className="bg-bgPurple/10 rounded-xl px-4 py-3 mb-3"
              onPress={() => setOpenDoc('offer')}
            >
              <Text className="text-bgPurple font-exoSemibold text-base">
                {t('aboutApp.legal.offerTitle')}
              </Text>
              <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
                {t('aboutApp.legal.offerSubtitle')}
              </Text>
            </Pressable>
            <Pressable
              className="bg-bgPurple/10 rounded-xl px-4 py-3"
              onPress={() => setOpenDoc('privacy')}
            >
              <Text className="text-bgPurple font-exoSemibold text-base">
                {t('aboutApp.legal.privacyTitle')}
              </Text>
              <Text className="text-darkGrayText/70 font-exo text-sm mt-1">
                {t('aboutApp.legal.privacySubtitle')}
              </Text>
            </Pressable>
          </SectionCard>
        </ScrollView>

        <Modal visible={!!openDoc} transparent animationType="fade">
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-white rounded-t-3xl p-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-darkGrayText font-exoSemibold text-xl">
                  {openDoc === 'offer'
                    ? t('aboutApp.legal.offerTitle')
                    : t('aboutApp.legal.privacyTitle')}
                </Text>
                <Pressable
                  className="px-3 py-1"
                  onPress={() => setOpenDoc(null)}
                >
                  <Text className="text-bgPurple font-exoSemibold text-base">
                    {t('aboutApp.action.close')}
                  </Text>
                </Pressable>
              </View>
              {openDoc === 'offer' ? (
                <Text className="text-darkGrayText font-exo leading-6">
                  {t('aboutApp.legal.offerBody')}
                </Text>
              ) : (
                <View>
                  <Text className="text-darkGrayText font-exo leading-6 mb-3">
                    {t('aboutApp.legal.privacyBody')}
                  </Text>
                  <Text className="text-darkGrayText/80 font-exo text-sm">
                    {t('aboutApp.legal.privacyNote')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}
