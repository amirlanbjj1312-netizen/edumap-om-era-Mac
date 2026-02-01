import React, { useMemo, useState } from 'react';
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
import { useRole, ROLES } from '../context/RoleContext';
import { useLocale } from '../context/LocaleContext';

const InputField = ({ label, value, onChangeText, placeholder, keyboardType }) => (
  <View className="mb-4">
    <Text className="text-white font-exoSemibold mb-2">{label}</Text>
    <View className="bg-white rounded-xl border border-bgPurple/15 px-4 py-3">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        className="font-exo text-darkGrayText"
      />
    </View>
  </View>
);

export default function EditProfileScreen({ navigation }) {
  const { account, updateAccount, deleteAccount } = useAuth();
  const { setRole, setGuest } = useRole();
  const { t } = useLocale();
  const [firstName, setFirstName] = useState(account?.firstName || '');
  const [lastName, setLastName] = useState(account?.lastName || '');
  const [email, setEmail] = useState(account?.email || '');
  const [phone, setPhone] = useState(account?.phone || '');

  const displayName = useMemo(() => {
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    return fullName || account?.organization || t('editProfile.title');
  }, [firstName, lastName, account, t]);

  const validateEmail = (value) => {
    if (!value) return true;
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
  };

  const handleSave = async () => {
    if (!validateEmail(email)) {
      Alert.alert(t('editProfile.errors.invalidEmailTitle'), t('editProfile.errors.invalidEmailBody'));
      return;
    }
    await updateAccount({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    navigation.goBack();
  };

  const handleClearProfile = () => {
    Alert.alert(
      t('editProfile.clear.title'),
      t('editProfile.clear.body'),
      [
        { text: t('editProfile.clear.cancel'), style: 'cancel' },
        {
          text: t('editProfile.clear.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteAccount();
              if (!result.success) {
                Alert.alert(
                  t('editProfile.clear.errorTitle'),
                  result.error || t('editProfile.clear.errorBody')
                );
                return;
              }
              setGuest(false);
              setRole(ROLES.STUDENT);
              navigation.reset({
                index: 0,
                routes: [{ name: 'RoleSelect' }],
              });
            } catch (error) {
              Alert.alert(
                t('editProfile.clear.errorTitle'),
                error?.message || t('editProfile.clear.errorBody')
              );
            }
          },
        },
      ]
    );
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
            {t('editProfile.title')}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white/10 rounded-2xl border border-white/20 p-4 mb-5">
            <Text className="text-white font-exoSemibold text-lg">
              {displayName}
            </Text>
            {account?.organization ? (
              <Text className="text-white/80 font-exo text-sm mt-1">
                {account.organization}
              </Text>
            ) : null}
          </View>

          <InputField
            label={t('editProfile.fields.firstName')}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t('editProfile.placeholders.firstName')}
          />
          <InputField
            label={t('editProfile.fields.lastName')}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('editProfile.placeholders.lastName')}
          />
          <InputField
            label={t('editProfile.fields.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('editProfile.placeholders.email')}
            keyboardType="email-address"
          />
          <InputField
            label={t('editProfile.fields.phone')}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('editProfile.placeholders.phone')}
            keyboardType="phone-pad"
          />

          <Pressable
            className="bg-white rounded-full py-3 mt-4 items-center"
            onPress={handleSave}
          >
            <Text className="text-bgPurple font-exoSemibold text-base">
              {t('editProfile.action.save')}
            </Text>
          </Pressable>

          <Pressable
            className="mt-4 bg-bgPurple rounded-full py-3 items-center"
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <Text className="text-white font-exoSemibold text-base">
              {t('editProfile.action.changePassword')}
            </Text>
          </Pressable>

          <Pressable
            className="mt-4 border border-red-300 bg-red-500/10 rounded-full py-3 items-center"
            onPress={handleClearProfile}
          >
            <Text className="text-red-600 font-exoSemibold text-base">
              {t('editProfile.action.clear')}
            </Text>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
