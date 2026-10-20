import { memo } from 'react';

import { Text, type TextProps } from '@/components/text';
import { relativeTime } from '@/lib/display';
import { useNow } from '@/lib/now';

// Subscribes to the clock itself so a tick re-renders only this text, not the row.
export const RelativeTime = memo(function RelativeTime({ iso, ...props }: Omit<TextProps, 'children'> & { iso: string | null | undefined }) {
  const now = useNow();

  return (
    <Text variant="mono" muted {...props}>
      {relativeTime(iso, now)}
    </Text>
  );
});
