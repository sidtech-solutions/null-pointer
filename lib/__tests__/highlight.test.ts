import { decodeEntities, parseHighlighted, plainText } from '../highlight';

describe('parseHighlighted', () => {
  it('reads nested tokens and decodes entities', () => {
    const html = '<span class="hl-keyword">echo</span> <span class="hl-value">&quot;Hi&quot;</span> . <span class="hl-injection"><span class="hl-type">string</span> $name</span> &lt; 3';

    expect(parseHighlighted(html)).toEqual([
      { token: 'keyword', children: [{ text: 'echo' }] },
      { text: ' ' },
      { token: 'value', children: [{ text: '"Hi"' }] },
      { text: ' . ' },
      { token: 'injection', children: [{ token: 'type', children: [{ text: 'string' }] }, { text: ' $name' }] },
      { text: ' < 3' },
    ]);
  });

  it('keeps plain code as one text node and survives stray closes', () => {
    expect(parseHighlighted('plain &lt;text&gt; &amp; stuff')).toEqual([{ text: 'plain <text> & stuff' }]);
    expect(parseHighlighted('a</span>b')).toEqual([{ text: 'a' }, { text: 'b' }]);
  });

  it('gives the code back as text', () => {
    expect(plainText(parseHighlighted('<span class="hl-deletion">- old</span>\n<span class="hl-addition">+ new</span>'))).toBe('- old\n+ new');
  });

  it('decodes numeric entities', () => {
    expect(decodeEntities('&#039;a&#x27; &#8217;')).toBe("'a' ’");
  });
});
