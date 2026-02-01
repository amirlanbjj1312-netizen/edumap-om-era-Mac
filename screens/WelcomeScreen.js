import { View } from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Button from '../components/button';
import { LinearGradient } from 'expo-linear-gradient';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  return (
    <LinearGradient
      colors={['#786AFF', '#4FCCFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 justify-center items-center px-6">
        <View className="w-full items-center gap-8">
          <Button
            primaryBtnText={'Sign Up'}
            onPrimaryBtnPress={() => navigation.navigate('SignUp')}
            secondaryBtnText1={'Already have an account?'}
            secondaryBtnText2={'Sign In'}
            onSecondaryBtnPress={() => navigation.navigate('SignIn')}
            showTertiaryBtn
            tertiaryBtnText={'Continue as Guest'}
            secondaryTextColorClass="text-bgWhite opacity-80"
            secondaryHighlightColorClass="text-bgWhite font-exoSemibold"
            tertiaryTextColorClass="text-bgWhite opacity-90"
            onTertiaryBtnPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              })
            }
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
