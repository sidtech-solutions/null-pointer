import type { BodySegment } from './types';

/**
 * Groups quoted prose lines, as the web's bodyBlocks does: a line that starts with `>` outside code is quoted, the
 * marker and one space after it go, consecutive quoted lines stay together, and a code block or an unquoted line
 * ends the quote. A `>` inside code or mid-line stays literal.
 */
export function groupQuotes(segments: BodySegment[]): { quoted: boolean; segments: BodySegment[] }[] {
  const groups: { quoted: boolean; segments: BodySegment[] }[] = [];
  let atLineStart = true;
  let quoted = false;

  const lines = segments.flatMap((segment): BodySegment[] => (segment.type === 'text' ? segment.text.split(/(?<=\n)/).map((text) => ({ type: 'text', text })) : [segment]));

  for (const segment of lines) {
    if (atLineStart || segment.type === 'block') {
      quoted = segment.type === 'text' && segment.text.startsWith('>');
    }

    const content = atLineStart && quoted && segment.type === 'text' ? { ...segment, text: segment.text.replace(/^> ?/, '') } : segment;
    const previous = groups.at(-1);

    if (previous?.quoted === quoted) {
      previous.segments.push(content);
    } else {
      const last = previous?.segments.at(-1);

      if (last?.type === 'text') {
        last.text = last.text.replace(/\r?\n$/, '');
      }

      groups.push({ quoted, segments: [content] });
    }

    atLineStart = segment.type === 'block' || (segment.type === 'text' && segment.text.endsWith('\n'));
  }

  return groups;
}
