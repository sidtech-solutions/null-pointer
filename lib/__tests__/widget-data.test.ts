jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: () => undefined, set: () => {}, remove: () => {} }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: async () => null }));

import { levelsOf } from '../widget-data';

describe('levelsOf', () => {
  it('shades each day against the busiest one, as the activity graph does', () => {
    const days = levelsOf([
      { date: '2026-10-17', count: 0 },
      { date: '2026-10-18', count: 1 },
      { date: '2026-10-19', count: 2 },
      { date: '2026-10-20', count: 4 },
    ]);

    expect(days.map((day) => day.level)).toEqual([0, 1, 2, 4]);
    expect(days.map((day) => day.weekday)).toEqual(['S', 'S', 'M', 'T']);
  });

  it('gives a lone commit the full shade', () => {
    expect(levelsOf([{ date: '2026-10-20', count: 1 }])[0].level).toBe(4);
  });
});

describe('firstLine', () => {
  it('takes the first prose line and skips fences and quote markers', () => {
    const { firstLine } = require('../widget-data') as typeof import('../widget-data');

    expect(firstLine('```php\necho 1;\n```\nshipped it')).toBe('echo 1;');
    expect(firstLine('\n> quoted\nnext')).toBe('quoted');
    expect(firstLine('')).toBe('');
  });
});
