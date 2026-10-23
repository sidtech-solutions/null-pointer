import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Search, SquarePen } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import { Header } from '@/components/header';
import { LogPage, type LogName, type LogPageHandle } from '@/components/log-page';
import { laneColor, useTheme } from '@/constants/theme';
import { useAccount } from '@/lib/account';

const Logs: { key: LogName; label: string }[] = [
  { key: 'following', label: 'Following' },
  { key: 'latest', label: 'Latest' },
  { key: 'trending', label: 'Trending' },
];

export default function LogScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation<{ addListener(event: 'tabPress', listener: () => void): () => void; isFocused(): boolean }>();
  const account = useAccount();
  const pager = useRef<PagerView>(null);
  const pages = useRef<Record<LogName, LogPageHandle | null>>({ following: null, latest: null, trending: null });
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);

      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        pages.current[Logs[index].key]?.scrollToTop();
      }
    });
  }, [navigation, index]);

  const accent = account.user ? laneColor(theme, account.user.lane) : theme.primary;

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface }]}>
      <Header
        title="Log"
        tabs={Logs}
        active={Logs[index].key}
        onChange={(key) => pager.current?.setPage(Logs.findIndex((log) => log.key === key))}
        accent={accent}
        right={
          <View style={styles.actions}>
            <Pressable onPress={() => router.push('/search')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Find a developer">
              <Search size={22} color={theme.ink} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={() => router.push('/compose')} hitSlop={8} accessibilityRole="button" accessibilityLabel="New commit">
              <SquarePen size={22} color={theme.ink} strokeWidth={2} />
            </Pressable>
          </View>
        }
      />

      <PagerView ref={pager} style={styles.pager} initialPage={0} onPageSelected={(event) => setIndex(event.nativeEvent.position)}>
        {Logs.map((log, position) => (
          <View key={log.key} style={styles.page}>
            <LogPage
              ref={(handle) => {
                pages.current[log.key] = handle;
              }}
              log={log.key}
              active={focused && position === index}
              onTrending={() => pager.current?.setPage(2)}
            />
          </View>
        ))}
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  pager: { flex: 1 },
  page: { flex: 1 },
});
