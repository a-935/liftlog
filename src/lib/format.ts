import type { DayType, Workout } from '../db/schema';

export const DAY_LABEL: Record<DayType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  other: 'Other',
};

export function workoutTitle(w: Pick<Workout, 'type' | 'customName'>): string {
  return w.type === 'other' ? w.customName || 'Other' : DAY_LABEL[w.type];
}

export function formatKg(kg: number | null | undefined): string {
  if (kg == null) return '';
  return String(Math.round(kg * 100) / 100);
}

/** "60×8", or "BW×12" for bodyweight sets. */
export function formatSet(kg: number | null, reps: number | null): string {
  const weight = !kg ? 'BW' : formatKg(kg);
  return `${weight}×${reps ?? 0}`;
}

/** "2:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "42 min" or "1h 05m" */
export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const formatNumber = (n: number) => numberFmt.format(n);

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
