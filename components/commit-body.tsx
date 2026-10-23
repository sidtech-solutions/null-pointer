import { memo } from 'react';
import { StyleSheet, Text as NativeText, View } from 'react-native';

import { Text } from '@/components/text';
import { Fonts, Radius, useTheme } from '@/constants/theme';
import type { BodySegment, Commit } from '@/lib/types';
import { hrefFor, linkLabel, type LinkTarget, linkTarget, UrlPattern, withoutTrailingPunctuation } from '@/lib/urls';

type Run = { kind: 'text' | 'mention' | 'wordmark' | 'code'; text: string } | { kind: 'link'; text: string; href: string; target: LinkTarget };

type Block = { kind: 'paragraph'; runs: Run[] } | { kind: 'code'; code: string; language: string | null };

const MentionOrWordmark = /((?<![\w.\/-])@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)|((?<![\p{L}\p{M}\p{N}_.\/-])\/dev\/null(?![\p{L}\p{M}\p{N}_\/-]))/gu;

function proseRuns(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;

  for (const match of text.matchAll(MentionOrWordmark)) {
    const index = match.index ?? 0;

    if (index > last) {
      runs.push({ kind: 'text', text: text.slice(last, index) });
    }

    runs.push({ kind: match[1] ? 'mention' : 'wordmark', text: match[0] });
    last = index + match[0].length;
  }

  if (last < text.length) {
    runs.push({ kind: 'text', text: text.slice(last) });
  }

  return runs;
}

// Links first, as the server finds them, then mentions and wordmarks in the prose between them.
function runsOf(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;

  for (const match of text.matchAll(UrlPattern)) {
    const index = match.index ?? 0;
    const linkText = withoutTrailingPunctuation(match[0]);
    const href = hrefFor(linkText);

    if (href === null || linkText === '') {
      continue;
    }

    if (index > last) {
      runs.push(...proseRuns(text.slice(last, index)));
    }

    runs.push({ kind: 'link', text: linkText, href, target: linkTarget(href) });
    last = index + linkText.length;
  }

  if (last < text.length) {
    runs.push(...proseRuns(text.slice(last)));
  }

  return runs;
}

// The API sends the body pre-split into segments. A body without segments is
// one prose segment; preview_segments are the folded start of a long body.
export function blocksOf(body: string, segments?: BodySegment[] | null): Block[] {
  const list = segments && segments.length > 0 ? segments : body === '' ? [] : [{ type: 'text' as const, text: body }];
  const blocks: Block[] = [];
  let runs: Run[] = [];

  for (const segment of list) {
    if (segment.type === 'text') {
      runs.push(...runsOf(segment.text ?? ''));
    } else if (segment.type === 'code') {
      runs.push({ kind: 'code', text: segment.code ?? '' });
    } else if (segment.type === 'block') {
      if (runs.length > 0) {
        blocks.push({ kind: 'paragraph', runs });
        runs = [];
      }

      blocks.push({ kind: 'code', code: segment.code ?? fencedCode(body, blocks.filter((block) => block.kind === 'code').length), language: segment.language ?? null });
    }
  }

  if (runs.length > 0) {
    blocks.push({ kind: 'paragraph', runs });
  }

  return blocks;
}

/** Nth fenced block in the raw body, for a code segment the API sends without its code. */
function fencedCode(body: string, nth: number): string {
  const matches = Array.from(body.matchAll(/`{3,}[^`\r\n]*\r?\n([\s\S]*?)\r?\n`{3,}/g));

  return matches[nth]?.[1] ?? '';
}

export const CommitBody = memo(function CommitBody({
  body,
  segments,
  size = 15,
  muted = false,
  numberOfLines,
  onOpenMention,
  onOpenLink,
}: {
  body: string;
  segments?: BodySegment[] | null;
  size?: number;
  muted?: boolean;
  numberOfLines?: number;
  onOpenMention?: (username: string) => void;
  onOpenLink?: (url: string) => void;
}) {
  const theme = useTheme();
  const lineHeight = Math.round(size * 1.625);
  const blocks = blocksOf(body, segments);

  return (
    <View style={styles.blocks}>
      {blocks.map((block, index) =>
        block.kind === 'code' ? (
          <View key={index} style={[styles.code, { backgroundColor: theme.wash, borderColor: theme.hairline }]}>
            {block.language ? <Text variant="mono" muted style={styles.language}>{block.language}</Text> : null}
            <NativeText style={[styles.codeText, { color: theme.ink }]} selectable>
              {block.code}
            </NativeText>
          </View>
        ) : (
          <Text key={index} muted={muted} numberOfLines={numberOfLines} style={{ fontSize: size, lineHeight }}>
            {block.runs.map((run, runIndex) => {
              switch (run.kind) {
                case 'link':
                  // A dev/null commit or a GitHub repository, issue or pull request shows as a mono name with its owner muted, as on the web.
                  return run.target.kind === 'web' || run.target.kind === 'profile' ? (
                    <Text key={runIndex} color={theme.primary} style={{ fontSize: size, lineHeight }} onPress={onOpenLink ? () => onOpenLink(run.href) : undefined} accessibilityLabel={run.href}>
                      {linkLabel(run.href)}
                    </Text>
                  ) : (
                    <NativeText key={runIndex} style={{ fontFamily: Fonts.mono, fontSize: size - 1, lineHeight, color: theme.primary }} onPress={onOpenLink ? () => onOpenLink(run.href) : undefined} accessibilityLabel={run.href} suppressHighlighting>
                      <NativeText style={{ color: theme.inkMuted }}>{run.target.kind === 'commit' ? `${run.target.username}/` : `${run.target.owner}/`}</NativeText>
                      {run.target.kind === 'commit' ? run.target.id.slice(0, 7) : `${run.target.repository}${run.target.number ? `#${run.target.number}` : ''}`}
                    </NativeText>
                  );
                case 'mention':
                  return (
                    <Text key={runIndex} color={theme.primary} style={{ fontSize: size, lineHeight }} onPress={onOpenMention ? () => onOpenMention(run.text.slice(1)) : undefined}>
                      {run.text}
                    </Text>
                  );
                case 'wordmark':
                  return (
                    <Text key={runIndex} muted={muted} style={{ fontSize: size, lineHeight, fontFamily: Fonts.sansSemiBold, letterSpacing: -size * 0.03 }}>
                      /dev<Text style={{ fontSize: size, lineHeight, fontFamily: Fonts.sansSemiBold, color: theme.lanes[0] }}>/</Text>null
                    </Text>
                  );
                case 'code':
                  return (
                    <NativeText key={runIndex} style={{ fontFamily: Fonts.mono, fontSize: size - 2, lineHeight, color: theme.ink, backgroundColor: theme.wash, borderRadius: Radius.sm }}>
                      {` ${run.text} `}
                    </NativeText>
                  );
                default:
                  return run.text;
              }
            })}
          </Text>
        ),
      )}
    </View>
  );
});

export function isFolded(commit: Commit): boolean {
  if (commit.preview_segments && commit.preview_segments.length > 0) {
    return true;
  }

  const normalized = commit.body.replace(/\r\n/g, '\n');

  return Array.from(normalized).length > 280 || normalized.split('\n').length > 8;
}

const styles = StyleSheet.create({
  blocks: { gap: 8 },
  code: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  language: { fontSize: 11, lineHeight: 14 },
  codeText: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 19 },
});
