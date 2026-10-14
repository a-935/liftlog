import type { SetEntry, Workout } from '../db/schema';

/** A set counts once it's ticked and has reps. */
export const isLogged = (s: SetEntry) => s.done && (s.reps ?? 0) > 0;

type Orderable = Pick<Workout, 'date' | 'startedAt'>;

/** Sort key: calendar date first (editable), then start time. */
export const workoutKey = (w: Orderable) => `${w.date}|${String(w.startedAt).padStart(15, '0')}`;

export const byWorkoutKeyDesc = (a: Orderable, b: Orderable) => (workoutKey(a) < workoutKey(b) ? 1 : -1);

export interface TopSet {
  kg: number;
  reps: number;
}

/** Heaviest set; ties go to the one with more reps. */
export function topSet(sets: SetEntry[]): TopSet | null {
  let best: TopSet | null = null;
  for (const s of sets) {
    if (!isLogged(s)) continue;
    const kg = s.kg ?? 0;
    const reps = s.reps ?? 0;
    if (!best || kg > best.kg || (kg === best.kg && reps > best.reps)) best = { kg, reps };
  }
  return best;
}

export const volumeOf = (sets: SetEntry[]) =>
  sets.reduce((sum, s) => (isLogged(s) ? sum + (s.kg ?? 0) * (s.reps ?? 0) : sum), 0);

/** Epley estimated one-rep max. */
export const estimate1RM = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

/** Sorts sets chronologically: by workout, then by position in the workout. */
export function sortSetsChrono(sets: SetEntry[], workouts: Map<string, Workout>): SetEntry[] {
  return [...sets].sort((a, b) => {
    const wa = workouts.get(a.workoutId);
    const wb = workouts.get(b.workoutId);
    if (wa && wb && wa.id !== wb.id) return workoutKey(wa) < workoutKey(wb) ? -1 : 1;
    return a.order - b.order;
  });
}

/**
 * PR rules: heaviest weight ever for the exercise, or more reps than ever at the same weight.
 * Bodyweight (0 kg): most reps ever. The very first session of an exercise is the baseline,
 * so it never counts as a PR.
 */
export function computePRSetIds(sets: SetEntry[], workouts: Map<string, Workout>): Set<string> {
  const byExercise = new Map<string, SetEntry[]>();
  for (const s of sets) {
    if (!isLogged(s) || !workouts.has(s.workoutId)) continue;
    const list = byExercise.get(s.exerciseId);
    if (list) list.push(s);
    else byExercise.set(s.exerciseId, [s]);
  }

  const prs = new Set<string>();
  for (const list of byExercise.values()) {
    const sorted = sortSetsChrono(list, workouts);
    const firstWorkoutId = sorted[0].workoutId;
    let maxKg = -Infinity;
    const bestRepsAt = new Map<number, number>();
    for (const s of sorted) {
      const kg = s.kg ?? 0;
      const reps = s.reps ?? 0;
      const prevReps = bestRepsAt.get(kg);
      if (s.workoutId !== firstWorkoutId) {
        const repPR = prevReps !== undefined && reps > prevReps;
        const weightPR = kg > 0 && kg > maxKg;
        if (weightPR || repPR) prs.add(s.id);
      }
      maxKg = Math.max(maxKg, kg);
      bestRepsAt.set(kg, Math.max(prevReps ?? 0, reps));
    }
  }
  return prs;
}

export interface ExerciseSummary {
  top: TopSet | null;
  setCount: number;
  volume: number;
}

export function summarize(sets: SetEntry[]): ExerciseSummary {
  return { top: topSet(sets), setCount: sets.filter(isLogged).length, volume: volumeOf(sets) };
}

export type Trend = 'up' | 'down' | 'same';
export const trend = (cur: number, prev: number): Trend => (cur > prev ? 'up' : cur < prev ? 'down' : 'same');
