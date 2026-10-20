import { Text as NativeText, type TextProps as NativeTextProps, type TextStyle } from 'react-native';

import { Fonts, useTheme } from '@/constants/theme';

export type Variant = 'body' | 'name' | 'small' | 'nav' | 'mono' | 'monoMedium' | 'title' | 'section' | 'composer' | 'label';

const variants: Record<Variant, TextStyle> = {
  body: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 24 },
  name: { fontFamily: Fonts.sansSemiBold, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },
  nav: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: Fonts.sansSemiBold, fontSize: 14, lineHeight: 20 },
  mono: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  monoMedium: { fontFamily: Fonts.monoMedium, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  title: { fontFamily: Fonts.sansSemiBold, fontSize: 24, lineHeight: 32, letterSpacing: -0.6 },
  section: { fontFamily: Fonts.sansSemiBold, fontSize: 18, lineHeight: 28, letterSpacing: -0.45 },
  composer: { fontFamily: Fonts.sans, fontSize: 17, lineHeight: 23 },
};

export type TextProps = NativeTextProps & {
  variant?: Variant;
  muted?: boolean;
  color?: string;
};

export function Text({ variant = 'body', muted = false, color, style, ...props }: TextProps) {
  const theme = useTheme();

  return <NativeText {...props} style={[variants[variant], { color: color ?? (muted ? theme.inkMuted : theme.ink) }, style]} />;
}
