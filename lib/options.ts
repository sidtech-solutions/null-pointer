import { useSyncExternalStore } from 'react';
import { ActionSheetIOS, Platform } from 'react-native';

export type Option = { label: string; destructive?: boolean; run: () => void };

export type OptionsRequest = { id: number; title: string; message?: string; options: Option[] };

let current: OptionsRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/**
 * A menu of choices under a title: the system sheet on iOS, and a bottom sheet of
 * our own on Android, where Alert stops at three buttons.
 */
export function showOptions(title: string, options: Option[], message?: string): void {
  if (options.length === 0) {
    return;
  }

  if (Platform.OS === 'ios') {
    const labels = [...options.map((option) => option.label), 'Cancel'];
    const destructive = options.findIndex((option) => option.destructive);

    ActionSheetIOS.showActionSheetWithOptions({ title, message, options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: destructive >= 0 ? destructive : undefined }, (index) => options[index]?.run());

    return;
  }

  current = { id: Date.now(), title, message, options };
  emit();
}

export function closeOptions(): void {
  current = null;
  emit();
}

export function useOptions(): OptionsRequest | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}
