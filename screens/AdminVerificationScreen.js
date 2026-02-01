import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';

export default function AdminVerificationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const [password, setPassword] = useState('');
  const [fileName, setFileName] = useState('');
  const signupValues = route.params?.signupValues ?? {};
  const canSubmit = Boolean(fileName && password.trim());
  const isValidEcpFile = (name = '') => {
    const lower = name.toLowerCase();
    return lower.endsWith('.p12') || lower.endsWith('.pfx');
  };

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.type === 'cancel') {
        return;
      }
      const pickedName = result.name || 'Selected file';
      if (!isValidEcpFile(pickedName)) {
        Alert.alert(
          'Unsupported file',
          'Please choose a .p12 or .pfx ECP file.'
        );
        return;
      }
      setFileName(pickedName);
    } catch (error) {
      Alert.alert('File error', 'Не удалось выбрать файл. Попробуйте снова.');
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      Alert.alert('Attach file', 'Пожалуйста, выберите файл и введите пароль.');
      return;
    }
    if (!isValidEcpFile(fileName)) {
      Alert.alert('Invalid file', 'Please attach a valid .p12/.pfx ECP file.');
      return;
    }
    if (password.trim().length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <LinearGradient
      colors={['#786AFF', '#4FCCFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 40,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center mb-4">
            <Pressable
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
            >
              <Text className="text-white text-xl font-exoSemibold">{'<'}</Text>
            </Pressable>
          </View>

          <Text className="text-white font-exoSemibold text-3xl mb-6">
            School verification
          </Text>

          <View className="bg-white/15 border border-white/25 rounded-3xl p-5 mb-6">
            <Text className="text-white/90 font-exo text-base mb-3">
              Check the details before uploading your ECP key:
            </Text>
            {[
              ['School / organisation', signupValues.organization],
              ['BIN', signupValues.bin],
              ['Representative IIN', signupValues.iin],
              ['License number', signupValues.licenseNumber],
              ['License issue date', signupValues.licenseIssuedAt],
              ['License expiry date', signupValues.licenseExpiresAt],
              ['Contact phone', signupValues.contactPhone],
              ['Website', signupValues.website],
            ].map(([label, value]) => (
              <View
                key={label}
                className="flex-row justify-between items-center py-2 border-b border-white/10"
              >
                <Text className="text-white/70 font-exo text-sm mr-4">
                  {label}
                </Text>
                <Text className="text-white font-exoSemibold text-sm flex-1 text-right">
                  {value || '—'}
                </Text>
              </View>
            ))}
          </View>

          <View className="bg-white/15 border border-white/25 rounded-3xl p-5">
            <Text className="text-white font-exoSemibold text-base mb-3">
              Upload ECP key
            </Text>
            <Pressable
              onPress={handleSelectFile}
              className="w-full py-4 rounded-2xl border border-dashed border-white/45 items-center bg-white/5"
            >
              <Text className="text-white font-exo text-base">
                {fileName || 'Select .p12/.pfx file'}
              </Text>
              <Text className="text-white/60 font-exo text-xs mt-1">
                Для теста примем любой файл, проверка ЭЦП будет позже
              </Text>
            </Pressable>

            <Text className="text-white font-exoSemibold text-base mt-6 mb-2">
              Key password
            </Text>
            <TextInput
              className="bg-white/90 rounded-2xl px-4 py-3 font-exo"
              placeholder="Password"
              placeholderTextColor="rgba(0,0,0,0.4)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </ScrollView>

        <View className="absolute bottom-6 left-6 right-6">
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-4 rounded-2xl items-center"
            style={{
              backgroundColor: '#FFFFFF',
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            <Text className="text-[#2870FF] font-exoSemibold text-base">
              Submit for review
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
