import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function WelcomeNewUserScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const firstName = route.params?.firstName?.trim() ?? '';
  const lastName = route.params?.lastName?.trim() ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const displayName = fullName || 'friend';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    let isMounted = true;
    let timerId;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!isMounted) return;
      timerId = setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }, 1500);
    });
    return () => {
      isMounted = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [fadeAnim, navigation, translateAnim]);

  return (
    <LinearGradient
      colors={['#786AFF', '#4FCCFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: translateAnim }] },
          ]}
        >
          <Text style={styles.title}>Enjoy your experience</Text>
          <Text style={styles.name}>{displayName}</Text>
          <Pressable
            style={styles.button}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              })
            }
          >
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'italianno',
    fontSize: 36,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  name: {
    fontFamily: 'exo',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 28,
    textAlign: 'center',
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  buttonText: {
    fontFamily: 'exoSemibold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
