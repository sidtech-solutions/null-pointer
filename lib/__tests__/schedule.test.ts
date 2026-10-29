import { dayName, firstSlot, scheduledAtOf, scheduleLabel, scheduleProblem } from '../schedule';

describe('scheduledAtOf', () => {
  it('writes the moment with the phone offset in the server format', () => {
    const date = new Date(2026, 10, 1, 9, 5, 30);
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0');

    expect(scheduledAtOf(date)).toBe(`2026-11-01T09:05:00${sign}${hours}:${minutes}`);
  });
});

describe('dayName and scheduleLabel', () => {
  const now = new Date(2026, 9, 29, 14, 0);

  it('names today and tomorrow, then the weekday and date', () => {
    expect(dayName(new Date(2026, 9, 29, 23, 59), now)).toBe('Today');
    expect(dayName(new Date(2026, 9, 30, 0, 0), now)).toBe('Tomorrow');
    expect(dayName(new Date(2026, 10, 1, 9, 0), now)).toBe('Sun 1 Nov');
  });

  it('reads as a sentence with the time', () => {
    expect(scheduleLabel(new Date(2026, 9, 30, 9, 5), now)).toBe('Tomorrow at 9:05 AM');
    expect(scheduleLabel(new Date(2026, 9, 29, 0, 0), now)).toBe('Today at 12:00 AM');
    expect(scheduleLabel('not a date', now)).toBe('');
  });
});

describe('firstSlot and scheduleProblem', () => {
  const now = new Date(2026, 9, 29, 14, 20, 10);

  it('starts the picker on the next hour', () => {
    expect(firstSlot(now).getTime()).toBe(new Date(2026, 9, 29, 15, 0, 0).getTime());
  });

  it('refuses the past, the next minute, and more than thirty days ahead', () => {
    expect(scheduleProblem(new Date(2026, 9, 29, 14, 0), now)).toMatch(/minute/);
    expect(scheduleProblem(new Date(now.getTime() + 30_000), now)).toMatch(/minute/);
    expect(scheduleProblem(new Date(2026, 11, 1, 14, 20), now)).toMatch(/30 days/);
    expect(scheduleProblem(new Date(2026, 9, 29, 15, 0), now)).toBeNull();
  });
});
