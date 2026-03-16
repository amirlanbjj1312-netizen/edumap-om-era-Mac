import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from 'react-native-heroicons/outline';
import { useAuth } from '../context/AuthContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  onToggleSecure,
}) => (
  <View className="mb-4">
    <Text className="text-white font-exoSemibold mb-2">{label}</Text>
    <View className="bg-white rounded-xl border border-bgPurple/15 px-4 py-3 flex-row items-center">
      <TextInput
        key={secureTextEntry ? 'secure' : 'text'}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        secureTextEntry={secureTextEntry}
        className="font-exo text-darkGrayText flex-1"
      />
      <Pressable onPress={onToggleSecure} hitSlop={8}>
        {secureTextEntry ? (
          <EyeIcon size={18} color="#64748B" />
        ) : (
          <EyeSlashIcon size={18} color="#64748B" />
        )}
      </Pressable>
    </View>
  </View>
);

export default function ChangePasswordScreen({ navigation }) {
  const { account, updateAccount } = useAuth();
  const [current, setCurrent] = useState('');
  const [nextPwd, setNextPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#E9EEF6' }}>
      <LinearGradient
        colors={['#E9EEF6', '#E9EEF6', '#E9EEF6']}
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
        <KeyboardAwareScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          enableOnAndroid
          extraScrollHeight={24}
        >
          <InputField
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            placeholder="Enter current password"
            secureTextEntry={!showCurrent}
            onToggleSecure={() => setShowCurrent((prev) => !prev)}
          />
          <InputField
            label="New password"
            value={nextPwd}
            onChangeText={setNextPwd}
            placeholder="Enter new password"
            secureTextEntry={!showNext}
            onToggleSecure={() => setShowNext((prev) => !prev)}
          />
          <InputField
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat new password"
            secureTextEntry={!showConfirm}
            onToggleSecure={() => setShowConfirm((prev) => !prev)}
          />

          <Pressable
            className="bg-white rounded-full py-3 mt-4 items-center"
            onPress={handleSave}
          >
            <Text className="text-bgPurple font-exoSemibold text-base">
              Save password
            </Text>
          </Pressable>
        </KeyboardAwareScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
