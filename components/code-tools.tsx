import * as Clipboard from 'expo-clipboard';
import { Check, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Radius, Space, useTheme } from '@/constants/theme';
import { fence, fenceChunk, guessLanguage, insertedChunk, Languages, looksLikeCode } from '@/lib/code-paste';
import { toast } from '@/lib/toast';

type Chunk = { start: number; text: string };

/**
 * Code the composer notices and offers to fence. A paste that reads as code
 * raises a strip above the keyboard with the language guessed; the clipboard
 * button fences whatever is on the clipboard at the caret. Both go through
 * the language sheet when the guess is wrong.
 */
export function useCodePaste(body: string, caret: number, apply: (text: string, caret: number) => void) {
  const previous = useRef(body);
  const [chunk, setChunk] = useState<Chunk | null>(null);
  const [language, setLanguage] = useState('');
  const [choosing, setChoosing] = useState<'chunk' | 'clipboard' | null>(null);
  const [clipboard, setClipboard] = useState('');

  useEffect(() => {
    const before = previous.current;
    previous.current = body;

    if (body === before) {
      return;
    }

    const inserted = insertedChunk(before, body);

    // Noticed only on a paste, never while typing; dismissed as soon as the text moves on.
    setChunk(inserted && looksLikeCode(inserted.text) && !/^```/m.test(inserted.text) ? inserted : null);

    if (inserted) {
      setLanguage(guessLanguage(inserted.text));
    }
  }, [body]);

  const wrap = useCallback(
    (chosen = language) => {
      if (!chunk) {
        return;
      }

      const next = fenceChunk(body, chunk, chosen);
      setChunk(null);
      setChoosing(null);
      apply(next.text, next.caret);
    },
    [body, chunk, language, apply],
  );

  const dismiss = useCallback(() => {
    setChunk(null);
    setChoosing(null);
  }, []);

  const fromClipboard = useCallback(async () => {
    let text = '';

    try {
      text = (await Clipboard.getStringAsync()).replace(/\r\n/g, '\n');
    } catch {
      text = '';
    }

    if (text.trim() === '') {
      toast('Nothing on the clipboard.');

      return;
    }

    setClipboard(text);
    setLanguage(guessLanguage(text));
    setChoosing('clipboard');
  }, []);

  const insertClipboard = useCallback(
    (chosen: string) => {
      const at = Math.min(Math.max(caret, 0), body.length);
      const before = body.slice(0, at);
      const after = body.slice(at);
      const fenced = fence(clipboard, chosen);
      const lead = before === '' || before.endsWith('\n') ? '' : '\n';
      const tail = after === '' || after.startsWith('\n') ? '' : '\n';
      const text = `${before}${lead}${fenced}${tail}${after}`;

      setChoosing(null);
      apply(text, before.length + lead.length + fenced.length + tail.length);
    },
    [body, caret, clipboard, apply],
  );

  const pick = useCallback(
    (chosen: string) => {
      setLanguage(chosen);

      if (choosing === 'clipboard') {
        insertClipboard(chosen);
      } else {
        wrap(chosen);
      }
    },
    [choosing, insertClipboard, wrap],
  );

  return { chunk, language, choosing, wrap, dismiss, fromClipboard, chooseLanguage: () => setChoosing('chunk'), pick, closeSheet: () => setChoosing(null) };
}

export type CodePaste = ReturnType<typeof useCodePaste>;

/** The strip a pasted snippet raises: wrap it, pick its language, or leave it. */
export function CodeSuggestion({ paste }: { paste: CodePaste }) {
  const theme = useTheme();

  if (!paste.chunk) {
    return null;
  }

  const label = Languages.find((candidate) => candidate.id === paste.language)?.label ?? 'Plain text';
  const lines = paste.chunk.text.split('\n').length;

  return (
    <View style={[styles.strip, { borderTopColor: theme.hairline, backgroundColor: theme.surface }]} accessibilityRole="toolbar" accessibilityLabel="Pasted code">
      <Text variant="small" muted numberOfLines={1} style={styles.shrink}>
        Pasted {lines === 1 ? 'a line' : `${lines} lines`} of code?
      </Text>
      <Pressable onPress={paste.chooseLanguage} style={[styles.pill, { borderColor: theme.hairline, backgroundColor: theme.wash }]} accessibilityRole="button" accessibilityLabel={`Language: ${label}`} hitSlop={6}>
        <Text variant="mono" style={styles.pillText}>{label}</Text>
      </Pressable>
      <Pressable onPress={() => paste.wrap()} style={[styles.pill, { borderColor: theme.primary, backgroundColor: theme.primarySoft }]} accessibilityRole="button" accessibilityLabel="Wrap in a code block" hitSlop={6}>
        <Check size={14} color={theme.primary} strokeWidth={2.5} />
        <Text variant="mono" color={theme.primary} style={styles.pillText}>Wrap</Text>
      </Pressable>
      <Pressable onPress={paste.dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Leave as text">
        <X size={16} color={theme.inkMuted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/** The languages a fence can name, as a sheet; the one in use is ticked. */
export function LanguageSheet({ paste }: { paste: CodePaste }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={paste.choosing !== null} transparent animationType="fade" onRequestClose={paste.closeSheet} statusBarTranslucent>
      <Pressable onPress={paste.closeSheet} style={styles.backdrop} accessibilityRole="button" accessibilityLabel="Close">
        <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.hairline, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text variant="section" style={styles.sheetTitle}>{paste.choosing === 'clipboard' ? 'Paste the clipboard as' : 'Wrap as'}</Text>
          <ScrollView style={styles.languages} keyboardShouldPersistTaps="handled">
            {Languages.map((language) => (
              <Pressable key={language.id || 'plain'} onPress={() => paste.pick(language.id)} style={({ pressed }) => [styles.language, pressed && { backgroundColor: theme.wash }]} accessibilityRole="button" accessibilityState={{ selected: language.id === paste.language }}>
                <Text style={styles.shrink}>{language.label}</Text>
                {language.id !== '' && <Text variant="mono" muted>```{language.id}</Text>}
                {language.id === paste.language && <Check size={16} color={theme.primary} strokeWidth={2.5} />}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Space.gutter, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  shrink: { flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: Radius.full, borderWidth: 1 },
  pillText: { fontSize: 12, lineHeight: 16 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingTop: 12, maxHeight: '70%' },
  sheetTitle: { paddingHorizontal: 20, paddingBottom: 8 },
  languages: { flexGrow: 0 },
  language: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
});
