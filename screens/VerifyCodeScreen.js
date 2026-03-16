import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { buildApiUrl } from '../config/apiConfig';
import { supabase } from '../services/supabaseClient';
import { useRole } from '../context/RoleContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function VerifyCodeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { setGuest } = useRole();
  const { email, next, signupValues, mode } = route.params || {};
  const isPasswordResetMode = mode === 'reset_password';
  const registrationPayload = signupValues?.password
    ? {
        password: signupValues.password,
        role: signupValues.role,
        metadata: signupValues.metadata || {},
      }
    : null;

  const [input, setInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(buildApiUrl('/auth/send-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          setError('Код уже отправлен. Подождите 60 секунд и попробуйте снова.');
        } else {
          setError(data?.error || 'Не удалось отправить код. Попробуйте позже.');
        }
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
      const endpoint = registrationPayload
        ? '/auth/register-with-code'
        : isPasswordResetMode
          ? '/auth/reset-password-with-code'
          : '/auth/verify-code';
      const payload = registrationPayload
        ? {
            email,
            code: input.trim(),
            password: registrationPayload.password,
            role: registrationPayload.role,
            metadata: registrationPayload.metadata,
          }
        : isPasswordResetMode
          ? {
              email,
              code: input.trim(),
              password: newPassword,
            }
          : { email, code: input.trim() };
      const resp = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setError(data.error || 'Неверный код. Попробуйте снова.');
        return;
      }
      if (registrationPayload) {
        if (!supabase) {
          throw new Error('Supabase client is not configured');
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: String(email || '').trim().toLowerCase(),
          password: registrationPayload.password,
        });
        if (signInError) {
          throw signInError;
        }
        setGuest(false);
        if (registrationPayload.role === 'admin') {
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
          return;
        }
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'ParentSubscription',
              params: {
                firstName: signupValues?.name,
                lastName: signupValues?.lastName,
                required: true,
              },
            },
          ],
        });
        return;
      }
      if (isPasswordResetMode) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'SignIn' }],
        });
        return;
      }
      if (next === 'AdminVerification') {
        navigation.navigate('AdminVerification', { signupValues: signupValues || {} });
      } else if (next === 'SelectGrade') {
        navigation.navigate('SelectGrade', { userData: signupValues || {} });
      } else {
        setGuest(false);
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      }
    } catch (err) {
      setError('Ошибка проверки. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (email && !sent && !registrationPayload) {
      handleResend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  return (
    <LinearGradient
      colors={['#E9EEF6', '#E9EEF6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 px-6">
        <KeyboardAwareScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          enableOnAndroid
          extraScrollHeight={24}
        >
          <View className="mt-10 mb-8">
            <Text className="text-[#1E2740] font-exoSemibold text-3xl">
              {'Email verification'}
            </Text>
            <Text className="text-[#5D6881] font-exo text-base mt-2">
              {`Мы отправили 6-значный код на ${email || 'указанный email'}.`}
            </Text>
          </View>

          <View className="bg-white border border-[#DCE2F0] rounded-2xl p-4">
            <Text className="text-[#1E2740] font-exoSemibold text-base mb-2">
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
              className="bg-white rounded-2xl px-4 py-3 font-exo text-lg tracking-widest border border-[#D6DDEE] text-[#1E2740]"
              placeholder="••••••"
              placeholderTextColor="rgba(0,0,0,0.25)"
            />
            {isPasswordResetMode ? (
              <>
                <Text className="text-[#1E2740] font-exoSemibold text-base mt-3 mb-2">
                  Новый пароль
                </Text>
                <TextInput
                  value={newPassword}
                  onChangeText={(text) => {
                    setError('');
                    setNewPassword(text);
                  }}
                  secureTextEntry
                  className="bg-white rounded-2xl px-4 py-3 font-exo text-base border border-[#D6DDEE] text-[#1E2740]"
                  placeholder="Минимум 8 символов"
                  placeholderTextColor="rgba(0,0,0,0.25)"
                />
              </>
            ) : null}
            {error ? (
              <Text className="text-[#B13838] font-exo text-sm mt-2">{error}</Text>
            ) : null}

            <Pressable
              onPress={handleVerify}
              disabled={
                loading ||
                input.length < 6 ||
                (isPasswordResetMode && newPassword.trim().length < 8)
              }
              className="bg-white rounded-2xl py-3 items-center mt-4"
              style={{
                opacity:
                  loading ||
                  input.length < 6 ||
                  (isPasswordResetMode && newPassword.trim().length < 8)
                    ? 0.6
                    : 1,
              }}
            >
              <Text className="text-[#2870FF] font-exoSemibold text-base">
                {isPasswordResetMode ? 'Сменить пароль' : 'Confirm'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleResend}
              disabled={loading}
              className="py-3 items-center mt-2"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              <Text className="text-[#3D63DD] font-exoSemibold text-base">
                Resend code
              </Text>
            </Pressable>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
