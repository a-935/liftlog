import { db, DEFAULT_SETTINGS, type Exercise, type SetEntry, type Settings, type Workout, type WorkoutExercise } from './schema';
import { byWorkoutKeyDesc, computePRSetIds, isLogged, workoutKey } from '../lib/stats';

// Read-side helpers. Each is safe to use inside useLiveQuery.

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
}

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.filter((w) => w.finishedAt === null).first();
}

const norm = (s: string | null) => (s ?? '').trim().toLowerCase();

export function sameKind(a: Pick<Workout, 'type' | 'customName'>, b: Pick<Workout, 'type' | 'customName'>) {
  return a.type === b.type && (a.type !== 'other' || norm(a.customName) === norm(b.customName));
}

/** The latest finished workout of the same type that comes before `w`. */
export async function findPreviousSameType(
  w: Pick<Workout, 'id' | 'type' | 'customName' | 'date' | 'startedAt'>,
): Promise<Workout | undefined> {
  const key = workoutKey(w);
  const candidates = await db.workouts.where('type').equals(w.type).toArray();
  return candidates
    .filter((x) => x.id !== w.id && x.finishedAt !== null && sameKind(x, w) && workoutKey(x) < key)
    .sort(byWorkoutKeyDesc)[0];
}

/** Logged sets of the most recent session of an exercise before `before`. */
export async function lastSessionSets(
  exerciseId: string,
  before: Pick<Workout, 'id' | 'date' | 'startedAt'>,
): Promise<{ workout: Workout; sets: SetEntry[] } | null> {
  const sets = (await db.sets.where('exerciseId').equals(exerciseId).toArray()).filter(isLogged);
  const workouts = await workoutsById(sets.map((s) => s.workoutId));
  return pickLastSession(sets, workouts, before);
}

function pickLastSession(
  sets: SetEntry[],
  workouts: Map<string, Workout>,
  before: Pick<Workout, 'id' | 'date' | 'startedAt'>,
) {
  const key = workoutKey(before);
  let best: Workout | null = null;
  for (const s of sets) {
    const w = workouts.get(s.workoutId);
    if (!w || w.id === before.id || workoutKey(w) >= key) continue;
    if (!best || workoutKey(w) > workoutKey(best)) best = w;
  }
  if (!best) return null;
  const id = best.id;
  return { workout: best, sets: sets.filter((s) => s.workoutId === id).sort((a, b) => a.order - b.order) };
}

export async function workoutsById(ids: string[]): Promise<Map<string, Workout>> {
  const unique = [...new Set(ids)];
  const list = await db.workouts.bulkGet(unique);
  return new Map(list.filter((w): w is Workout => !!w).map((w) => [w.id, w]));
}

export async function exercisesById(ids?: string[]): Promise<Map<string, Exercise>> {
  const list = ids ? await db.exercises.bulkGet([...new Set(ids)]) : await db.exercises.toArray();
  return new Map(list.filter((e): e is Exercise => !!e).map((e) => [e.id, e]));
}

export interface WorkoutItem {
  we: WorkoutExercise;
  exercise: Exercise;
  sets: SetEntry[];
  lastTime: SetEntry[] | null;
}

export interface WorkoutView {
  workout: Workout;
  items: WorkoutItem[];
  prSetIds: Set<string>;
}

/** Everything the workout screen needs, including "last time" and live PR flags. */
export async function loadWorkoutView(id: string): Promise<WorkoutView | null> {
  const workout = await db.workouts.get(id);
  if (!workout) return null;
  const wes = (await db.workoutExercises.where('workoutId').equals(id).toArray()).sort((a, b) => a.order - b.order);
  const sets = await db.sets.where('workoutId').equals(id).toArray();
  const exerciseIds = wes.map((we) => we.exerciseId);
  const exercises = await exercisesById(exerciseIds);

  const history = await db.sets.where('exerciseId').anyOf(exerciseIds).toArray();
  const workouts = await workoutsById(history.map((s) => s.workoutId));
  const prSetIds = computePRSetIds(history, workouts);
  const logged = history.filter(isLogged);

  const items = wes.flatMap((we) => {
    const exercise = exercises.get(we.exerciseId);
    if (!exercise) return [];
    const last = pickLastSession(
      logged.filter((s) => s.exerciseId === we.exerciseId),
      workouts,
      workout,
    );
    return [{
      we,
      exercise,
      sets: sets.filter((s) => s.workoutExerciseId === we.id).sort((a, b) => a.order - b.order),
      lastTime: last?.sets ?? null,
    }];
  });
  return { workout, items, prSetIds };
}

/** Exercise ids from the most recent workouts, most recent first. */
export async function recentExerciseIds(limit = 8): Promise<string[]> {
  const workouts = (await db.workouts.toArray()).sort(byWorkoutKeyDesc).slice(0, 12);
  const wes = await db.workoutExercises.where('workoutId').anyOf(workouts.map((w) => w.id)).toArray();
  const rank = new Map(workouts.map((w, i) => [w.id, i]));
  wes.sort((a, b) => rank.get(a.workoutId)! - rank.get(b.workoutId)! || a.order - b.order);
  return [...new Set(wes.map((we) => we.exerciseId))].slice(0, limit);
}

export interface HistoryEntry {
  workout: Workout;
  exerciseNames: string[];
  setCount: number;
}

/** All workouts (newest first) with their exercise names. */
export async function loadHistory(): Promise<HistoryEntry[]> {
  const [workouts, wes, sets, exercises] = await Promise.all([
    db.workouts.toArray(),
    db.workoutExercises.toArray(),
    db.sets.toArray(),
    exercisesById(),
  ]);
  const wesBy = groupBy(wes, (we) => we.workoutId);
  const setCount = new Map<string, number>();
  for (const s of sets) if (isLogged(s)) setCount.set(s.workoutId, (setCount.get(s.workoutId) ?? 0) + 1);
  return workouts.sort(byWorkoutKeyDesc).map((workout) => ({
    workout,
    exerciseNames: (wesBy.get(workout.id) ?? [])
      .sort((a, b) => a.order - b.order)
      .map((we) => exercises.get(we.exerciseId)?.name ?? 'Unknown exercise'),
    setCount: setCount.get(workout.id) ?? 0,
  }));
}

export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
