import Dexie, { type Table } from 'dexie';

/** Tag on an exercise. "core" exercises are offered on every day. */
export type DayType = 'push' | 'pull' | 'legs' | 'core' | 'other';
export type WorkoutType = 'push' | 'pull' | 'legs' | 'other';

// Every record has a string id and updatedAt so a cloud sync (e.g. Supabase) can be added later.

export interface Exercise {
  id: string;
  name: string;
  dayType: DayType;
  isCustom: boolean;
  videoUrl: string | null;
  /** Removed from the library; history is kept. */
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RestTimer {
  startedAt: number;
  /** The set the rest is recorded on when the stopwatch stops. */
  setId: string | null;
}

export interface Workout {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  type: WorkoutType;
  /** Name for "other" workouts, e.g. "Arms". */
  customName: string | null;
  notes: string;
  startedAt: number;
  /** null while the workout is in progress. */
  finishedAt: number | null;
  restTimer: RestTimer | null;
  updatedAt: number;
}

/** An exercise slot within a workout (keeps order even before any set is logged). */
export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  order: number;
  updatedAt: number;
}

export interface SetEntry {
  id: string;
  workoutId: string;
  workoutExerciseId: string;
  exerciseId: string;
  order: number;
  kg: number | null;
  reps: number | null;
  rpe: number | null;
  done: boolean;
  doneAt: number | null;
  restSeconds: number | null;
  updatedAt: number;
}

export interface Settings {
  id: 'app';
  restSoundEnabled: boolean;
  restSoundSeconds: number;
  seedVersion: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  restSoundEnabled: false,
  restSoundSeconds: 120,
  seedVersion: 0,
};

class LiftLogDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  workoutExercises!: Table<WorkoutExercise, string>;
  sets!: Table<SetEntry, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('liftlog');
    this.version(1).stores({
      exercises: 'id, name, dayType',
      workouts: 'id, date, type, startedAt',
      workoutExercises: 'id, workoutId, exerciseId',
      sets: 'id, workoutId, workoutExerciseId, exerciseId',
      settings: 'id',
    });
  }
}

export const db = new LiftLogDB();
