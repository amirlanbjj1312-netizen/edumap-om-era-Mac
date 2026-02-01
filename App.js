import AppNavigation from './navigation/appNavigation';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { RoleProvider } from './context/RoleContext';
import { SchoolsProvider } from './context/SchoolsContext';
import { Linking } from 'react-native';
import { supabase } from './services/supabaseClient';
import { navigate, navigationRef } from './navigation/navigationRef';
import { AuthProvider } from './context/AuthContext';
import { NewsProvider } from './context/NewsContext';
import { TestsProvider } from './context/TestsContext';
import { LocaleProvider } from './context/LocaleContext';

export default function App() {
  const [isFontLoaded, setFontLoaded] = useState(false);

  const loadCustomFont = async () => {
    await Font.loadAsync({
      exo: require('./assets/fonts/Exo/static/Exo-Regular.ttf'),
      exoSemibold: require('./assets/fonts/Exo/static/Exo-SemiBold.ttf'),
      roboto: require('./assets/fonts/Roboto/Roboto-Light.ttf'),
      robotoBold: require('./assets/fonts/Roboto/Roboto-Bold.ttf'),
      italianno: require('./assets/fonts/Italianno-Regular.ttf'),
    });

    setFontLoaded(true);
  };

  useEffect(() => {
    loadCustomFont();
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const handleDeepLink = async (url) => {
      if (!url) return;

      try {
        const parsed = new URL(url);
        const host = parsed.hostname || parsed.pathname.replace('/', '');
        if (host !== 'auth-callback') {
          return;
        }

        const hashParams = new URLSearchParams(parsed.hash.replace('#', ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (!accessToken || !refreshToken) {
          return;
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.warn('Supabase session error', error);
          return;
        }

        const user = data?.user ?? (await supabase.auth.getUser()).data?.user;
        const routeParams = {
          firstName: user?.user_metadata?.name,
          lastName: user?.user_metadata?.lastName,
        };

        const goWelcome = () => {
          navigate('WelcomeNewUser', routeParams);
        };

        if (navigationRef.isReady()) {
          goWelcome();
        } else {
          setTimeout(goWelcome, 500);
        }
      } catch (error) {
        console.warn('Deep link handling failed', error);
      }
    };

    const init = async () => {
      const initialUrl = await Linking.getInitialURL();
      await handleDeepLink(initialUrl);
    };

    init();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!isFontLoaded) {
    return null;
  }
  return (
    <>
      <StatusBar style="dark" />
      <LocaleProvider>
        <AuthProvider>
          <RoleProvider>
            <SchoolsProvider>
              <NewsProvider>
                <TestsProvider>
                  <AppNavigation />
                </TestsProvider>
              </NewsProvider>
            </SchoolsProvider>
          </RoleProvider>
        </AuthProvider>
      </LocaleProvider>
    </>
  );
}
