import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Space, useTheme } from '@/constants/theme';
import { compact, count } from '@/lib/display';
import type { Activity } from '@/lib/types';

const Windows: Record<Activity['scale'], string> = {
  day: 'in the last 24 hours',
  week: 'in the last 7 days',
  month: 'in the last 30 days',
  year: 'in the last year',
};

const Opacity = [0, 0.32, 0.56, 0.8, 1];
const Days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const Months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Cell = { count: number; level: number; label: string | null };

export function ActivityGraph({ activity, lane }: { activity: Activity; lane: string }) {
  const theme = useTheme();
  const cells = cellsOf(activity);
  const total = activity.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const empty = total === 0 && activity.scale !== 'year';
  const gap = activity.scale === 'year' ? 2 : 3;
  const groups = labelGroups(cells);

  return (
    <View style={[styles.wrap, { borderBottomColor: theme.hairline }]} accessibilityLabel={empty ? 'No commits yet' : `${count(total, 'commit', 'commits')} ${Windows[activity.scale]}`}>
      <View style={styles.head}>
        <Text variant="label">Commit activity</Text>
        {empty ? (
          <Text variant="small" muted>No commits yet</Text>
        ) : (
          <Text variant="small" muted>
            <Text variant="monoMedium">{compact(total)}</Text> {total === 1 ? 'commit' : 'commits'} {Windows[activity.scale]}
          </Text>
        )}
      </View>

      <View style={{ gap: 6 }}>
        <View style={[styles.strip, { gap }]}>
          {cells.map((cell, index) => (
            <View key={index} style={[styles.cell, { backgroundColor: cell.level === 0 ? theme.wash : theme.surface }]}>
              {cell.level > 0 && <View style={[styles.fill, { backgroundColor: lane, opacity: Opacity[cell.level] ?? 1 }]} />}
            </View>
          ))}
        </View>
        <View style={[styles.labels, { gap }]}>
          {groups.map((group, index) => (
            <View key={index} style={{ flexGrow: group.span, flexBasis: 0 }}>
              {group.label ? (
                <Text variant={activity.scale === 'day' ? 'mono' : 'small'} muted numberOfLines={1} style={styles.label}>
                  {group.label}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        <Text variant="small" muted style={styles.legendText}>Less</Text>
        {Opacity.map((opacity, level) => (
          <View key={level} style={[styles.swatch, { backgroundColor: level === 0 ? theme.wash : theme.surface }]}>
            {level > 0 && <View style={[styles.fill, { backgroundColor: lane, opacity }]} />}
          </View>
        ))}
        <Text variant="small" muted style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

function cellsOf(activity: Activity): Cell[] {
  const periods = activity.scale === 'year' ? weeksOf(activity.buckets) : activity.buckets;
  const max = Math.max(1, ...periods.map((period) => period.count));

  return periods.map((period, index) => ({
    count: period.count,
    level: period.count === 0 ? 0 : Math.max(1, Math.ceil((period.count / max) * 4)),
    label: labelOf(activity.scale, periods, index),
  }));
}

function weeksOf(buckets: { date: string; count: number }[]): { date: string; count: number }[] {
  const weeks: { date: string; count: number }[] = [];

  for (const bucket of buckets) {
    const date = new Date(bucket.date);
    const last = weeks[weeks.length - 1];

    if (last === undefined || (date.getUTCDay() === 0 && last.date !== bucket.date)) {
      weeks.push({ date: bucket.date, count: bucket.count });
    } else {
      last.count += bucket.count;
    }
  }

  return weeks;
}

function labelOf(scale: Activity['scale'], periods: { date: string; count: number }[], index: number): string | null {
  const date = new Date(periods[index].date);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const length = periods.length;

  switch (scale) {
    case 'day':
      return date.getHours() % 6 === 0 && index < length - 2 ? `${String(date.getHours()).padStart(2, '0')}:00` : null;
    case 'week':
      return `${Days[date.getUTCDay()]} ${date.getUTCDate()}`;
    case 'month':
      return date.getUTCDay() === 1 && index < length - 3 ? `${Months[date.getUTCMonth()]} ${date.getUTCDate()}` : null;
    default: {
      const previous = index > 0 ? new Date(periods[index - 1].date).getUTCMonth() : null;

      return previous !== date.getUTCMonth() && index < length - 2 ? Months[date.getUTCMonth()] : null;
    }
  }
}

function labelGroups(cells: Cell[]): { label: string | null; span: number }[] {
  const groups: { label: string | null; span: number }[] = [];

  for (const cell of cells) {
    if (cell.label !== null || groups.length === 0) {
      groups.push({ label: cell.label, span: 0 });
    }

    groups[groups.length - 1].span++;
  }

  return groups;
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Space.gutter, paddingVertical: 20, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  strip: { flexDirection: 'row', height: 40 },
  cell: { flex: 1, height: '100%', borderRadius: 2, overflow: 'hidden' },
  fill: { width: '100%', height: '100%', borderRadius: 2 },
  labels: { flexDirection: 'row' },
  label: { fontSize: 11, lineHeight: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  legendText: { fontSize: 12, lineHeight: 16, marginHorizontal: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2, overflow: 'hidden' },
});
