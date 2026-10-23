// Code pasted into the composer, found and fenced the way devnull highlights it (tempest/highlight language names).

export type Language = { id: string; label: string };

/** Languages offered when wrapping, by how often developers post them; the id is what the fence carries. */
export const Languages: Language[] = [
  { id: 'php', label: 'PHP' },
  { id: 'js', label: 'JavaScript' },
  { id: 'ts', label: 'TypeScript' },
  { id: 'tsx', label: 'TSX' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'sh', label: 'Shell' },
  { id: 'sql', label: 'SQL' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'swift', label: 'Swift' },
  { id: 'java', label: 'Java' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'diff', label: 'Diff' },
  { id: '', label: 'Plain text' },
];

const MinChars = 24;

/**
 * Whether a chunk of text reads as code rather than prose: several lines, or
 * one line thick with the punctuation prose does not use. Kept conservative,
 * so a pasted paragraph is never fenced by surprise.
 */
export function looksLikeCode(text: string): boolean {
  const trimmed = text.trim();

  if (trimmed.length < MinChars || /^https?:\/\/\S+$/.test(trimmed)) {
    return false;
  }

  const lines = trimmed.split('\n');
  const codeLines = lines.filter((line) => /^\s{2,}\S/.test(line) || /[;{}()\[\]=<>]\s*$/.test(line) || /^\s*(#!|\$ |\/\/|#\s|\*\s|--\s)/.test(line) || /\b(function|const|let|var|def|class|import|export|return|public|private|fn|func|SELECT|FROM|WHERE|<\?php|=>|->|::)\b/.test(line));
  const punctuation = (trimmed.match(/[;{}()\[\]=<>|&$]/g) ?? []).length / trimmed.length;
  const sentences = /^[A-Z][^.!?]{20,}[.!?](\s|$)/.test(trimmed) && !/[;{}]/.test(trimmed);

  if (sentences) {
    return false;
  }

  return lines.length >= 3 ? codeLines.length >= Math.ceil(lines.length / 2) : codeLines.length === lines.length || punctuation > 0.12;
}

/** A best guess at the language of a chunk of code, by the tokens that only one of them uses. */
export function guessLanguage(text: string): string {
  const code = text.trim();

  if (/^(diff --git|@@ |[-+]{3} )/m.test(code) || /^[+-](?![+-])/m.test(code) && /^@@/m.test(code)) {
    return 'diff';
  }

  if (/<\?php|\$[a-z_]\w*\s*(=|->)|->\w+\(/i.test(code) || /\buse [A-Z][\w\\]+;/.test(code)) {
    return 'php';
  }

  if (/^\s*(#!\/bin\/(ba|z)?sh|\$ |npm |npx |yarn |pnpm |git |brew |sudo |cd |ls |curl |export \w+=)/m.test(code)) {
    return 'sh';
  }

  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE)\b/im.test(code)) {
    return 'sql';
  }

  if (/^\s*[{[]\s*$/m.test(code) && /"\w+"\s*:/.test(code) && !/\b(const|let|function|=>)\b/.test(code)) {
    return 'json';
  }

  if (/\bfunc \w+\(|\bpackage \w+|:=/.test(code)) {
    return 'go';
  }

  if (/\bfn \w+\(|\blet mut\b|\bimpl\b|\bpub (fn|struct)\b/.test(code)) {
    return 'rust';
  }

  if (/\bfun \w+\(|\bval \w+\s*[:=]|\bdata class\b/.test(code)) {
    return 'kotlin';
  }

  if (/\bfunc \w+\(/.test(code) && /\b(var|let) \w+\s*:/.test(code)) {
    return 'swift';
  }

  if (/^\s*def \w+\(.*\):\s*$|^\s*(import \w+|from \w+ import)\s*$|^\s*(if|for|while) .*:\s*$/m.test(code)) {
    return 'python';
  }

  if (/^\s*def \w+|\bend\s*$|\bputs\b|\battr_accessor\b/m.test(code) && !/\bdef \w+\(.*\):/.test(code)) {
    return 'ruby';
  }

  if (/\bpublic (static |final )*(class|void|int|String)\b|System\.out\.println/.test(code)) {
    return 'java';
  }

  if (/<\/?[a-z][\w-]*(\s[^>]*)?>/i.test(code) && !/=>|\bconst\b/.test(code)) {
    return 'html';
  }

  if (/^\s*[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/m.test(code) && !/[;{}]\s*$/m.test(code.split('\n')[0]) && !/\b(const|let|function)\b/.test(code)) {
    return 'css';
  }

  if (/<[A-Z]\w*[\s/>]/.test(code) && /\b(const|function|return|import)\b/.test(code)) {
    return 'tsx';
  }

  if (/:\s*(string|number|boolean|\w+\[\])\b|\binterface \w+|\btype \w+ =/.test(code)) {
    return 'ts';
  }

  if (/\b(const|let|var|function|=>|console\.log|require\()\b/.test(code) || /=>/.test(code)) {
    return 'js';
  }

  if (/^\s*[\w-]+:\s*(\S.*)?$/m.test(code) && !/[;{}]/.test(code)) {
    return 'yaml';
  }

  return '';
}

/** The text wrapped in a fence; a fence already there is left alone. */
export function fence(code: string, language: string): string {
  const body = code.replace(/^\n+|\n+$/g, '');

  if (/^```/.test(body)) {
    return body;
  }

  return `\`\`\`${language}\n${body}\n\`\`\``;
}

/**
 * The chunk a change added to the text, when it added one piece in one go,
 * as a paste does. Typing adds one character and gives null.
 */
export function insertedChunk(before: string, after: string): { start: number; text: string } | null {
  if (after.length - before.length < MinChars) {
    return null;
  }

  let start = 0;

  while (start < before.length && before[start] === after[start]) {
    start += 1;
  }

  let end = 0;

  while (end < before.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) {
    end += 1;
  }

  const text = after.slice(start, after.length - end);

  return text.length >= MinChars ? { start, text } : null;
}

/** The text with the chunk at `start` replaced by its fenced form, and where the caret lands after it. */
export function fenceChunk(text: string, chunk: { start: number; text: string }, language: string): { text: string; caret: number } {
  const before = text.slice(0, chunk.start);
  const after = text.slice(chunk.start + chunk.text.length);
  const fenced = fence(chunk.text, language);
  const lead = before === '' || before.endsWith('\n') ? '' : '\n';
  const tail = after === '' || after.startsWith('\n') ? '' : '\n';
  const next = `${before}${lead}${fenced}${tail}${after}`;

  return { text: next, caret: before.length + lead.length + fenced.length + tail.length };
}
