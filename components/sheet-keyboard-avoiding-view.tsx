import { useState } from 'react';
import { KeyboardAvoidingView, type KeyboardAvoidingViewProps, Platform, useWindowDimensions } from 'react-native';

export function SheetKeyboardAvoidingView({ onLayout, keyboardVerticalOffset = 0, ...props }: KeyboardAvoidingViewProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [height, setHeight] = useState<number | null>(null);
  const sheetOffset = Platform.OS === 'ios' && height !== null ? Math.max(0, windowHeight - height) : 0;

  return (
    <KeyboardAvoidingView
      {...props}
      keyboardVerticalOffset={keyboardVerticalOffset + sheetOffset}
      onLayout={(event) => {
        setHeight(event.nativeEvent.layout.height);
        onLayout?.(event);
      }}
    />
  );
}
