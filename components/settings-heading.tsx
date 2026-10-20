import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';

export function SettingsHeading({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.heading}>
      <Text variant="section">{title}</Text>
      {description ? <Text variant="small" muted>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4 },
});
