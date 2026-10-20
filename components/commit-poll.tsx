import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, useTheme } from '@/constants/theme';
import type { Poll } from '@/lib/types';

// Read-only: the API has no vote endpoint yet.
export function CommitPoll({ poll }: { poll: Poll }) {
  const theme = useTheme();
  const total = poll.votes_count ?? poll.options.reduce((sum, option) => sum + (option.votes_count ?? 0), 0);
  const showsResults = poll.has_voted || poll.is_closed || poll.options.some((option) => typeof option.percentage === 'number');

  return (
    <View style={styles.poll} accessibilityLabel={showsResults ? 'Poll results' : 'Poll options'}>
      {poll.options.map((option) => {
        const share = typeof option.percentage === 'number' ? option.percentage : total > 0 ? Math.round(((option.votes_count ?? 0) / total) * 100) : 0;

        return (
          <View key={option.id} style={[styles.option, { borderColor: theme.hairline }]}>
            {showsResults && share > 0 && <View style={[styles.bar, { width: `${share}%`, backgroundColor: option.voted ? theme.primarySoft : theme.wash }]} />}
            <View style={styles.label}>
              <Text variant={option.voted ? 'name' : 'body'} style={styles.labelText} numberOfLines={2}>{option.label}</Text>
              {option.voted && <Check size={16} color={theme.primary} strokeWidth={2} />}
              <View style={styles.spacer} />
              {showsResults && <Text variant="mono">{share}%</Text>}
            </View>
          </View>
        );
      })}
      <Text variant="mono" muted>
        {total} {total === 1 ? 'vote' : 'votes'}
        {poll.is_closed ? ' · closed' : poll.closes_at ? ` · ${timeLeft(poll.closes_at)}` : ''}
      </Text>
    </View>
  );
}

function timeLeft(iso: string): string {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000);

  if (Number.isNaN(seconds) || seconds <= 0) {
    return 'closed';
  }

  if (seconds < 3600) {
    return `${Math.max(1, Math.floor(seconds / 60))}m left`;
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h left`;
  }

  return `${Math.floor(seconds / 86400)}d left`;
}

const styles = StyleSheet.create({
  poll: { gap: 8, marginTop: 8 },
  option: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  bar: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: Radius.md },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  labelText: { flexShrink: 1 },
  spacer: { flex: 1 },
});
