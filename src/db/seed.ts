import type { DayType, Exercise } from './schema';

/** Bump when adding built-in exercises; missing ones are added on next launch. */
export const SEED_VERSION = 1;

const LIBRARY: Record<Exclude<DayType, 'other'>, string[]> = {
  push: [
    'Barbell Bench Press', 'Incline Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Dumbbell Press',
    'Machine Chest Press', 'Cable Fly', 'Pec Deck', 'Dips', 'Push-ups', 'Overhead Press',
    'Seated Dumbbell Shoulder Press', 'Machine Shoulder Press', 'Lateral Raise', 'Cable Lateral Raise',
    'Tricep Pushdown', 'Overhead Cable Tricep Extension', 'Skull Crushers', 'Close-Grip Bench Press',
  ],
  pull: [
    'Deadlift', 'Pull-ups', 'Chin-ups', 'Lat Pulldown', 'Barbell Row', 'Dumbbell Row', 'Seated Cable Row',
    'T-Bar Row', 'Chest-Supported Row', 'Straight-Arm Pulldown', 'Shrugs', 'Face Pull', 'Reverse Pec Deck',
    'Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Incline Dumbbell Curl', 'Preacher Curl', 'Cable Curl',
  ],
  legs: [
    'Back Squat', 'Front Squat', 'Hack Squat', 'Leg Press', 'Bulgarian Split Squat', 'Walking Lunges',
    'Leg Extension', 'Romanian Deadlift', 'Lying Leg Curl', 'Seated Leg Curl', 'Hip Thrust', 'Hip Abduction',
    'Standing Calf Raise', 'Seated Calf Raise',
  ],
  core: ['Hanging Leg Raise', 'Cable Crunch', 'Ab Wheel Rollout', 'Plank'],
};

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Built-ins get stable ids so backups and re-seeding never duplicate them. */
export function builtInExercises(now = Date.now()): Exercise[] {
  return Object.entries(LIBRARY).flatMap(([dayType, names]) =>
    names.map((name) => ({
      id: `builtin-${slug(name)}`,
      name,
      dayType: dayType as DayType,
      isCustom: false,
      videoUrl: null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })),
  );
}
