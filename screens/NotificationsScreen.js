import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeftIcon, BellIcon } from 'react-native-heroicons/outline';

export default function NotificationsScreen({ navigation }) {
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
            Notifications
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white/10 rounded-2xl border border-white/20 p-5 items-center">
            <BellIcon color="#FFFFFF" size={32} />
            <Text className="text-white font-exoSemibold text-lg mt-3">
              All alerts from Monetizer
            </Text>
            <Text className="text-white/80 font-exo text-sm mt-2 text-center">
              Здесь будут системные уведомления: новости, дедлайны, обновления. Пока пусто.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
