// Pure date helpers for scheduled commits, kept apart from the picker so tests need no native modules.

export const MaxScheduleDays = 30;
export const MinuteStep = 5;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** The moment as the server wants it: `Y-m-d\TH:i:sP`, in the phone's own offset. */
export function scheduledAtOf(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${hours}:${minutes}`;
}

const Days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const Months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Today, Tomorrow, or `Fri 1 Nov`, relative to `now`. */
export function dayName(date: Date, now: Date = new Date()): string {
  const days = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);

  if (days === 0) {
    return 'Today';
  }

  if (days === 1) {
    return 'Tomorrow';
  }

  return `${Days[date.getDay()]} ${date.getDate()} ${Months[date.getMonth()]}`;
}

export function timeName(date: Date): string {
  const hours = date.getHours();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const shown = hours % 12 === 0 ? 12 : hours % 12;

  return `${shown}:${pad(date.getMinutes())} ${suffix}`;
}

/** `Tomorrow at 9:00 AM`, or `Fri 1 Nov at 9:00 AM`. */
export function scheduleLabel(value: Date | string, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${dayName(date, now)} at ${timeName(date)}`;
}

/** The next moment on the picker's grid after `now`: the next hour, on the hour. */
export function firstSlot(now: Date = new Date()): Date {
  const next = new Date(now.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(0);
  next.setHours(next.getHours() + 1);

  return next;
}

export function lastSlot(now: Date = new Date()): Date {
  return new Date(now.getTime() + MaxScheduleDays * 86_400_000);
}

/** Why the moment cannot be scheduled, or null when it can. */
export function scheduleProblem(date: Date, now: Date = new Date()): string | null {
  if (date.getTime() <= now.getTime() + 60_000) {
    return 'Pick a time at least a minute from now.';
  }

  if (date.getTime() > lastSlot(now).getTime()) {
    return `Up to ${MaxScheduleDays} days ahead.`;
  }

  return null;
}
