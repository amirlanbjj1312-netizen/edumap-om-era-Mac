import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeftIcon } from 'react-native-heroicons/outline';
import { useAuth } from '../context/AuthContext';

const InputField = ({ label, value, onChangeText, placeholder }) => (
  <View className="mb-4">
    <Text className="text-white font-exoSemibold mb-2">{label}</Text>
    <View className="bg-white rounded-xl border border-bgPurple/15 px-4 py-3">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        secureTextEntry
        className="font-exo text-darkGrayText"
      />
    </View>
  </View>
);

export default function ChangePasswordScreen({ navigation }) {
  const { account, updateAccount } = useAuth();
  const [current, setCurrent] = useState('');
  const [nextPwd, setNextPwd] = useState('');
  const [confirm, setConfirm] = useState('');

  const validate = () => {
    if (!current) {
      Alert.alert('Enter current password');
      return false;
    }
    if (account?.password && current !== account.password) {
      Alert.alert('Wrong password', 'Current password does not match.');
      return false;
    }
    if (!nextPwd || nextPwd.length < 6) {
      Alert.alert('Too short', 'New password must be at least 6 characters.');
      return false;
    }
    if (nextPwd !== confirm) {
      Alert.alert('No match', 'New password and confirmation must match.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await updateAccount({ password: nextPwd });
    Alert.alert('Password updated', 'Your password has been changed.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

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
            Change password
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <InputField
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            placeholder="Enter current password"
          />
          <InputField
            label="New password"
            value={nextPwd}
            onChangeText={setNextPwd}
            placeholder="Enter new password"
          />
          <InputField
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat new password"
          />

          <Pressable
            className="bg-white rounded-full py-3 mt-4 items-center"
            onPress={handleSave}
          >
            <Text className="text-bgPurple font-exoSemibold text-base">
              Save password
            </Text>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
