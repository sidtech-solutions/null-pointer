import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { Radius, Space, useTheme } from '@/constants/theme';
import type { User } from '@/lib/types';

export type RailNode = 'avatar' | 'dot' | 'root' | 'skeleton' | 'tombstone' | null;

export const RailX = Space.rail / 2 - 0.5;

// The segment above the node takes the previous author's lane; the segment below takes this author's.
export function GraphRail({
  lane,
  previousLane,
  node = 'avatar',
  user,
  hasTail = true,
  endsWithDot = false,
  replyTail = false,
  avatarSize = 48,
  onPressNode,
  children,
}: {
  lane: string;
  previousLane?: string;
  node?: RailNode;
  user?: Pick<User, 'name' | 'username' | 'avatar_url'>;
  hasTail?: boolean;
  endsWithDot?: boolean;
  replyTail?: boolean;
  avatarSize?: number;
  onPressNode?: () => void;
  children?: ReactNode;
}) {
  const center = Space.railCenter;
  const left = Space.rail / 2 - 1;
  const endDot = 20;

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: Space.rail }} pointerEvents="box-none">
      {previousLane !== undefined && (
        <View style={{ position: 'absolute', top: 0, left, width: 2, height: node === null ? undefined : center + 1, bottom: node === null ? 0 : undefined, backgroundColor: previousLane }} />
      )}

      {node !== null && hasTail && (
        <View style={{ position: 'absolute', top: center - 1, bottom: endsWithDot ? endDot : 0, left, width: 2, backgroundColor: lane }} />
      )}

      {node !== null && replyTail && (endsWithDot ? <DashedLine lane={lane} x={RailX} bottom={0} height={endDot} /> : <DashedLine lane={lane} x={RailX} top={node === 'dot' ? center - 9 : center} bottom={0} />)}

      {node !== null && hasTail && endsWithDot && (
        <View style={{ position: 'absolute', bottom: endDot - 9, left: Space.rail / 2 - 9 }}>
          <RailDot lane={lane} />
        </View>
      )}

      {children ?? <Node node={node} lane={lane} user={user} avatarSize={avatarSize} onPress={onPressNode} />}
    </View>
  );
}

function Node({ node, lane, user, avatarSize, onPress }: { node: RailNode; lane: string; user?: Pick<User, 'name' | 'username' | 'avatar_url'>; avatarSize: number; onPress?: () => void }) {
  const theme = useTheme();
  const center = Space.railCenter;

  switch (node) {
    case 'avatar': {
      const size = avatarSize;

      return (
        <Pressable onPress={onPress} disabled={!onPress} accessibilityLabel={user ? `${user.name || user.username}'s profile` : undefined} style={{ position: 'absolute', top: center - size / 2, left: Space.rail / 2 - size / 2 }}>
          {user ? <Avatar user={user} lane={lane} size={size - 8} /> : null}
        </Pressable>
      );
    }
    case 'dot':
    case 'root':
      return (
        <Pressable onPress={onPress} disabled={!onPress} style={{ position: 'absolute', top: node === 'dot' ? center - 18 : center - 9, left: Space.rail / 2 - 9 }}>
          <RailDot lane={lane} hollow={node === 'root'} />
        </Pressable>
      );
    case 'tombstone':
      return (
        <View style={{ position: 'absolute', top: center - 24, left: Space.rail / 2 - 24, width: 48, height: 48, borderRadius: Radius.full, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.rail, backgroundColor: theme.surface }} />
      );
    case 'skeleton':
      return (
        <View style={{ position: 'absolute', top: center - 24, left: Space.rail / 2 - 24, width: 48, height: 48, borderRadius: Radius.full, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: Radius.full, backgroundColor: theme.wash }} />
        </View>
      );
    default:
      return null;
  }
}

export function RailDot({ lane, hollow = false }: { lane: string; hollow?: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ width: 18, height: 18, borderRadius: Radius.full, backgroundColor: lane, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 14, height: 14, borderRadius: Radius.full, borderWidth: 3, borderColor: theme.surface, backgroundColor: hollow ? theme.surface : lane }} />
    </View>
  );
}

export function RailSegment({ lane }: { lane: string }) {
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: Space.rail / 2 - 1, width: 2, backgroundColor: lane }} />;
}

export function DashedLine({ lane, x, top, bottom, height }: { lane: string; x: number; top?: number; bottom?: number; height?: number }) {
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', left: x - 1, width: 2, top, bottom, height }}>
      <Line x1={1} y1={0} x2={1} y2="100%" stroke={lane} strokeWidth={1} strokeDasharray="4,3" />
    </Svg>
  );
}

/** Y of the elbow's horizontal run: the middle of the first reply's avatar. */
export const ElbowLevel = 22;

export function ThreadElbow({ lane, from = RailX, to = Space.rail }: { lane: string; from?: number; to?: number }) {
  const width = to - 1 - from;
  const level = ElbowLevel + 0.5;

  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: from - 0.5, width: width + 1, height: level + 1 }}>
      <Path d={`M0.5 0 V${level - 12} Q0.5 ${level} 12.5 ${level} H${width + 1}`} stroke={lane} strokeWidth={1} fill="none" strokeDasharray="4,3" />
    </Svg>
  );
}
