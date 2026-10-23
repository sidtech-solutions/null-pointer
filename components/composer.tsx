import { Image } from 'expo-image';
import { Camera, ChartBar, Eye, FoldVertical, ImagePlus, Plus, X } from 'lucide-react-native';
import { type ReactNode, useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Text } from '@/components/text';
import { Fonts, Radius, useTheme } from '@/constants/theme';
import type { Upload } from '@/lib/client';
import { CountFrom, length, MaxLength } from '@/lib/display';
import { type Attachment, ImageError, MaxDescriptionLength, MaxImages, pickImages, readForUpload, type Source } from '@/lib/images';
import { type NewPoll, PollDurations, PollLimits } from '@/lib/types';

export function BodyCounter({ body }: { body: string }) {
  const theme = useTheme();
  const remaining = MaxLength - length(body);

  if (remaining <= CountFrom) {
    return (
      <Text variant="mono" color={remaining <= 0 ? theme.destructive : remaining <= 20 ? '#b45309' : theme.inkMuted} accessibilityLabel={`${remaining} characters left`}>
        {remaining}
      </Text>
    );
  }

  if (length(body) > 280 || body.split('\n').length > 8) {
    return <FoldVertical size={16} color={theme.inkMuted} strokeWidth={2} />;
  }

  return null;
}

export function ComposerInput({ style, ...props }: TextInputProps) {
  const theme = useTheme();

  return (
    <TextInput
      {...props}
      multiline
      maxLength={MaxLength}
      placeholderTextColor={theme.inkMuted}
      selectionColor={theme.primary}
      style={[styles.input, { color: theme.ink }, style]}
    />
  );
}

export function StashLabel({ onDrop }: { onDrop: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.stash} accessibilityLabel="Restored your unsent draft">
      <Text variant="mono" muted>stash@{'{0}'}</Text>
      <Pressable onPress={onDrop} hitSlop={12}>
        <Text variant="mono" color={theme.inkMuted} style={styles.drop}>drop</Text>
      </Pressable>
    </View>
  );
}

// Images picked for a commit, with the errors picking them produced. Hashing
// happens at send time so a slow photo never blocks the picker.
export function useAttachments() {
  const [images, setImages] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const pick = useCallback(
    async (source: Source) => {
      setError(null);
      setPicking(true);

      try {
        const picked = await pickImages(source, MaxImages - images.length);

        setImages((current) => [...current, ...picked].slice(0, MaxImages));
      } catch (exception) {
        if (exception instanceof ImageError) {
          setError(exception.message);

          if (exception.message.includes('Settings')) {
            Alert.alert('Camera access is off', 'Allow null-pointer to use the camera in Settings to take a photo.', [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]);
          }
        } else {
          setError('fatal: could not read that image.');
        }
      } finally {
        setPicking(false);
      }
    },
    [images.length],
  );

  const remove = useCallback((id: string) => setImages((current) => current.filter((image) => image.id !== id)), []);
  const describe = useCallback((id: string, description: string) => setImages((current) => current.map((image) => (image.id === id ? { ...image, description } : image))), []);
  const clear = useCallback(() => {
    setImages([]);
    setError(null);
  }, []);

  return { images, error, picking, pick, remove, describe, clear, setError };
}

export type Attachments = ReturnType<typeof useAttachments>;

/** The files as the API takes them, hashed as the server will check them. */
export async function toUploads(images: Attachment[]): Promise<{ uploads: Upload[]; descriptions: string[] }> {
  const uploads: Upload[] = [];

  for (const image of images) {
    const { bytes, sha256 } = await readForUpload(image.uri);

    uploads.push({ name: image.name, type: image.type, bytes, sha256 });
  }

  return { uploads, descriptions: images.map((image) => image.description.trim()) };
}

/** Lets the user choose between the library and the camera, as one button. */
export function chooseImageSource(pick: (source: Source) => void): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ options: ['Photo library', 'Take photo', 'Cancel'], cancelButtonIndex: 2 }, (index) => {
      if (index === 0) {
        pick('library');
      } else if (index === 1) {
        pick('camera');
      }
    });

    return;
  }

  Alert.alert('Attach an image', undefined, [
    { text: 'Photo library', onPress: () => pick('library') },
    { text: 'Take photo', onPress: () => pick('camera') },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export function ToolbarButton({ icon: Icon, label, onPress, disabled = false, active = false }: { icon: typeof ImagePlus; label: string; onPress: () => void; disabled?: boolean; active?: boolean }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      android_ripple={{ color: theme.wash, borderless: true, radius: 22 }}
      style={({ pressed }) => [styles.toolButton, active && { backgroundColor: theme.primarySoft }, pressed && styles.pressed, disabled && styles.disabled]}>
      <Icon size={22} color={active ? theme.primary : theme.inkMuted} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * The row under the text: attach from the library, take a photo, add a poll.
 * A poll can't go with images or on a quote, as on the web.
 */
export function ComposerToolbar({ attachments, poll, onTogglePoll, withPoll = true, previewing = false, onTogglePreview, children }: { attachments: Attachments; poll?: NewPoll | null; onTogglePoll?: () => void; withPoll?: boolean; previewing?: boolean; onTogglePreview?: () => void; children?: ReactNode }) {
  const full = attachments.images.length >= MaxImages;
  const imagesOff = attachments.picking || full || Boolean(poll) || previewing;

  return (
    <View style={styles.toolbar}>
      <ToolbarButton icon={ImagePlus} label={full ? `Up to ${MaxImages} images per commit` : 'Attach images'} onPress={() => attachments.pick('library')} disabled={imagesOff} />
      <ToolbarButton icon={Camera} label="Take a photo" onPress={() => attachments.pick('camera')} disabled={imagesOff} />
      {withPoll && onTogglePoll && <ToolbarButton icon={ChartBar} label={poll ? 'Remove poll' : 'Add a poll'} onPress={onTogglePoll} disabled={attachments.images.length > 0 || previewing} active={Boolean(poll)} />}
      {onTogglePreview && <ToolbarButton icon={Eye} label={previewing ? 'Back to writing' : 'Preview'} onPress={onTogglePreview} active={previewing} />}
      <View style={styles.spacer} />
      {children}
    </View>
  );
}

/** Thumbnails of the attached images, each with a remove button and an ALT description. */
export function AttachmentStrip({ attachments, compact = false }: { attachments: Attachments; compact?: boolean }) {
  const theme = useTheme();
  const [describing, setDescribing] = useState<string | null>(null);
  const editing = attachments.images.find((image) => image.id === describing) ?? null;
  const size = compact ? 64 : 88;

  if (attachments.images.length === 0 && !attachments.error) {
    return null;
  }

  return (
    <View style={styles.strip}>
      {attachments.images.length > 0 && (
        <View style={styles.thumbs} accessibilityLabel="Attached images">
          {attachments.images.map((image, index) => {
            const described = image.description.trim() !== '';

            return (
              <View key={image.id} style={{ width: size, height: size }}>
                <Image source={{ uri: image.uri }} style={{ width: size, height: size, borderRadius: Radius.lg, backgroundColor: theme.wash }} contentFit="cover" accessibilityLabel={`Attached image ${index + 1}`} />
                <Pressable
                  onPress={() => {
                    setDescribing(null);
                    attachments.remove(image.id);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove image ${index + 1}`}
                  style={[styles.remove, { backgroundColor: theme.ink }]}>
                  <X size={14} color={theme.surface} strokeWidth={2.5} />
                </Pressable>
                {!compact && (
                  <Pressable
                    onPress={() => setDescribing(describing === image.id ? null : image.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={described ? `Edit description of image ${index + 1}` : `Add description to image ${index + 1}`}
                    style={[styles.alt, { backgroundColor: described ? theme.ink : theme.surface }]}>
                    <Text variant="monoMedium" color={described ? theme.surface : theme.ink} style={styles.altText}>{described ? 'ALT' : '+ALT'}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {editing && (
        <View style={[styles.describe, { borderColor: theme.hairline }]}>
          <Text variant="small" muted>Description of image {attachments.images.indexOf(editing) + 1}</Text>
          <TextInput
            value={editing.description}
            onChangeText={(text) => attachments.describe(editing.id, text)}
            multiline
            autoFocus
            maxLength={MaxDescriptionLength}
            placeholder="Describe the image for people who can't see it"
            placeholderTextColor={theme.inkMuted}
            selectionColor={theme.primary}
            style={[styles.describeInput, { color: theme.ink }]}
          />
          <View style={styles.describeFooter}>
            <Text variant="mono" muted>{length(editing.description)}/{MaxDescriptionLength}</Text>
            <Pressable onPress={() => setDescribing(null)} hitSlop={8} accessibilityRole="button" style={[styles.done, { backgroundColor: theme.wash }]}>
              <Text variant="label">Done</Text>
            </Pressable>
          </View>
        </View>
      )}

      {attachments.error && <Text variant="small" color={theme.destructive}>{attachments.error}</Text>}
    </View>
  );
}

export const emptyPoll: NewPoll = { options: ['', ''], duration: 1440 };

/** Whether the poll could be sent: every option filled, no two alike. */
export function pollFits(poll: NewPoll): boolean {
  const options = poll.options.map((option) => option.trim());

  return options.length >= PollLimits.minOptions && options.length <= PollLimits.maxOptions && options.every((option) => option !== '' && length(option) <= PollLimits.maxOptionLength) && new Set(options.map((option) => option.toLowerCase())).size === options.length;
}

export function PollEditor({ poll, onChange, onRemove, error }: { poll: NewPoll; onChange: (poll: NewPoll) => void; onRemove: () => void; error?: string | null }) {
  const theme = useTheme();
  const setOption = (index: number, value: string) => onChange({ ...poll, options: poll.options.map((option, current) => (current === index ? value : option)) });

  return (
    <View style={[styles.poll, { borderColor: theme.hairline }]} accessibilityLabel="Poll">
      <View style={styles.pollHeader}>
        <Text variant="name" style={styles.pollTitle}>Poll</Text>
        <Pressable onPress={onRemove} hitSlop={12} accessibilityRole="button" accessibilityLabel="Remove poll" style={styles.pollRemove}>
          <X size={18} color={theme.inkMuted} strokeWidth={2} />
        </Pressable>
      </View>

      {poll.options.map((option, index) => (
        <View key={index} style={styles.pollOption}>
          <TextInput
            value={option}
            onChangeText={(text) => setOption(index, text)}
            placeholder={`Option ${index + 1}`}
            placeholderTextColor={theme.inkMuted}
            selectionColor={theme.primary}
            maxLength={PollLimits.maxOptionLength}
            returnKeyType="next"
            accessibilityLabel={`Poll option ${index + 1}`}
            style={[styles.pollInput, { color: theme.ink, borderColor: theme.rail }]}
          />
          {poll.options.length > PollLimits.minOptions && (
            <Pressable onPress={() => onChange({ ...poll, options: poll.options.filter((_, current) => current !== index) })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove option ${index + 1}`} style={styles.pollOptionRemove}>
              <X size={16} color={theme.inkMuted} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      ))}

      {poll.options.length < PollLimits.maxOptions && (
        <Pressable onPress={() => onChange({ ...poll, options: [...poll.options, ''] })} hitSlop={6} accessibilityRole="button" style={styles.pollAdd}>
          <Plus size={16} color={theme.primary} strokeWidth={2} />
          <Text variant="small" color={theme.primary}>Add option</Text>
        </Pressable>
      )}

      <View style={styles.durationRow}>
        <Text variant="small" muted>Runs for</Text>
        <View style={[styles.durations, { borderColor: theme.hairline }]} accessibilityRole="radiogroup">
          {PollDurations.map((duration) => {
            const selected = duration.minutes === poll.duration;

            return (
              <Pressable key={duration.minutes} onPress={() => onChange({ ...poll, duration: duration.minutes })} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[styles.duration, selected && { backgroundColor: theme.primarySoft }]}>
                <Text variant="small" color={selected ? theme.primary : theme.inkMuted} style={styles.durationLabel}>{duration.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error && <Text variant="small" color={theme.destructive}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { fontFamily: Fonts.sans, fontSize: 17, lineHeight: 23, textAlignVertical: 'top', padding: 0 },
  stash: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drop: { textDecorationLine: 'underline' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolButton: { width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.35 },
  spacer: { flex: 1 },
  strip: { gap: 10 },
  thumbs: { flexDirection: 'row', gap: 8 },
  remove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
  alt: { position: 'absolute', bottom: 4, left: 4, paddingHorizontal: 5, height: 20, borderRadius: Radius.sm, justifyContent: 'center', opacity: 0.95 },
  altText: { fontSize: 11, lineHeight: 14 },
  describe: { borderWidth: 1, borderRadius: Radius.lg, padding: 10, gap: 6 },
  describeInput: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 21, minHeight: 44, maxHeight: 120, textAlignVertical: 'top', padding: 0 },
  describeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  done: { height: 32, paddingHorizontal: 12, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  poll: { borderWidth: 1, borderRadius: Radius.lg, padding: 12, gap: 10 },
  pollHeader: { flexDirection: 'row', alignItems: 'center' },
  pollTitle: { flex: 1 },
  pollRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -8, marginVertical: -8 },
  pollOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollInput: { flex: 1, height: 44, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, fontFamily: Fonts.sans, fontSize: 15 },
  pollOptionRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pollAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, alignSelf: 'flex-start' },
  durationRow: { gap: 6 },
  durations: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.lg, padding: 2 },
  duration: { flex: 1, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  durationLabel: { fontSize: 13 },
});
