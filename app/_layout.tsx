import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { applyThemePreference, useTheme } from '@/constants/theme';
import { CallBar } from '@/components/call-bar';
import { ReportSheet } from '@/components/report-sheet';
import { OptionsHost } from '@/components/options-host';
import { ToastHost } from '@/components/toast-host';
import { AccountProvider, useAccount } from '@/lib/account';
import { watchIncomingCalls } from '@/lib/call';
import { reportCommit, useReporting } from '@/lib/report-store';
import { wireNetwork } from '@/lib/network';
import { push } from '@/lib/outbox';
import { CacheBuster, persister, queryClient, SevenDays, wireAppState } from '@/lib/query-client';

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

  // Back online, or back in the foreground: whatever waited in the outbox goes out.
  useEffect(() => {
    const unwire = wireNetwork(() => {
      push(queryClient).catch(() => {});
    });
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        push(queryClient).catch(() => {});
      }
    });

    return () => {
      unwire();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  if (!loaded) {
    return null;
  }

  // Gestures (swipe to reply, the colour sliders, the image viewer) need this root above every screen.
  return (
    <GestureHandlerRootView style={styles.root}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: SevenDays, buster: CacheBuster }}>
        <AccountProvider>
          <ShareIntentProvider>
            <ShareTarget />
            <RootLayoutNav />
          </ShareIntentProvider>
        </AccountProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
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
  const { status } = useAccount();
  const signedIn = status === 'signed-in';

  // The splash stays up until the session is known, so neither Login nor Home flashes before the other.
  useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [status]);

  // Signed in, the app listens for a call ringing while it is in front.
  useEffect(() => (signedIn ? watchIncomingCalls() : undefined), [signedIn]);

  if (status === 'loading') {
    return null;
  }

  // Signed in, the tabs and everything above them exist and onboarding does
  // not; signed out, the reverse. The router drops the other side's history,
  // so back can never re-enter a signed-out tab bar or a finished onboarding.
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, primary: theme.primary, background: theme.shell, card: theme.surface, text: theme.ink, border: theme.hairline, notification: theme.destructive },
      }}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.shell } }}>
        <Stack.Protected guard={signedIn} redirectTo="/onboarding">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
          <Stack.Screen name="commits/[id]" />
          <Stack.Screen name="remotes/[target]" />
          <Stack.Screen name="remotes/new" />
          <Stack.Screen name="users/[username]/index" />
          <Stack.Screen name="users/[username]/[type]" />
          <Stack.Screen name="orgs/[handle]" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/safety" />
          <Stack.Screen name="settings/devices" />
          <Stack.Screen name="settings/language" />
          <Stack.Screen name="scheduled" />
          <Stack.Screen name="starred" />
          <Stack.Screen name="search" />
          <Stack.Screen name="card/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="outbox" />
          <Stack.Screen name="image" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo="/(tabs)">
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" />
      </Stack>
      <ReportSheet commit={reporting} onClose={() => reportCommit(null)} />
      <OptionsHost />
      <ToastHost />
      <CallBar />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
