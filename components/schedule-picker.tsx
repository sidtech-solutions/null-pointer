import { X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { dayName, firstSlot, MaxScheduleDays, MinuteStep, scheduleLabel, scheduleProblem } from '@/lib/schedule';

/** A narrow chip plus the gap after it, so a row can start scrolled to the picked one. */
const ChipStep = 50;

/**
 * When a commit should go: a day in the next thirty, an hour and a five-minute
 * mark, as the web's picker offers them, without a native date picker.
 */
export function SchedulePicker({ visible, value, onPick, onClear, onClose }: { visible: boolean; value: Date | null; onPick: (date: Date) => void; onClear?: () => void; onClose: () => void }) {
  const theme = useTheme();
  const now = useMemo(() => new Date(), [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<Date>(() => value ?? firstSlot(now));

  // Opened again later, the sheet starts from the current pick or the next slot, not whatever it last showed.
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPicked(value ?? firstSlot(new Date()));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => Array.from({ length: MaxScheduleDays + 1 }, (_, offset) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)), [now]);
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const minutes = Array.from({ length: 60 / MinuteStep }, (_, index) => index * MinuteStep);
  const problem = scheduleProblem(picked, now);

  const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  const change = (day: Date = picked, hour: number = picked.getHours(), minute: number = picked.getMinutes()) => setPicked(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute));

  return (
    <Sheet visible={visible} onClose={onClose} style={styles.sheet}>
          <View style={styles.head}>
            <Text variant="section" style={styles.grow}>Schedule</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={theme.inkMuted} strokeWidth={2} />
            </Pressable>
          </View>

          <Text variant="mono" muted style={styles.label}>day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {days.map((day) => {
              const selected = sameDay(day, picked);

              return (
                <Pressable key={day.toDateString()} onPress={() => change(day)} style={[styles.chip, { borderColor: selected ? theme.primary : theme.hairline, backgroundColor: selected ? theme.primarySoft : 'transparent' }]} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                  <Text variant="small" color={selected ? theme.primary : theme.ink}>{dayName(day, now)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text variant="mono" muted style={styles.label}>hour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled" contentOffset={{ x: Math.max(0, (picked.getHours() - 2) * ChipStep), y: 0 }}>
            {hours.map((hour) => {
              const selected = hour === picked.getHours();

              return (
                <Pressable key={hour} onPress={() => change(undefined, hour)} style={[styles.chip, styles.narrow, { borderColor: selected ? theme.primary : theme.hairline, backgroundColor: selected ? theme.primarySoft : 'transparent' }]} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                  <Text variant="mono" color={selected ? theme.primary : theme.ink}>{String(hour).padStart(2, '0')}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text variant="mono" muted style={styles.label}>minute</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled" contentOffset={{ x: Math.max(0, (picked.getMinutes() / MinuteStep - 2) * ChipStep), y: 0 }}>
            {minutes.map((minute) => {
              const selected = minute === picked.getMinutes();

              return (
                <Pressable key={minute} onPress={() => change(undefined, undefined, minute)} style={[styles.chip, styles.narrow, { borderColor: selected ? theme.primary : theme.hairline, backgroundColor: selected ? theme.primarySoft : 'transparent' }]} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                  <Text variant="mono" color={selected ? theme.primary : theme.ink}>{String(minute).padStart(2, '0')}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.summary}>
            <Text variant="small" color={problem ? theme.destructive : theme.inkMuted}>{problem ?? `Commits ${scheduleLabel(picked, now)}, in your time zone.`}</Text>
          </View>

          <View style={styles.actions}>
            {value && onClear && (
              <Button
                title="Don't schedule"
                variant="outline"
                onPress={() => {
                  onClear();
                  onClose();
                }}
              />
            )}
            <Button
              title={value ? 'Change' : 'Schedule'}
              disabled={problem !== null}
              onPress={() => {
                onPick(picked);
                onClose();
              }}
              style={styles.grow}
            />
          </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingTop: 16, paddingHorizontal: Space.gutter, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  grow: { flex: 1 },
  label: { fontSize: 11, lineHeight: 14, marginTop: 6 },
  chips: { gap: 6, paddingVertical: 2 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  narrow: { minWidth: 44, paddingHorizontal: 8 },
  summary: { minHeight: 24, justifyContent: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
