import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkoutType } from '../../db/schema';
import { getActiveWorkout, groupBy } from '../../db/queries';
import { startWorkout } from '../../db/repo';
import { navigate } from '../../router';
import { TopBar } from '../../ui/layout';
import { Icon } from '../../ui/Icon';
import { formatDate, relativeDate, todayISO } from '../../lib/dates';
import { DAY_LABEL, plural } from '../../lib/format';
import { byWorkoutKeyDesc } from '../../lib/stats';
import { haptic } from '../../lib/haptics';

const TYPES: WorkoutType[] = ['push', 'pull', 'legs'];

async function loadLastByType() {
  const finished = (await db.workouts.toArray()).filter((w) => w.finishedAt !== null).sort(byWorkoutKeyDesc);
  const wes = groupBy(await db.workoutExercises.toArray(), (we) => we.workoutId);
  const last = new Map<WorkoutType, { date: string; exercises: number }>();
  for (const w of finished) {
    if (w.type !== 'other' && !last.has(w.type)) last.set(w.type, { date: w.date, exercises: wes.get(w.id)?.length ?? 0 });
  }
  const otherNames = [...new Set(finished.filter((w) => w.type === 'other' && w.customName).map((w) => w.customName!))].slice(0, 6);
  return { last, otherNames };
}

export function NewWorkoutScreen() {
  const data = useLiveQuery(loadLastByType);
  const [date, setDate] = useState(todayISO());
  const [otherOpen, setOtherOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async (type: WorkoutType, customName: string | null = null) => {
    if (busy) return;
    haptic();
    setBusy(true);
    // only one workout can be in progress
    const active = await getActiveWorkout();
    const id = active?.id ?? (await startWorkout({ type, customName, date }));
    navigate(`/workout/${id}`, { replace: true });
  };

  return (
    <div className="screen new-screen">
      <TopBar title="New workout" back={() => navigate('/')} />

      <label className="date-row">
        <Icon name="calendar" size={20} />
        <span className="date-row-label">Date</span>
        <span className="date-row-value">{date === todayISO() ? `Today · ${formatDate(date)}` : formatDate(date)}</span>
        <span className="link-btn">Change</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Workout date" />
      </label>

      <h2 className="choose-title">What are you training?</h2>

      <div className="type-grid">
        {TYPES.map((type) => {
          const last = data?.last.get(type);
          return (
            <button key={type} className={`type-btn day-${type}`} onClick={() => start(type)} disabled={busy}>
              <span className="type-name">{DAY_LABEL[type]}</span>
              <span className="type-sub">
                {last ? `Last: ${relativeDate(last.date)} · ${plural(last.exercises, 'exercise')}` : 'Starts empty'}
              </span>
            </button>
          );
        })}
        <button className={`type-btn day-other${otherOpen ? ' open' : ''}`} onClick={() => setOtherOpen(true)} disabled={busy}>
          <span className="type-name">Other</span>
          <span className="type-sub">Name it yourself, e.g. Arms</span>
        </button>
      </div>

      {otherOpen && (
        <form
          className="card other-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void start('other', name.trim());
          }}
        >
          <label className="field-label" htmlFor="other-name">
            Workout name
          </label>
          <input
            id="other-name"
            className="text-input"
            placeholder="e.g. Arms"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            autoComplete="off"
            enterKeyHint="go"
          />
          {!!data?.otherNames.length && (
            <div className="chips">
              {data.otherNames.map((n) => (
                <button type="button" key={n} className="chip" onClick={() => setName(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!name.trim() || busy}>
            Start {name.trim() || 'workout'}
          </button>
        </form>
      )}
    </div>
  );
}
