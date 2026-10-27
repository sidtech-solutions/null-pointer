import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { TermsConsent } from '@/components/terms-consent';
import { laneColor, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError } from '@/lib/client';
import type { CurrentUser } from '@/lib/types';

/**
 * Shown over the tabs while `me` says the terms in force were not accepted: the first sign-in from a build that did not
 * ask, or a new version since. Nothing else is reachable until the person ticks the box and accepts.
 */
export function TermsGate({ me }: { me: CurrentUser | undefined }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accent = account.user ? laneColor(theme, account.user.lane) : theme.primary;
  const version = me?.terms_version ?? null;
  const visible = me !== undefined && !me.terms_accepted && version !== null;
  const updated = me?.terms_accepted_at !== null && me?.terms_accepted_at !== undefined;

  const accept = useMutation({
    mutationFn: () => api.acceptTerms(version ?? ''),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['me'], fresh);
      setChecked(false);
    },
    onError: (exception) => setError(exception instanceof ApiError ? exception.firstError() : 'fatal: dev-null.sh could not record your acceptance. Try again.'),
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => undefined}>
      <ScrollView style={{ backgroundColor: theme.shell }} contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.gutterWide, paddingBottom: insets.bottom + Space.gutterWide }]}>
        <View style={styles.heading}>
          <Text variant="title">{updated ? 'The terms changed' : 'Before you continue'}</Text>
          <Text muted>
            {updated
              ? 'dev-null.sh updated its Terms of Service and Privacy Policy. Have a look, then accept them to keep using the app.'
              : 'dev-null.sh has Terms of Service and a Privacy Policy. Have a look, then accept them to use the app.'}
          </Text>
        </View>

        <TermsConsent checked={checked} onChange={setChecked} accent={accent} />

        {error && <Text variant="mono" muted>{error}</Text>}

        <Button title="Accept and continue" size="lg" disabled={!checked} busy={accept.isPending} onPress={() => { setError(null); accept.mutate(); }} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Space.gutterWide, gap: 24 },
  heading: { gap: 8 },
});
