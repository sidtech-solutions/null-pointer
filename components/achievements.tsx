import { Award, Box, Check, ChevronRight, FileCode, Flame, GitMerge, Key, Maximize, Server, Shield, Sparkles, Star, Terminal, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import type { Achievements, Badge } from '@/lib/types';

function BadgeIcon({ icon, color, size = 14 }: { icon?: string; color: string; size?: number }) {
  const props = { size, color, strokeWidth: 2 };

  switch (icon) {
    case 'file-code':
      return <FileCode {...props} />;
    case 'flame':
      return <Flame {...props} />;
    case 'zap':
      return <Zap {...props} />;
    case 'server':
      return <Server {...props} />;
    case 'box':
      return <Box {...props} />;
    case 'shield':
      return <Shield {...props} />;
    case 'star':
      return <Star {...props} />;
    case 'sparkles':
      return <Sparkles {...props} />;
    case 'git-merge':
      return <GitMerge {...props} />;
    case 'maximize':
      return <Maximize {...props} />;
    case 'key':
      return <Key {...props} />;
    default:
      return <Terminal {...props} />;
  }
}

function label(achievements: Achievements): string {
  return `Lv. ${achievements.level} · ${achievements.rank}`;
}

function xpLabel(achievements: Achievements): string {
  const xp = achievements.xp ?? 0;

  return achievements.next_level_xp == null ? `${xp} XP` : `${xp} / ${achievements.next_level_xp} XP`;
}

function nextRankLabel(achievements: Achievements): string {
  const next = (achievements.ranks ?? []).find((rank) => rank.level > achievements.level);

  return next ? `${next.min_xp - (achievements.xp ?? 0)} XP to ${next.rank}` : 'Maximum rank (UID 0)';
}

function ProgressBar({ percent, fill, height = 6 }: { percent: number; fill: string; height?: number }) {
  const theme = useTheme();

  return (
    <View style={{ height, borderRadius: Radius.full, backgroundColor: theme.wash, overflow: 'hidden' }} accessibilityLabel={`${percent}% of the way to the next rank`}>
      <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: '100%', backgroundColor: fill, borderRadius: Radius.full }} />
    </View>
  );
}

export function AchievementsShelf({ achievements, lane, handle }: { achievements: Achievements; lane: string; handle: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState<string | null | false>(false);
  const badges = achievements.badges ?? [];
  const unlocked = badges.filter((badge) => badge.unlocked).length;

  return (
    <View style={[styles.shelf, { borderBottomColor: theme.hairline }]} accessibilityLabel="Developer achievements">
      <Pressable onPress={() => setOpen(null)} style={styles.summary} accessibilityRole="button" accessibilityHint="Shows the achievements">
        <View style={styles.row}>
          <Award size={16} color={theme.ink} strokeWidth={2} />
          <Text variant="monoMedium" numberOfLines={1} style={styles.shrink}>{label(achievements)}</Text>
          <Text variant="mono" muted>·</Text>
          <Text variant="mono" muted>{achievements.xp ?? 0} XP</Text>
          <View style={styles.spacer} />
          <Text variant="mono" muted style={styles.tiny}>{unlocked} / {badges.length} unlocked</Text>
          <ChevronRight size={14} color={theme.inkMuted} strokeWidth={2} />
        </View>
        <View style={styles.bar}>
          <View style={styles.row}>
            <Text variant="mono" muted style={styles.tiny11}>{xpLabel(achievements)}</Text>
            <View style={styles.spacer} />
            <Text variant="mono" muted style={styles.tiny11}>{nextRankLabel(achievements)}</Text>
          </View>
          <ProgressBar percent={achievements.level_progress ?? 0} fill={lane} />
        </View>
      </Pressable>

      {badges.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {badges.map((badge) => (
            <Pressable key={badge.id} onPress={() => setOpen(badge.id)} style={[styles.chip, { borderColor: badge.unlocked ? theme.hairline : `${theme.rail}99`, backgroundColor: badge.unlocked ? theme.surface : `${theme.wash}66` }]} accessibilityLabel={`${badge.name}, ${badge.unlocked ? 'unlocked' : `${badge.progress ?? 0} of ${badge.target ?? 1}`}`}>
              <BadgeIcon icon={badge.icon} color={badge.unlocked ? theme.ink : theme.inkMuted} />
              <Text variant="mono" muted={!badge.unlocked} style={styles.tiny}>{badge.name}</Text>
              {!badge.unlocked && (badge.target ?? 1) > 1 && (
                <Text variant="mono" muted style={styles.tiny11}>{badge.progress ?? 0}/{badge.target}</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <AchievementsSheet achievements={achievements} lane={lane} handle={handle} marked={open === false ? null : open} open={open !== false} onClose={() => setOpen(false)} />
    </View>
  );
}

function AchievementsSheet({ achievements, lane, handle, marked, open, onClose }: { achievements: Achievements; lane: string; handle: string; marked: string | null; open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'badges' | 'ranks'>('badges');
  const badges = achievements.badges ?? [];
  const ranks = achievements.ranks ?? [];
  const unlocked = badges.filter((badge) => badge.unlocked).length;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <View style={styles.row}>
            <Text variant="name" style={[styles.shrink, styles.sheetTitle]}>Developer Achievements</Text>
            <View style={styles.spacer} />
            <View style={[styles.rank, { borderColor: `${lane}40`, backgroundColor: `${lane}1a` }]}>
              <Text variant="monoMedium" color={lane} style={styles.tiny}>{label(achievements)}</Text>
            </View>
          </View>
          <Text variant="mono" muted style={styles.tiny}>
            @{handle} · {achievements.xp ?? 0} XP · {unlocked}/{badges.length} badges unlocked
          </Text>

          <View style={[styles.card, { borderColor: theme.hairline, backgroundColor: `${theme.wash}4d` }]}>
            <View style={styles.row}>
              <Text variant="mono" muted style={styles.tiny}>{xpLabel(achievements)}</Text>
              <View style={styles.spacer} />
              <Text variant="mono" muted style={styles.tiny}>{nextRankLabel(achievements)}</Text>
            </View>
            <ProgressBar percent={achievements.level_progress ?? 0} fill={lane} />
          </View>

          <View style={[styles.tabs, { borderBottomColor: theme.hairline }]}>
            {(['badges', 'ranks'] as const).map((key) => (
              <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, { borderBottomColor: tab === key ? lane : 'transparent' }]} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
                <Text variant="monoMedium" muted={tab !== key} style={styles.tiny}>
                  {key === 'badges' ? 'Badges' : 'Unix Ranks'} ({key === 'badges' ? badges.length : ranks.length})
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'badges' ? (
            <View style={styles.list}>
              {badges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} lane={lane} marked={badge.id === marked} />
              ))}
            </View>
          ) : (
            <View style={styles.list}>
              {ranks.map((rank) => {
                const current = rank.level === achievements.level;

                return (
                  <View key={rank.level} style={[styles.rankRow, { borderColor: current ? lane : theme.hairline, borderWidth: current ? 2 : 1 }]}>
                    <View style={styles.row}>
                      <Text variant="monoMedium" color={current ? lane : theme.ink} style={styles.tiny}>Lv. {rank.level} · {rank.rank}</Text>
                      <View style={styles.spacer} />
                      <Text variant="mono" muted style={styles.tiny}>{rank.min_xp} XP</Text>
                      {rank.achieved && <Check size={14} color={theme.primary} strokeWidth={2} />}
                    </View>
                    {rank.description ? <Text variant="small" muted style={styles.tiny}>{rank.description}</Text> : null}
                  </View>
                );
              })}
            </View>
          )}

          <Text variant="mono" muted style={styles.tiny11}>XP = commits × 10 + stars received × 2 + replies × 3</Text>
          <Button title="Done" variant="outline" size="lg" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function BadgeCard({ badge, lane, marked }: { badge: Badge; lane: string; marked: boolean }) {
  const theme = useTheme();
  const target = badge.target ?? 1;
  const progress = badge.progress ?? 0;
  const showsProgress = !badge.unlocked && target > 1;

  return (
    <View style={[styles.badgeCard, { borderColor: marked ? lane : theme.hairline, borderWidth: marked ? 2 : 1, backgroundColor: badge.unlocked ? theme.surface : `${theme.wash}33` }]} accessibilityLabel={`${badge.name}, ${badge.unlocked ? 'unlocked' : `${progress} of ${target}`}. ${badge.description ?? ''}`}>
      <View style={styles.row}>
        <View style={[styles.badgeIcon, { backgroundColor: theme.wash, borderColor: theme.hairline }]}>
          <BadgeIcon icon={badge.icon} color={badge.unlocked ? theme.ink : theme.inkMuted} />
        </View>
        <Text variant="monoMedium" numberOfLines={1} style={[styles.shrink, styles.tiny]}>{badge.name}</Text>
        <View style={styles.spacer} />
        {badge.unlocked ? (
          <View style={[styles.unlocked, { backgroundColor: '#10b9811a' }]}>
            <Check size={12} color="#059669" strokeWidth={2.5} />
          </View>
        ) : (
          <Text variant="monoMedium" muted style={styles.tiny11}>{progress}/{target}</Text>
        )}
      </View>
      {badge.description ? <Text variant="small" muted style={styles.tiny}>{badge.description}</Text> : null}
      {showsProgress && <ProgressBar percent={Math.round((Math.min(progress, target) / target) * 100)} fill={theme.inkMuted} height={4} />}
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { paddingVertical: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  summary: { paddingHorizontal: Space.gutter, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1 },
  spacer: { flex: 1 },
  bar: { gap: 4 },
  tiny: { fontSize: 12, lineHeight: 16 },
  tiny11: { fontSize: 11, lineHeight: 14 },
  chips: { paddingHorizontal: Space.gutter, gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: Radius.full, borderWidth: 1 },
  sheet: { flex: 1 },
  sheetContent: { padding: 20, paddingTop: 24, gap: 16 },
  sheetTitle: { fontSize: 16 },
  rank: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  card: { padding: 12, gap: 8, borderRadius: Radius.lg, borderWidth: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 2 },
  list: { gap: 8 },
  badgeCard: { padding: 12, gap: 6, borderRadius: Radius.lg },
  badgeIcon: { width: 24, height: 24, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  unlocked: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
  rankRow: { padding: 12, gap: 4, borderRadius: Radius.lg },
});
