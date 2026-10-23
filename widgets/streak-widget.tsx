// The widget library calls these as plain functions outside React's renderer, so the React Compiler must leave them alone.
'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { dark as darkTokens, laneColor, light as lightTokens, type Tokens } from '@/constants/theme';
import type { WidgetData } from '@/lib/widget-data';

const Sans = 'Geist-SemiBold';
const Mono = 'GeistMono-Regular';
const Alpha = ['00', '52', '8f', 'cc', 'ff'];

/** How much the widget shows grows with the height the launcher gives it, in dp. */
const MediumFrom = 150;
const TallFrom = 230;
const NarrowBelow = 300;

function hex(color: string): `#${string}` {
  return (color.startsWith('#') ? color : '#000000') as `#${string}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The home screen widget. At two cells tall: the streak, the last seven days
 * in the lane colour, and what is waiting. Taller, it adds the Unix rank with
 * its progress and the profile counts, then the newest commits from the
 * people you follow, each opening its commit. Drawn twice, for light and dark
 * wallpapers.
 */
export function StreakWidget({ data, dark, height = 0, width = 320 }: { data: WidgetData | null; dark: boolean; height?: number; width?: number }) {
  const theme: Tokens = dark ? darkTokens : lightTokens;
  const lane = hex(data ? laneColor(theme, data.lane) : theme.primary);
  const surface = hex(theme.surface);
  const ink = hex(theme.ink);
  const muted = hex(theme.inkMuted);
  const wash = hex(theme.wash);
  const hairline = hex(theme.hairline);

  if (!data) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', height: 'match_parent', backgroundColor: surface, borderRadius: 24, padding: 16, justifyContent: 'center', alignItems: 'center' }}>
        <TextWidget text="/dev/null" style={{ fontFamily: Sans, fontSize: 18, color: ink }} />
        <TextWidget text="Sign in to null-pointer to see your streak." style={{ fontFamily: Mono, fontSize: 11, color: muted, marginTop: 4 }} />
      </FlexWidget>
    );
  }

  // Narrow (three cells or fewer), the days go under the streak and the footer keeps only what is waiting.
  const narrow = width < NarrowBelow;
  const cell = narrow ? 14 : 16;
  const medium = height >= MediumFrom;
  const tall = height >= TallFrom + (narrow ? 60 : 0);
  // A narrow widget has less height to spare below the stacked header, so it lists two commits instead of three.
  const latest = narrow ? data.latest.slice(0, 2) : data.latest;
  const waiting = [
    data.notifications > 0 ? `${data.notifications} new` : null,
    data.remotes > 0 ? plural(data.remotes, 'push', 'pushes') : null,
    data.pasteisLeft !== null && data.pasteisLeft > 0 ? `${data.pasteisLeft} pastéis left` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', height: 'match_parent', backgroundColor: surface, borderRadius: 24, padding: 16, flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
        <FlexWidget style={{ width: 'match_parent', flexDirection: narrow ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <FlexWidget style={{ flexDirection: 'column' }}>
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <TextWidget text={String(data.current)} style={{ fontFamily: Sans, fontSize: 36, color: lane, lineHeight: 38 }} />
              <TextWidget text=" day streak" style={{ fontFamily: Mono, fontSize: 12, color: muted, marginBottom: 6, marginLeft: 4 }} />
            </FlexWidget>
            <TextWidget text={narrow ? `longest ${data.longest} · ${data.total} this week` : `longest ${data.longest} · ${plural(data.total, 'commit', 'commits')} this week`} style={{ fontFamily: Mono, fontSize: 11, color: muted, marginTop: 2 }} />
          </FlexWidget>

          <FlexWidget style={{ flexDirection: 'column', alignItems: narrow ? 'flex-start' : 'flex-end', marginTop: narrow ? 8 : 0 }}>
            <FlexWidget style={{ flexDirection: 'row', flexGap: 3 }}>
              {data.days.map((day, index) => (
                <FlexWidget key={index} style={{ width: cell, height: cell, borderRadius: 4, backgroundColor: day.level === 0 ? wash : (`${lane}${Alpha[day.level] ?? 'ff'}` as `#${string}`) }} />
              ))}
            </FlexWidget>
            <FlexWidget style={{ flexDirection: 'row', flexGap: 3, marginTop: 3 }}>
              {data.days.map((day, index) => (
                <FlexWidget key={index} style={{ width: cell, alignItems: 'center' }}>
                  <TextWidget text={day.weekday} style={{ fontFamily: Mono, fontSize: 9, color: muted }} />
                </FlexWidget>
              ))}
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        {medium && (
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 12 }}>
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TextWidget text={data.rank ? `Lv. ${data.level} · ${data.rank}` : `Lv. ${data.level}`} style={{ fontFamily: Mono, fontSize: 11, color: lane }} />
              <TextWidget text={data.badgesTotal > 0 ? `${data.badges} / ${data.badgesTotal} badges` : ''} style={{ fontFamily: Mono, fontSize: 11, color: muted }} />
            </FlexWidget>
            <FlexWidget style={{ width: 'match_parent', height: 5, borderRadius: 3, backgroundColor: wash, marginTop: 6, flexDirection: 'row' }}>
              <FlexWidget style={{ width: Math.max(4, Math.round((width - 32) * (data.progress ?? 1))), height: 5, borderRadius: 3, backgroundColor: lane }} />
            </FlexWidget>
            <TextWidget text={narrow ? `${data.commits} commits · ${data.following} following · ${data.followers} followers` : `${plural(data.commits, 'commit', 'commits')} · ${data.following} following · ${plural(data.followers, 'follower', 'followers')}`} style={{ fontFamily: Mono, fontSize: narrow ? 10 : 11, color: muted, marginTop: 6 }} truncate="END" maxLines={1} />
          </FlexWidget>
        )}

        {tall && latest.length > 0 && (
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 12, borderTopWidth: 1, borderTopColor: hairline, paddingTop: 8 }}>
            <TextWidget text="$ git log --following" style={{ fontFamily: Mono, fontSize: 10, color: muted, marginBottom: 4 }} />
            {latest.map((commit) => (
              <FlexWidget key={commit.id} clickAction="OPEN_URI" clickActionData={{ uri: `devnull://commits/${commit.id}` }} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                <TextWidget text={`@${commit.username}`} style={{ fontFamily: Mono, fontSize: 11, color: ink }} truncate="END" maxLines={1} />
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget text={`  ${commit.line}`} style={{ fontFamily: Mono, fontSize: 11, color: muted }} truncate="END" maxLines={1} />
                </FlexWidget>
                {!narrow && <TextWidget text={`  ${commit.ago}`} style={{ fontFamily: Mono, fontSize: 10, color: muted }} />}
              </FlexWidget>
            ))}
          </FlexWidget>
        )}
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={waiting || 'all caught up'} style={{ fontFamily: Mono, fontSize: 11, color: waiting ? ink : muted }} truncate="END" maxLines={1} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
          {!narrow && <TextWidget text={`@${data.username} · `} style={{ fontFamily: Mono, fontSize: 11, color: muted }} />}
          <TextWidget text="/dev" style={{ fontFamily: Sans, fontSize: 12, color: ink }} />
          <TextWidget text="/" style={{ fontFamily: Sans, fontSize: 12, color: hex(theme.lanes[0]) }} />
          <TextWidget text="null" style={{ fontFamily: Sans, fontSize: 12, color: ink }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
