import { groupQuotes } from '../quotes';

describe('groupQuotes', () => {
  it('groups consecutive quoted lines and strips the marker', () => {
    expect(groupQuotes([{ type: 'text', text: 'said:\n> one\n>two\nreply' }])).toEqual([
      { quoted: false, segments: [{ type: 'text', text: 'said:' }] },
      { quoted: true, segments: [{ type: 'text', text: 'one\n' }, { type: 'text', text: 'two' }] },
      { quoted: false, segments: [{ type: 'text', text: 'reply' }] },
    ]);
  });

  it('keeps inline code inside a quote and leaves a mid-line marker alone', () => {
    expect(groupQuotes([{ type: 'text', text: '> run ' }, { type: 'code', code: 'ls' }, { type: 'text', text: ' now\na > b' }])).toEqual([
      { quoted: true, segments: [{ type: 'text', text: 'run ' }, { type: 'code', code: 'ls' }, { type: 'text', text: ' now' }] },
      { quoted: false, segments: [{ type: 'text', text: 'a > b' }] },
    ]);
  });

  it('ends a quote at a code block', () => {
    expect(groupQuotes([{ type: 'text', text: '> quoted\n' }, { type: 'block', language: 'sh', html: '&gt; not quoted' }])).toEqual([
      { quoted: true, segments: [{ type: 'text', text: 'quoted' }] },
      { quoted: false, segments: [{ type: 'block', language: 'sh', html: '&gt; not quoted' }] },
    ]);
  });
});
