import { db, DEFAULT_SETTINGS, type DayType, type Exercise, type SetEntry, type Settings, type Workout, type WorkoutExercise, type WorkoutType } from './schema';
import { builtInExercises, SEED_VERSION } from './seed';
import { findPreviousSameType, getSettings, lastSessionSets } from './queries';
import { isLogged } from '../lib/stats';
import { uid } from '../lib/id';

// All writes go through this module. A future sync layer can hook in here.

type Undo = () => Promise<void>;

let setupPromise: Promise<void> | null = null;

/** Seeds the library and asks the browser to keep our storage. Safe to call repeatedly. */
export function ensureSetup(): Promise<void> {
  setupPromise ??= (async () => {
    await seedLibrary();
    try {
      if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
    } catch {
      // not supported – data still lives in IndexedDB
    }
  })();
  return setupPromise;
}

export async function seedLibrary() {
  await db.transaction('rw', db.exercises, db.settings, async () => {
    const settings = (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
    if (settings.seedVersion >= SEED_VERSION) return;
    const builtIns = builtInExercises();
    const existing = new Set((await db.exercises.bulkGet(builtIns.map((e) => e.id))).filter(Boolean).map((e) => e!.id));
    await db.exercises.bulkAdd(builtIns.filter((e) => !existing.has(e.id)));
    await db.settings.put({ ...settings, seedVersion: SEED_VERSION });
  });
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>) {
  await db.settings.put({ ...(await getSettings()), ...patch });
}

// ---------- Workouts ----------

const emptySet = (we: WorkoutExercise, order: number, now: number): SetEntry => ({
  id: uid(),
  workoutId: we.workoutId,
  workoutExerciseId: we.id,
  exerciseId: we.exerciseId,
  order,
  kg: null,
  reps: null,
  rpe: null,
  done: false,
  doneAt: null,
  restSeconds: null,
  updatedAt: now,
});

/** Creates a workout pre-filled with the exercises of the last workout of the same type. */
export async function startWorkout(opts: { type: WorkoutType; customName: string | null; date: string }): Promise<string> {
  const now = Date.now();
  const workout: Workout = {
    id: uid(),
    date: opts.date,
    type: opts.type,
    customName: opts.type === 'other' ? opts.customName?.trim() || 'Other' : null,
    notes: '',
    startedAt: now,
    finishedAt: null,
    restTimer: null,
    updatedAt: now,
  };
  const prev = await findPreviousSameType(workout);

  await db.transaction('rw', db.workouts, db.workoutExercises, db.sets, db.exercises, async () => {
    await db.workouts.add(workout);
    if (!prev) return;
    const prevWes = (await db.workoutExercises.where('workoutId').equals(prev.id).toArray()).sort((a, b) => a.order - b.order);
    const prevSets = await db.sets.where('workoutId').equals(prev.id).toArray();
    const exercises = await db.exercises.bulkGet(prevWes.map((we) => we.exerciseId));
    const newWes: WorkoutExercise[] = [];
    const newSets: SetEntry[] = [];
    prevWes.forEach((pwe, i) => {
      if (!exercises[i] || exercises[i]!.archived) return;
      const we: WorkoutExercise = { id: uid(), workoutId: workout.id, exerciseId: pwe.exerciseId, order: newWes.length, updatedAt: now };
      newWes.push(we);
      const count = Math.max(1, prevSets.filter((s) => s.workoutExerciseId === pwe.id && isLogged(s)).length);
      for (let n = 0; n < count; n++) newSets.push(emptySet(we, n, now));
    });
    await db.workoutExercises.bulkAdd(newWes);
    await db.sets.bulkAdd(newSets);
  });
  return workout.id;
}

export async function updateWorkout(id: string, patch: Partial<Pick<Workout, 'date' | 'notes' | 'customName'>>) {
  await db.workouts.update(id, { ...patch, updatedAt: Date.now() });
}

/** Saves a finished workout: drops unticked sets and exercises left without sets. */
export async function finishWorkout(id: string, finishedAt: number) {
  await stopRest(id);
  await db.transaction('rw', db.workouts, db.workoutExercises, db.sets, async () => {
    const sets = await db.sets.where('workoutId').equals(id).toArray();
    await db.sets.bulkDelete(sets.filter((s) => !isLogged(s)).map((s) => s.id));
    const kept = new Set(sets.filter(isLogged).map((s) => s.workoutExerciseId));
    const wes = await db.workoutExercises.where('workoutId').equals(id).toArray();
    await db.workoutExercises.bulkDelete(wes.filter((we) => !kept.has(we.id)).map((we) => we.id));
    await db.workouts.update(id, { finishedAt, restTimer: null, updatedAt: Date.now() });
  });
}

/** Marks every unticked set that has reps as done (used from the finish summary). */
export async function markFilledSetsDone(workoutId: string) {
  const now = Date.now();
  const sets = await db.sets.where('workoutId').equals(workoutId).toArray();
  await db.sets.bulkPut(
    sets.filter((s) => !s.done && (s.reps ?? 0) > 0).map((s) => ({ ...s, kg: s.kg ?? 0, done: true, doneAt: now, updatedAt: now })),
  );
}

export async function deleteWorkout(id: string): Promise<Undo> {
  return db.transaction('rw', db.workouts, db.workoutExercises, db.sets, async () => {
    const workout = await db.workouts.get(id);
    const wes = await db.workoutExercises.where('workoutId').equals(id).toArray();
    const sets = await db.sets.where('workoutId').equals(id).toArray();
    await db.sets.bulkDelete(sets.map((s) => s.id));
    await db.workoutExercises.bulkDelete(wes.map((we) => we.id));
    await db.workouts.delete(id);
    return async () => {
      await db.transaction('rw', db.workouts, db.workoutExercises, db.sets, async () => {
        if (workout) await db.workouts.put(workout);
        await db.workoutExercises.bulkPut(wes);
        await db.sets.bulkPut(sets);
      });
    };
  });
}

// ---------- Exercises within a workout ----------

export async function addExerciseToWorkout(workoutId: string, exerciseId: string) {
  const now = Date.now();
  const workout = await db.workouts.get(workoutId);
  if (!workout) return;
  const last = await lastSessionSets(exerciseId, workout);
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    const wes = await db.workoutExercises.where('workoutId').equals(workoutId).toArray();
    const order = wes.reduce((max, we) => Math.max(max, we.order + 1), 0);
    const we: WorkoutExercise = { id: uid(), workoutId, exerciseId, order, updatedAt: now };
    await db.workoutExercises.add(we);
    const count = Math.max(1, last?.sets.length ?? 1);
    await db.sets.bulkAdd(Array.from({ length: count }, (_, n) => emptySet(we, n, now)));
  });
}

export async function removeWorkoutExercise(weId: string): Promise<Undo> {
  return db.transaction('rw', db.workoutExercises, db.sets, async () => {
    const we = await db.workoutExercises.get(weId);
    const sets = await db.sets.where('workoutExerciseId').equals(weId).toArray();
    await db.sets.bulkDelete(sets.map((s) => s.id));
    await db.workoutExercises.delete(weId);
    return async () => {
      await db.transaction('rw', db.workoutExercises, db.sets, async () => {
        if (we) await db.workoutExercises.put(we);
        await db.sets.bulkPut(sets);
      });
    };
  });
}

export async function moveWorkoutExercise(weId: string, direction: -1 | 1) {
  await db.transaction('rw', db.workoutExercises, async () => {
    const we = await db.workoutExercises.get(weId);
    if (!we) return;
    const list = (await db.workoutExercises.where('workoutId').equals(we.workoutId).toArray()).sort((a, b) => a.order - b.order);
    const i = list.findIndex((x) => x.id === weId);
    const j = i + direction;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const now = Date.now();
    await db.workoutExercises.bulkPut(list.map((x, order) => ({ ...x, order, updatedAt: now })));
  });
}

// ---------- Sets ----------

/** Adds a set pre-filled with the previous set's kg and reps. */
export async function addSet(weId: string, opts: { markDone: boolean }) {
  const now = Date.now();
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    const we = await db.workoutExercises.get(weId);
    if (!we) return;
    const sets = (await db.sets.where('workoutExerciseId').equals(weId).toArray()).sort((a, b) => a.order - b.order);
    const prev = sets[sets.length - 1];
    const set = emptySet(we, prev ? prev.order + 1 : 0, now);
    set.kg = prev?.kg ?? null;
    set.reps = prev?.reps ?? null;
    if (opts.markDone && (set.reps ?? 0) > 0) {
      set.done = true;
      set.doneAt = now;
    }
    await db.sets.add(set);
  });
}

export async function updateSet(id: string, patch: Partial<Pick<SetEntry, 'kg' | 'reps' | 'rpe' | 'done' | 'restSeconds'>>) {
  await db.sets.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteSet(id: string): Promise<Undo> {
  const set = await db.sets.get(id);
  await db.sets.delete(id);
  return async () => {
    if (set) await db.sets.put(set);
  };
}

/**
 * Ticks a set. Empty fields take the suggested values (last time's numbers).
 * Ticking also stops a running rest stopwatch.
 */
export async function completeSet(id: string, fallback: { kg: number | null; reps: number | null }): Promise<boolean> {
  const now = Date.now();
  return db.transaction('rw', db.sets, db.workouts, async () => {
    const set = await db.sets.get(id);
    const reps = set?.reps ?? fallback.reps;
    if (!set || !reps) return false;
    await stopRestInTx(set.workoutId, now);
    await db.sets.update(id, { kg: set.kg ?? fallback.kg ?? 0, reps, done: true, doneAt: now, updatedAt: now });
    return true;
  });
}

export async function uncompleteSet(id: string) {
  await db.sets.update(id, { done: false, doneAt: null, updatedAt: Date.now() });
}

// ---------- Rest stopwatch (timestamp based, survives app switches) ----------

export async function startRest(workoutId: string) {
  const now = Date.now();
  await db.transaction('rw', db.sets, db.workouts, async () => {
    const sets = await db.sets.where('workoutId').equals(workoutId).toArray();
    const lastDone = sets.filter((s) => s.done && s.doneAt).sort((a, b) => b.doneAt! - a.doneAt!)[0];
    await db.workouts.update(workoutId, { restTimer: { startedAt: now, setId: lastDone?.id ?? null }, updatedAt: now });
  });
}

export async function stopRest(workoutId: string) {
  await db.transaction('rw', db.sets, db.workouts, () => stopRestInTx(workoutId, Date.now()));
}

async function stopRestInTx(workoutId: string, now: number) {
  const workout = await db.workouts.get(workoutId);
  const timer = workout?.restTimer;
  if (!timer) return;
  if (timer.setId) {
    await db.sets.update(timer.setId, { restSeconds: Math.round((now - timer.startedAt) / 1000), updatedAt: now });
  }
  await db.workouts.update(workoutId, { restTimer: null, updatedAt: now });
}

// ---------- Exercise library ----------

/** Adds a custom exercise, or revives/reuses one with the same name. */
export async function createExercise(name: string, dayType: DayType): Promise<string> {
  const clean = name.trim().replace(/\s+/g, ' ');
  const now = Date.now();
  const existing = (await db.exercises.toArray()).find((e) => e.name.toLowerCase() === clean.toLowerCase());
  if (existing) {
    if (existing.archived) await db.exercises.update(existing.id, { archived: false, updatedAt: now });
    return existing.id;
  }
  const exercise: Exercise = {
    id: uid(),
    name: clean,
    dayType,
    isCustom: true,
    videoUrl: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.exercises.add(exercise);
  return exercise.id;
}

export async function updateExercise(id: string, patch: Partial<Pick<Exercise, 'name' | 'dayType' | 'videoUrl' | 'archived'>>) {
  await db.exercises.update(id, { ...patch, updatedAt: Date.now() });
}
