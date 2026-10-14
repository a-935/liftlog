import { db, type SetEntry, type Workout } from '../../db/schema';
import { exercisesById, findPreviousSameType } from '../../db/queries';
import { isLogged, summarize, type ExerciseSummary } from '../../lib/stats';

export interface CompareRow {
  exerciseId: string;
  name: string;
  /** both = done in both workouts, new = only this time, skipped = only last time */
  status: 'both' | 'new' | 'skipped';
  cur: ExerciseSummary | null;
  prev: ExerciseSummary | null;
}

export interface Comparison {
  workout: Workout;
  previous: Workout | null;
  rows: CompareRow[];
  totals: { cur: ExerciseSummary; prev: ExerciseSummary | null };
}

async function loadSets(w: Workout) {
  const wes = (await db.workoutExercises.where('workoutId').equals(w.id).toArray()).sort((a, b) => a.order - b.order);
  const sets = await db.sets.where('workoutId').equals(w.id).toArray();
  return { order: wes.map((we) => we.exerciseId), sets };
}

const setsFor = (sets: SetEntry[], exerciseId: string) => sets.filter((s) => s.exerciseId === exerciseId && isLogged(s));

/** This workout vs the previous workout of the same type, exercise by exercise. */
export async function loadComparison(workoutId: string): Promise<Comparison | null> {
  const workout = await db.workouts.get(workoutId);
  if (!workout) return null;
  const previous = (await findPreviousSameType(workout)) ?? null;
  const cur = await loadSets(workout);
  const prev = previous ? await loadSets(previous) : null;
  const names = await exercisesById([...cur.order, ...(prev?.order ?? [])]);
  const name = (id: string) => names.get(id)?.name ?? 'Unknown exercise';

  const rows: CompareRow[] = [];
  const seen = new Set<string>();
  for (const exerciseId of cur.order) {
    if (seen.has(exerciseId)) continue;
    seen.add(exerciseId);
    const c = setsFor(cur.sets, exerciseId);
    const p = prev ? setsFor(prev.sets, exerciseId) : [];
    if (!c.length && !p.length) continue;
    rows.push({
      exerciseId,
      name: name(exerciseId),
      status: !c.length ? 'skipped' : p.length ? 'both' : 'new',
      cur: c.length ? summarize(c) : null,
      prev: p.length ? summarize(p) : null,
    });
  }
  for (const exerciseId of prev?.order ?? []) {
    if (seen.has(exerciseId)) continue;
    seen.add(exerciseId);
    const p = setsFor(prev!.sets, exerciseId);
    if (p.length) rows.push({ exerciseId, name: name(exerciseId), status: 'skipped', cur: null, prev: summarize(p) });
  }

  return {
    workout,
    previous,
    rows,
    totals: { cur: summarize(cur.sets), prev: prev ? summarize(prev.sets) : null },
  };
}
