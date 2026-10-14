import { utils, write } from 'xlsx';
import { db } from '../db/schema';
import { exercisesById, groupBy } from '../db/queries';
import { formatClock, workoutTitle } from './format';
import { isLogged, workoutKey } from './stats';
import { todayISO } from './dates';
import { saveFile } from './files';

/** One row per logged set, oldest first. */
export async function exportToExcel(): Promise<number> {
  const [workouts, wes, sets, exercises] = await Promise.all([
    db.workouts.toArray(),
    db.workoutExercises.toArray(),
    db.sets.toArray(),
    exercisesById(),
  ]);
  const setsByWe = groupBy(sets.filter(isLogged), (s) => s.workoutExerciseId);
  const wesByWorkout = groupBy(wes, (we) => we.workoutId);

  const rows: (string | number | null)[][] = [
    ['Date', 'Workout', 'Exercise', 'Set #', 'kg', 'Reps', 'RPE', 'Rest', 'Notes'],
  ];
  for (const w of workouts.sort((a, b) => (workoutKey(a) < workoutKey(b) ? -1 : 1))) {
    for (const we of (wesByWorkout.get(w.id) ?? []).sort((a, b) => a.order - b.order)) {
      const name = exercises.get(we.exerciseId)?.name ?? 'Unknown exercise';
      (setsByWe.get(we.id) ?? [])
        .sort((a, b) => a.order - b.order)
        .forEach((s, i) => {
          rows.push([
            w.date,
            workoutTitle(w),
            name,
            i + 1,
            s.kg ?? 0,
            s.reps,
            s.rpe,
            s.restSeconds != null ? formatClock(s.restSeconds) : null,
            w.notes || null,
          ]);
        });
    }
  }

  const sheet = utils.aoa_to_sheet(rows);
  sheet['!cols'] = [12, 12, 30, 6, 8, 6, 6, 8, 40].map((wch) => ({ wch }));
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, 'Sets');
  const data = write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await saveFile(blob, `liftlog-${todayISO()}.xlsx`);
  return rows.length - 1;
}
