import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { applyThemePreference, useTheme } from '@/constants/theme';
import { ReportSheet } from '@/components/report-sheet';
import { ToastHost } from '@/components/toast-host';
import { AccountProvider, useAccount } from '@/lib/account';
import { reportCommit, useReporting } from '@/lib/report-store';
import { persister, queryClient, SevenDays, wireAppState } from '@/lib/query-client';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();
applyThemePreference();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Geist-Regular': require('../assets/fonts/Geist-Regular.ttf'),
    'Geist-SemiBold': require('../assets/fonts/Geist-SemiBold.ttf'),
    'GeistMono-Regular': require('../assets/fonts/GeistMono-Regular.ttf'),
    'GeistMono-Medium': require('../assets/fonts/GeistMono-Medium.ttf'),
  });

  useEffect(() => wireAppState(), []);

  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: SevenDays }}>
      <AccountProvider>
        <ShareIntentProvider>
          <ShareTarget />
          <RootLayoutNav />
        </ShareIntentProvider>
      </AccountProvider>
    </PersistQueryClientProvider>
  );
}

/** A share that arrives while the app is open goes to the composer, which takes it from there. */
function ShareTarget() {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAccount();
  const { hasShareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) {
      return;
    }

    if (status === 'signed-out') {
      resetShareIntent();
    } else if (status === 'signed-in' && pathname !== '/compose') {
      router.push('/compose');
    }
  }, [hasShareIntent, status, pathname, router, resetShareIntent]);

  return null;
}

function RootLayoutNav() {
  const theme = useTheme();
  const base = theme.dark ? DarkTheme : DefaultTheme;
  const reporting = useReporting();

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, primary: theme.primary, background: theme.shell, card: theme.surface, text: theme.ink, border: theme.hairline, notification: theme.destructive },
      }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.shell } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
        <Stack.Screen name="commits/[id]" />
        <Stack.Screen name="remotes/[target]" />
        <Stack.Screen name="remotes/new" />
        <Stack.Screen name="users/[username]/index" />
        <Stack.Screen name="users/[username]/[type]" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/safety" />
        <Stack.Screen name="starred" />
        <Stack.Screen name="search" />
        <Stack.Screen name="card/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="image" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
      </Stack>
      <ReportSheet commit={reporting} onClose={() => reportCommit(null)} />
      <ToastHost />
    </ThemeProvider>
  );
}
