import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, TextInput, View, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useRole, ROLES } from '../context/RoleContext';

export default function ModeratorPinScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { setRole } = useRole();
  const expectedPin = route.params?.expectedPin;
  const [pin, setPin] = useState('');

  const handleConfirm = () => {
    if (!expectedPin) {
      Alert.alert('Error', 'Moderator credentials are invalid.');
      navigation.goBack();
      return;
    }

    if (pin === expectedPin) {
      setRole(ROLES.MODERATOR);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } else {
      Alert.alert('Incorrect PIN', 'Please check the PIN and try again.');
    }
  };

  return (
    <LinearGradient
      colors={['#786AFF', '#4FCCFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="flex-1"
    >
      <SafeAreaView className="flex-1 px-6 pt-12 pb-8">
        <View className="flex-1 gap-6 justify-center">
          <Text className="text-white font-exoSemibold text-3xl text-center">
            Moderator verification
          </Text>
          <Text className="text-white/80 font-exo text-base text-center">
            Enter the PIN provided by the platform to access the moderator dashboard.
          </Text>
          <TextInput
            className="bg-white/95 rounded-2xl px-4 py-3 font-exo text-center text-lg tracking-[4px]"
            placeholder="••••"
            placeholderTextColor="rgba(0,0,0,0.3)"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
          />
          <Pressable
            className="bg-white rounded-2xl py-3 items-center"
            onPress={handleConfirm}
          >
            <Text className="text-[#2870FF] font-exoSemibold text-base">
              Confirm PIN
            </Text>
          </Pressable>
          <Pressable
            className="items-center"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-white/70 font-exo text-base underline">
              Cancel
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
