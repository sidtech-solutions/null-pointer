import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// iOS announces the keyboard before it moves, so a bar above it can drop its
// home-indicator padding in the same frame KeyboardAvoidingView starts to
// slide. Android only has the "did" events, which coincide with the resize.
const ShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/** Whether the software keyboard is up, so a bar above it can drop its home-indicator padding. */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    const show = Keyboard.addListener(ShowEvent, () => setShown(true));
    const hide = Keyboard.addListener(HideEvent, () => setShown(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return shown;
}
