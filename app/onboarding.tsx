import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { NullPointerLogo } from '@/components/mark';
import { TermsConsent } from '@/components/terms-consent';
import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError, baseUrl } from '@/lib/client';
import { currentKey, existingKey } from '@/lib/device-key';
import { signInWithGitHub } from '@/lib/sign-in';
import type { SshKey } from '@/lib/ssh-key';

export default function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const account = useAccount();
  const [key, setKey] = useState<SshKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const existing = await existingKey();
        const loaded = existing ?? (await currentKey());

        if (cancelled) {
          return;
        }

        setKey(loaded);

        // If devnull already approved this key (e.g. stored sign-in was lost), skip the button.
        if (existing !== null && account.status === 'signed-out') {
          try {
            const me = await api.me();

            if (!cancelled && me.user?.handle) {
              await account.signIn(me.user);
              router.replace('/(tabs)');
            }
          } catch {
            // Not approved yet; fall through to the sign-in button.
          }
        }
      } catch (exception) {
        if (!cancelled) {
          setError(exception instanceof Error ? exception.message : String(exception));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async () => {
    if (key === null) {
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const outcome = await signInWithGitHub(key, baseUrl(), agreed);

      if (outcome.type === 'signed-in') {
        await account.signIn(outcome.user);
        router.replace('/(tabs)');
      } else if (outcome.type === 'error') {
        setError(outcome.message);
      }
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.firstError() : 'fatal: could not open dev-null.sh to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.shell, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.hero}>
        <NullPointerLogo width={150} />
        <Text muted style={styles.tagline}>A social network for developers, drawn as a git log.</Text>
      </View>

      <View style={styles.footer}>
        {error && <Text variant="mono" muted style={styles.fatal}>{error}</Text>}

        <TermsConsent checked={agreed} onChange={setAgreed} />

        <Button title={error ? 'Try again' : 'Sign in with GitHub'} onPress={signIn} busy={busy} disabled={key === null || !agreed} size="lg" />

        <Text variant="small" muted style={styles.how}>
          This opens dev-null.sh in your browser. Sign in with GitHub there if you aren’t already, then approve this phone’s key. No password is ever typed into the app.
        </Text>

        <Text variant="mono" muted style={styles.fingerprint} numberOfLines={1}>
          {key ? key.fingerprint() : 'generating this phone’s key…'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: Space.gutterWide },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  tagline: { textAlign: 'center', maxWidth: 280 },
  footer: { gap: 16 },
  fatal: { textAlign: 'center' },
  how: { textAlign: 'center' },
  fingerprint: { textAlign: 'center', fontSize: 11 },
});
