// The server highlights fenced code with tempest/highlight and sends the result as HTML: text with entities escaped,
// wrapped in nested `<span class="hl-…">` tokens. This reads that back into a tree the app can draw with coloured
// text runs, so the phone shows the same tokens as the web without a highlighter of its own.

export type HighlightNode = { text: string } | { token: string; children: HighlightNode[] };

const Entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the entities the highlighter escapes, numeric ones included. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);

      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }

    return Entities[body.toLowerCase()] ?? whole;
  });
}

const Tag = /<span class="([^"]*)">|<\/span>/g;

/**
 * The highlighted HTML as a tree: a span becomes a token node named by its
 * `hl-` class, everything else is text. An unknown tag is kept as text, and
 * an unbalanced close is ignored, so a surprise never drops code.
 */
export function parseHighlighted(html: string): HighlightNode[] {
  const root: HighlightNode[] = [];
  const stack: HighlightNode[][] = [root];
  let last = 0;

  const text = (chunk: string) => {
    if (chunk !== '') {
      stack[stack.length - 1].push({ text: decodeEntities(chunk) });
    }
  };

  for (const match of html.matchAll(Tag)) {
    const index = match.index ?? 0;
    text(html.slice(last, index));
    last = index + match[0].length;

    if (match[1] !== undefined) {
      const token = match[1].split(/\s+/).find((name) => name.startsWith('hl-'))?.slice(3) ?? '';
      const node = { token, children: [] as HighlightNode[] };
      stack[stack.length - 1].push(node);
      stack.push(node.children);
    } else if (stack.length > 1) {
      stack.pop();
    }
  }

  text(html.slice(last));

  return root;
}

/** The code as plain text, for copying or for a body the highlighter did not get to. */
export function plainText(nodes: HighlightNode[]): string {
  return nodes.map((node) => ('text' in node ? node.text : plainText(node.children))).join('');
}
