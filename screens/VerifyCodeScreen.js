import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { buildApiUrl } from '../config/apiConfig';

export default function VerifyCodeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { email, next, signupValues } = route.params || {};

  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleResend = async () => {
    if (verified) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(buildApiUrl('/auth/send-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        setError('Не удалось отправить код. Попробуйте позже.');
      } else {
        setSent(true);
      }
    } catch (err) {
      setError('Не удалось отправить код. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(buildApiUrl('/auth/verify-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: input.trim() }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setError(data.error || 'Неверный код. Попробуйте снова.');
        return;
      }
      setVerified(true);
    } catch (err) {
      setError('Ошибка проверки. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    const passwordOk =
      password.length >= 8 &&
      /[0-9]/.test(password) &&
      /[A-Za-z]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
    if (!passwordOk) {
      setPasswordError(
        'Пароль — минимум 8 символов, с цифрой, буквой и спецсимволом.'
      );
      return;
    }
    const nextSignupValues = { ...(signupValues || {}), email, password };
    if (next === 'AdminVerification') {
      navigation.navigate('AdminVerification', { signupValues: nextSignupValues });
    } else if (next === 'SelectGrade') {
      navigation.navigate('SelectGrade', { userData: nextSignupValues });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  };

  useEffect(() => {
    if (email && !sent && !verified) {
      handleResend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  return (
    <LinearGradient
      colors={['#786AFF', '#4FCCFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 px-6">
        <View className="mt-10 mb-8">
          <Text className="text-white font-exoSemibold text-3xl">
            {verified ? 'Create password' : 'Email verification'}
          </Text>
          <Text className="text-white/80 font-exo text-base mt-2">
            {verified
              ? 'Email подтвержден. Придумайте пароль.'
              : `Мы отправили 6-значный код на ${email || 'указанный email'}.`}
          </Text>
        </View>

        <View className="bg-white/15 border border-white/25 rounded-2xl p-4">
          {!verified && (
            <>
              <Text className="text-white font-exoSemibold text-base mb-2">
                Введите код
              </Text>
              <TextInput
                value={input}
                onChangeText={(t) => {
                  setError('');
                  setInput(t.replace(/[^0-9]/g, '').slice(0, 6));
                }}
                keyboardType="number-pad"
                maxLength={6}
                className="bg-white/90 rounded-2xl px-4 py-3 font-exo text-lg tracking-widest"
                placeholder="••••••"
                placeholderTextColor="rgba(0,0,0,0.25)"
              />
              {error ? (
                <Text className="text-red-200 font-exo text-sm mt-2">{error}</Text>
              ) : null}

              <Pressable
                onPress={handleVerify}
                disabled={loading || input.length < 6}
                className="bg-white rounded-2xl py-3 items-center mt-4"
                style={{ opacity: loading || input.length < 6 ? 0.6 : 1 }}
              >
                <Text className="text-[#2870FF] font-exoSemibold text-base">
                  Confirm
                </Text>
              </Pressable>

              <Pressable
                onPress={handleResend}
                disabled={loading}
                className="py-3 items-center mt-2"
                style={{ opacity: loading ? 0.6 : 1 }}
              >
                <Text className="text-white font-exoSemibold text-base">
                  Resend code
                </Text>
              </Pressable>
            </>
          )}

          {verified && (
            <>
              <Text className="text-white font-exoSemibold text-base mb-2">
                Create password
              </Text>
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPasswordError('');
                  setPassword(t);
                }}
                secureTextEntry
                className="bg-white/90 rounded-2xl px-4 py-3 font-exo text-lg"
                placeholder="Password"
                placeholderTextColor="rgba(0,0,0,0.25)"
              />
              {passwordError ? (
                <Text className="text-red-200 font-exo text-sm mt-2">
                  {passwordError}
                </Text>
              ) : null}
              <Pressable
                onPress={handleFinish}
                className="bg-white rounded-2xl py-3 items-center mt-4"
                style={{ opacity: password.length ? 1 : 0.6 }}
                disabled={!password.length}
              >
                <Text className="text-[#2870FF] font-exoSemibold text-base">
                  Create account
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
