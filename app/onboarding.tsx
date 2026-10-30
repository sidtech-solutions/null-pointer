import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { NullPointerLogo } from '@/components/mark';
import { TermsConsent } from '@/components/terms-consent';
import { Text } from '@/components/text';
import { Fonts, Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError, baseUrl } from '@/lib/client';
import { currentKey, existingKey } from '@/lib/device-key';
import { reviewAccessEnabled, unlockReviewAccess } from '@/lib/review-access';
import { signInWithGitHub } from '@/lib/sign-in';
import type { SshKey } from '@/lib/ssh-key';

export default function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const [key, setKey] = useState<SshKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // App Review types the demo account's username and password here (review builds only).
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const reviewer = reviewAccessEnabled();

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
      } else if (outcome.type === 'error') {
        setError(outcome.message);
      }
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.firstError() : 'fatal: could not open dev-null.sh to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const signInAsReviewer = async () => {
    setError(null);
    setBusy(true);

    try {
      const outcome = await unlockReviewAccess(username, password);

      if (outcome.type === 'wrong-credentials') {
        setError('fatal: those are not the review credentials. Everyone else signs in with GitHub above.');
        return;
      }

      if (outcome.type === 'error') {
        setError(outcome.message);
        return;
      }

      // The phone now holds the review key, so GitHub sign-in below would also use it.
      setKey(outcome.key);

      try {
        const me = await api.me();

        if (!me.user?.handle) {
          throw new ApiError('fatal: dev-null.sh returned no user for the review key.', 200);
        }

        await account.signIn(me.user);
      } catch (exception) {
        setError(
          exception instanceof ApiError
            ? `fatal: dev-null.sh does not accept the review key yet (${exception.firstError()}). Sign in with GitHub once to approve it.`
            : 'fatal: could not reach dev-null.sh.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.shell, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.hero} accessibilityRole="image" accessibilityLabel="null-pointer" testID="welcome-logo">
        <NullPointerLogo width={150} />
        <Text muted style={styles.tagline}>A social network for developers, drawn as a git log.</Text>
      </View>

      <View style={styles.footer}>
        {error && <Text variant="mono" muted style={styles.fatal}>{error}</Text>}

        <TermsConsent checked={agreed} onChange={setAgreed} />

        <Button title={error && !reviewer ? 'Try again' : 'Sign in with GitHub'} onPress={signIn} busy={busy} disabled={key === null || !agreed} size="lg" />

        <Text variant="small" muted style={styles.how}>
          This opens dev-null.sh in your browser. Sign in with GitHub there if you aren’t already, then approve this phone’s key. No password is ever typed into the app.
        </Text>

        {reviewer && (
          <View style={styles.reviewer}>
            <Text variant="small" muted style={styles.how}>Reviewing the app? Sign in with the username and password from the review notes.</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={theme.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
              style={[styles.field, { color: theme.ink, borderColor: theme.rail, backgroundColor: theme.surface }]}
              accessibilityLabel="Username"
              testID="review-username"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.inkMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={signInAsReviewer}
              style={[styles.field, { color: theme.ink, borderColor: theme.rail, backgroundColor: theme.surface }]}
              accessibilityLabel="Password"
              testID="review-password"
            />
            <Button title="Sign in" variant="outline" onPress={signInAsReviewer} busy={busy} disabled={username.trim() === '' || password === ''} size="lg" />
          </View>
        )}

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
  reviewer: { gap: 8, marginTop: 8 },
  field: { height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, fontFamily: Fonts.mono, fontSize: 15 },
  fatal: { textAlign: 'center' },
  how: { textAlign: 'center' },
  fingerprint: { textAlign: 'center', fontSize: 11 },
});
