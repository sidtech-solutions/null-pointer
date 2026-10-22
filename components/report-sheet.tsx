import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { Fonts, laneColor, Radius, Space, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';
import { api, ApiError } from '@/lib/client';
import type { Commit } from '@/lib/types';

export const Reasons = [
  { value: 'spam', label: 'Spam or misleading links' },
  { value: 'harassment', label: 'Harassment or hate' },
  { value: 'unsafe', label: 'Harmful or private information' },
  { value: 'other', label: 'Something else' },
];

const DetailsMaxLength = 500;

export function ReportSheet({ commit, onClose }: { commit: Commit | null; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const accent = account.user ? laneColor(theme, account.user.lane) : theme.primary;

  const send = useMutation({
    mutationFn: () => api.reportCommit(commit!.id, reason, details.trim()),
    onError: (exception) => setError(exception instanceof ApiError ? exception.firstError() : 'fatal: could not send the report.'),
  });

  const close = () => {
    setReason('');
    setDetails('');
    setError(null);
    send.reset();
    onClose();
  };

  return (
    <Modal visible={commit !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom }]}>
        {send.isSuccess ? (
          <View style={styles.received}>
            <View style={styles.receivedRow}>
              <Check size={20} color={theme.primary} strokeWidth={2} />
              <Text style={styles.shrink}>Report received. Moderators will review it privately.</Text>
            </View>
            <Button title="Done" variant="outline" size="lg" onPress={close} />
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <View style={styles.heading}>
              <Text variant="section">Report commit</Text>
              <Text variant="small" muted>Your report is private. Only moderators can review it. Reporting does not hide this commit.</Text>
            </View>

            <View style={[styles.excerpt, { borderColor: theme.hairline }]}>
              <Text variant="small" numberOfLines={3}>{commit?.body}</Text>
            </View>

            <View style={styles.reasons}>
              <Text variant="name">Why are you reporting this commit?</Text>
              {Reasons.map((option) => (
                <Pressable key={option.value} onPress={() => setReason(option.value)} style={styles.reason} accessibilityRole="radio" accessibilityState={{ checked: reason === option.value }}>
                  <View style={[styles.radio, { borderColor: reason === option.value ? accent : theme.rail }]}>{reason === option.value && <View style={[styles.radioDot, { backgroundColor: accent }]} />}</View>
                  <Text>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.details}>
              <Text variant="small" muted>Details (optional)</Text>
              <TextInput
                value={details}
                onChangeText={setDetails}
                multiline
                maxLength={DetailsMaxLength}
                placeholder={`Add context for moderators. Up to ${DetailsMaxLength} characters.`}
                placeholderTextColor={theme.inkMuted}
                style={[styles.input, { color: theme.ink, borderColor: theme.rail }]}
              />
            </View>

            {error && <Text variant="small" color={theme.destructive}>{error}</Text>}

            <Button title="Send report" size="lg" disabled={reason === ''} busy={send.isPending} onPress={() => send.mutate()} style={{ backgroundColor: accent }} />
            <Button title="Cancel" variant="ghost" size="lg" onPress={close} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  form: { padding: Space.gutterWide - 4, paddingTop: 24, gap: 20 },
  heading: { gap: 8 },
  excerpt: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  reasons: { gap: 12 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 20, height: 20, borderRadius: Radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: Radius.full },
  details: { gap: 6 },
  input: { minHeight: 88, borderWidth: 1, borderRadius: Radius.md, padding: 10, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 20, textAlignVertical: 'top' },
  received: { padding: Space.gutterWide - 4, paddingTop: 24, gap: 20 },
  receivedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shrink: { flexShrink: 1 },
});
