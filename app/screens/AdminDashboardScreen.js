import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View } from 'react-native';

export default function AdminDashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bgWhite">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        className="px-6 pt-6"
      >
        <Text className="text-darkGrayText font-exoSemibold text-3xl mb-4">
          Admin dashboard
        </Text>
        <View className="bg-white rounded-2xl border border-bgPurple/15 p-4 gap-3">
          <Text className="font-exo text-darkGrayText">
            Здесь будет аналитика школы: зачисления, активность учеников и
            публикации. Пока это заглушка для будущего функционала.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
