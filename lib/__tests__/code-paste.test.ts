import { fence, fenceChunk, guessLanguage, insertedChunk, looksLikeCode } from '../code-paste';

describe('looksLikeCode', () => {
  it('spots code and leaves prose alone', () => {
    expect(looksLikeCode('function hi(name) {\n  return `hi ${name}`;\n}')).toBe(true);
    expect(looksLikeCode('SELECT id, body FROM commits WHERE status = "approved" ORDER BY id;')).toBe(true);
    expect(looksLikeCode('const total = items.reduce((sum, item) => sum + item.count, 0);')).toBe(true);
    expect(looksLikeCode('Just wrapped a conversation with derickr from PHP internals, recording goes up on my channel soon.')).toBe(false);
    expect(looksLikeCode('https://github.com/nunomaduro/dev-null.sh/pull/829')).toBe(false);
    expect(looksLikeCode('short')).toBe(false);
  });
});

describe('guessLanguage', () => {
  it('names the usual suspects', () => {
    expect(guessLanguage('<?php\n\nfunction hi(string $name): void {\n    echo $name;\n}')).toBe('php');
    expect(guessLanguage('const x = [1, 2];\nconsole.log(x.map((n) => n * 2));')).toBe('js');
    expect(guessLanguage('interface User { id: string }\nconst users: User[] = [];')).toBe('ts');
    expect(guessLanguage('def hello(name):\n    return f"hi {name}"')).toBe('python');
    expect(guessLanguage('package main\n\nfunc main() {\n\tx := 1\n}')).toBe('go');
    expect(guessLanguage('fn main() {\n    let mut x = 1;\n}')).toBe('rust');
    expect(guessLanguage('$ npm install expo-clipboard\n$ npx expo prebuild')).toBe('sh');
    expect(guessLanguage('SELECT a FROM b WHERE c < 3')).toBe('sql');
    expect(guessLanguage('{\n  "name": "null-pointer",\n  "version": "1.0.5"\n}')).toBe('json');
    expect(guessLanguage('diff --git a/x b/x\n@@ -1 +1 @@\n-old\n+new')).toBe('diff');
    expect(guessLanguage('fun hello(name: String) {\n    val x = 1\n}')).toBe('kotlin');
    expect(guessLanguage('plain words without any markers here')).toBe('');
  });
});

describe('fence and chunks', () => {
  it('wraps code in a fence once', () => {
    expect(fence('echo 1;', 'php')).toBe('```php\necho 1;\n```');
    expect(fence('```js\nx\n```', 'js')).toBe('```js\nx\n```');
  });

  it('finds what a paste added and fences it in place', () => {
    const before = 'Look at this\n';
    const pasted = 'function hi() {\n  return 1;\n}';
    const after = `${before}${pasted}`;
    const chunk = insertedChunk(before, after);

    expect(chunk).toEqual({ start: before.length, text: pasted });
    expect(insertedChunk('abc', 'abcd')).toBeNull();

    const fenced = fenceChunk(after, chunk!, 'js');

    expect(fenced.text).toBe('Look at this\n```js\nfunction hi() {\n  return 1;\n}\n```');
    expect(fenced.caret).toBe(fenced.text.length);
  });

  it('keeps a line of its own around the fence', () => {
    const chunk = { start: 4, text: 'const a = 1; const b = 2; const c = 3;' };
    const fenced = fenceChunk(`Try ${chunk.text} now`, chunk, 'js');

    expect(fenced.text).toBe('Try \n```js\nconst a = 1; const b = 2; const c = 3;\n```\n now');
  });
});
