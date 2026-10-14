const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = () => toISODate(new Date());

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Monday of the week containing `iso`. */
export function startOfWeekISO(iso: string): string {
  const d = parseISODate(iso);
  return addDaysISO(iso, -((d.getDay() + 6) % 7));
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / 86_400_000);
}

const fmtWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtWeekdayYear = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fmtLong = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** "Wed, Oct 14" (adds the year when it isn't this year). */
export function formatDate(iso: string): string {
  const d = parseISODate(iso);
  return d.getFullYear() === new Date().getFullYear() ? fmtWeekday.format(d) : fmtWeekdayYear.format(d);
}

/** "Oct 14" */
export const formatDay = (iso: string) => fmtDay.format(parseISODate(iso));

/** "Wednesday, October 14" */
export const formatLongDate = (iso: string) => fmtLong.format(parseISODate(iso));

export const formatTime = (ms: number) => fmtTime.format(new Date(ms));

/** "Today", "Yesterday" or "Wed, Oct 14". */
export function relativeDate(iso: string): string {
  const diff = daysBetween(iso, todayISO());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatDate(iso);
}

export function weekLabel(weekStart: string): string {
  const thisWeek = startOfWeekISO(todayISO());
  if (weekStart === thisWeek) return 'This week';
  if (weekStart === addDaysISO(thisWeek, -7)) return 'Last week';
  return `${formatDay(weekStart)} – ${formatDay(addDaysISO(weekStart, 6))}`;
}
