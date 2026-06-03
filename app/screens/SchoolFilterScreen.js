import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { XMarkIcon } from 'react-native-heroicons/solid';

export default function SchoolFilterScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-bgWhite">
      <View className="flex-row items-center px-4 pt-4">
        <Pressable
          onPress={() => navigation.goBack()}
          className="mr-3 p-2 rounded-full bg-bgPurple/10"
        >
          <XMarkIcon color="#4F46E5" size={20} />
        </Pressable>
        <Text className="font-exoSemibold text-lg text-darkGrayText">Filters</Text>
      </View>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-exoSemibold text-lg text-darkGrayText mb-2">
          Filters coming soon
        </Text>
        <Text className="font-exo text-darkGrayText/70 text-center">
          Здесь появится страница с фильтрами по городам, программам и другим
          параметрам. Пока это заглушка, чтобы видеть навигацию.
        </Text>
      </View>
    </SafeAreaView>
  );
}
