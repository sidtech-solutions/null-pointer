export const MaxLength = 4000;

export const MinLength = 3;

/** The composer shows a countdown once this many characters remain. */
export const CountFrom = 200;

export function shortHash(id: string): string {
  return id.replace(/-/g, '').slice(0, 7);
}

export function length(body: string): number {
  return Array.from(body).length;
}

export function fits(body: string): boolean {
  return length(body.trim()) >= MinLength && length(body) <= MaxLength;
}

export function count(value: number, singular: string, plural: string): string {
  return `${compact(value)} ${value === 1 ? singular : plural}`;
}

/** 999 stays 999; 1.4k, 38k, 1.2M above that, trailing zeros trimmed, as a product shows a count. */
export function compact(value: number): string {
  const abs = Math.abs(value);

  if (abs < 1000) {
    return String(value);
  }

  const unit = abs < 1_000_000 ? 'k' : 'M';
  const scaled = abs / (unit === 'k' ? 1000 : 1_000_000);
  const digits = scaled < 10 ? 1 : 0;
  const text = scaled.toFixed(digits).replace(/\.0$/, '');

  return `${value < 0 ? '-' : ''}${text}${unit}`;
}

const Months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const Days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) {
    return '';
  }

  const then = Date.parse(iso);

  if (Number.isNaN(then)) {
    return '';
  }

  const seconds = Math.max(0, Math.round((now - then) / 1000));

  if (seconds < 60) {
    return 'now';
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }

  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)}d`;
  }

  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();

  return `${Months[date.getMonth()]} ${date.getDate()}${sameYear ? '' : `, ${date.getFullYear()}`}`;
}

/** Calendar day in the device's time zone. */
export function dayKey(iso: string): string {
  const date = new Date(iso);

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayLabel(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  const today = new Date(now);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);

  if (daysAgo === 0) {
    return 'Today';
  }

  if (daysAgo === 1) {
    return 'Yesterday';
  }

  const label = `${Days[date.getDay()]}, ${Months[date.getMonth()]} ${date.getDate()}`;

  return date.getFullYear() === today.getFullYear() ? label : `${label}, ${date.getFullYear()}`;
}
