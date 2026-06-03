import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocale } from '../context/LocaleContext';

const LANGS = [
  { key: 'ru', label: 'RU' },
  { key: 'en', label: 'EN' },
  { key: 'kk', label: 'KZ' },
];

export default function LanguagePicker() {
  const { locale, setLocale } = useLocale();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {LANGS.map((item, index) => {
        const active = locale === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => setLocale(item.key)}
            hitSlop={6}
            style={{
              marginLeft: index === 0 ? 0 : 6,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? '#1D4ED8' : 'rgba(17,24,39,0.14)',
              backgroundColor: active ? '#DBEAFE' : '#FFFFFF',
            }}
          >
            <Text
              style={{
                fontFamily: 'exoSemibold',
                color: active ? '#1D4ED8' : '#475569',
                fontSize: 12,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
