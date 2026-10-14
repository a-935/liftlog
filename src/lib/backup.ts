import { db, type Exercise, type SetEntry, type Settings, type Workout, type WorkoutExercise } from '../db/schema';
import { seedLibrary } from '../db/repo';
import { todayISO } from './dates';
import { saveFile } from './files';

const FORMAT = 'liftlog-backup';

interface Backup {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  sets: SetEntry[];
  settings: Settings[];
}

export async function downloadBackup() {
  const backup: Backup = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    workouts: await db.workouts.toArray(),
    workoutExercises: await db.workoutExercises.toArray(),
    sets: await db.sets.toArray(),
    settings: await db.settings.toArray(),
  };
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  await saveFile(blob, `liftlog-backup-${todayISO()}.json`);
}

export interface BackupSummary {
  backup: Backup;
  workouts: number;
  sets: number;
  exportedAt: string;
}

/** Parses and validates a backup file without touching the database. */
export async function readBackup(file: File): Promise<BackupSummary> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a valid backup (not JSON).");
  }
  const b = data as Partial<Backup>;
  const arrays = [b.exercises, b.workouts, b.workoutExercises, b.sets] as unknown[];
  if (b?.format !== FORMAT || arrays.some((a) => !Array.isArray(a))) {
    throw new Error("That file isn't a LiftLog backup.");
  }
  const backup = { ...b, settings: Array.isArray(b.settings) ? b.settings : [] } as Backup;
  return { backup, workouts: backup.workouts.length, sets: backup.sets.length, exportedAt: backup.exportedAt };
}

/** Replaces all local data with the backup. */
export async function restoreBackup(backup: Backup) {
  await db.transaction('rw', [db.exercises, db.workouts, db.workoutExercises, db.sets, db.settings], async () => {
    await Promise.all([db.exercises.clear(), db.workouts.clear(), db.workoutExercises.clear(), db.sets.clear(), db.settings.clear()]);
    await db.exercises.bulkPut(backup.exercises);
    await db.workouts.bulkPut(backup.workouts);
    await db.workoutExercises.bulkPut(backup.workoutExercises);
    await db.sets.bulkPut(backup.sets);
    await db.settings.bulkPut(backup.settings);
  });
  await seedLibrary();
}
