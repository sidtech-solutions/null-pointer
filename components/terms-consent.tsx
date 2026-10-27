import { Square, SquareCheck } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/constants/theme';
import { baseUrl } from '@/lib/client';
import { openLink } from '@/lib/links';

export const termsUrl = () => `${baseUrl()}/terms`;
export const privacyUrl = () => `${baseUrl()}/privacy`;

/** "the Terms of Service and Privacy Policy", each a link to the live page on dev-null.sh, inside a sentence. */
export function LegalLinks() {
  const theme = useTheme();

  return (
    <>
      the{' '}
      <Text variant="small" color={theme.primary} onPress={() => openLink(termsUrl())} accessibilityRole="link" suppressHighlighting>
        Terms of Service
      </Text>{' '}
      and{' '}
      <Text variant="small" color={theme.primary} onPress={() => openLink(privacyUrl())} accessibilityRole="link" suppressHighlighting>
        Privacy Policy
      </Text>
    </>
  );
}

/** A checkbox the person has to tick before signing in or carrying on: App Review wants an explicit acceptance. */
export function TermsConsent({ checked, onChange, accent }: { checked: boolean; onChange: (checked: boolean) => void; accent?: string }) {
  const theme = useTheme();
  const Icon = checked ? SquareCheck : Square;

  return (
    <Pressable onPress={() => onChange(!checked)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel="I accept the Terms of Service and Privacy Policy" hitSlop={8}>
      <Icon size={22} color={checked ? (accent ?? theme.primary) : theme.inkMuted} strokeWidth={2} />
      <Text variant="small" style={styles.label}>
        I accept <LegalLinks />. No tolerance for abusive content: reports are acted on within 24 hours.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  label: { flex: 1 },
});
