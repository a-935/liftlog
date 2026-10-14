import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { db, type Exercise, type SetEntry, type Workout } from '../../db/schema';
import { exercisesById, groupBy, workoutsById } from '../../db/queries';
import { navigate } from '../../router';
import { EmptyState, PageHeader } from '../../ui/layout';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { CompareView } from './CompareView';
import { matches } from '../exercises/ExercisePicker';
import { daysBetween, formatDate, formatDay, todayISO } from '../../lib/dates';
import { formatKg, formatSet, plural, workoutTitle } from '../../lib/format';
import { byWorkoutKeyDesc, computePRSetIds, estimate1RM, isLogged, sortSetsChrono, topSet, workoutKey, type TopSet } from '../../lib/stats';
import { haptic } from '../../lib/haptics';

export function ProgressScreen({ tab, id }: { tab: 'exercise' | 'compare'; id?: string }) {
  return (
    <div className="screen has-tabs">
      <PageHeader title="Progress" />
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={tab === 'exercise'} className={tab === 'exercise' ? 'active' : ''} onClick={() => navigate('/progress/exercise', { replace: true })}>
          Exercise
        </button>
        <button role="tab" aria-selected={tab === 'compare'} className={tab === 'compare' ? 'active' : ''} onClick={() => navigate('/progress/compare', { replace: true })}>
          vs last same day
        </button>
      </div>
      {tab === 'exercise' ? <ExerciseProgress exerciseId={id} /> : <CompareTab workoutId={id} />}
    </div>
  );
}

// ---------- A) Exercise progress ----------

interface TrainedExercise {
  exercise: Exercise;
  sessions: number;
  lastKey: string;
}

async function loadTrainedExercises(): Promise<TrainedExercise[]> {
  const sets = (await db.sets.toArray()).filter(isLogged);
  const workouts = await workoutsById(sets.map((s) => s.workoutId));
  const exercises = await exercisesById(sets.map((s) => s.exerciseId));
  return [...groupBy(sets, (s) => s.exerciseId)]
    .flatMap(([exerciseId, list]) => {
      const exercise = exercises.get(exerciseId);
      if (!exercise) return [];
      const ws = [...new Set(list.map((s) => s.workoutId))].map((wid) => workouts.get(wid)).filter((w): w is Workout => !!w);
      if (!ws.length) return [];
      return [{ exercise, sessions: ws.length, lastKey: ws.map(workoutKey).sort().at(-1)! }];
    })
    .sort((a, b) => (a.lastKey < b.lastKey ? 1 : -1));
}

interface Session {
  workout: Workout;
  sets: SetEntry[];
  top: TopSet;
  hasPR: boolean;
}

async function loadExerciseSessions(exerciseId: string): Promise<Session[]> {
  const sets = (await db.sets.where('exerciseId').equals(exerciseId).toArray()).filter(isLogged);
  const workouts = await workoutsById(sets.map((s) => s.workoutId));
  const prs = computePRSetIds(sets, workouts);
  const sorted = sortSetsChrono(sets, workouts);
  return [...groupBy(sorted, (s) => s.workoutId)].flatMap(([wid, list]) => {
    const workout = workouts.get(wid);
    return workout ? [{ workout, sets: list, top: topSet(list)!, hasPR: list.some((s) => prs.has(s.id)) }] : [];
  });
}

function ExerciseProgress({ exerciseId }: { exerciseId?: string }) {
  const trained = useLiveQuery(loadTrainedExercises);
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedId = exerciseId ?? trained?.[0]?.exercise.id;
  const sessions = useLiveQuery(async () => (selectedId ? loadExerciseSessions(selectedId) : []), [selectedId]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  if (!trained) return null;
  if (!trained.length) {
    return <EmptyState icon="chart" title="No progress yet" text="Log a couple of workouts and your lifts will be charted here, PRs and all." />;
  }

  const current = trained.find((t) => t.exercise.id === selectedId);

  return (
    <>
      <button
        className="select-btn"
        onClick={() => {
          haptic();
          setPickerOpen(true);
        }}
      >
        <span className="select-label">Exercise</span>
        <span className="select-value">{current?.exercise.name ?? 'Choose exercise'}</span>
        <Icon name="search" size={20} />
      </button>

      {sessions && current && (
        <ExerciseChart
          key={current.exercise.id}
          sessions={sessions}
          selectedId={selectedSession}
          onSelect={setSelectedSession}
        />
      )}

      <ExerciseSelectSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        trained={trained}
        onPick={(id) => {
          setSelectedSession(null);
          navigate(`/progress/exercise/${id}`, { replace: true });
        }}
      />
    </>
  );
}

/** Evenly spaced round axis ticks (e.g. 50, 55, 60…) with some headroom around the data. */
function niceTicks(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, max * 0.1, 4);
  const step = [1, 2, 2.5, 5, 10, 20, 25, 50, 100].find((s) => range / s <= 4) ?? 200;
  const lo = Math.max(0, Math.floor((min - range * 0.15) / step) * step);
  const hi = Math.ceil((max + range * 0.15) / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}

function ExerciseChart({ sessions, selectedId, onSelect }: { sessions: Session[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (!sessions.length) return <EmptyState icon="chart" title="No sets logged" text="This exercise has no logged sets yet." />;

  const bodyweight = sessions.every((s) => s.top.kg === 0);
  const data = sessions.map((s, index) => ({
    index,
    id: s.workout.id,
    label: formatDay(s.workout.date),
    value: bodyweight ? s.top.reps : s.top.kg,
    pr: s.hasPR,
  }));
  const selected = sessions.find((s) => s.workout.id === selectedId) ?? sessions[sessions.length - 1];
  const ticks = niceTicks(data.map((d) => d.value));

  const allSets = sessions.flatMap((s) => s.sets);
  const best = topSet(allSets)!;
  const bestSet = bodyweight
    ? best
    : allSets.reduce<TopSet>((b, s) => {
        const kg = s.kg ?? 0;
        const reps = s.reps ?? 0;
        return estimate1RM(kg, reps) > estimate1RM(b.kg, b.reps) ? { kg, reps } : b;
      }, { kg: 0, reps: 0 });
  const last = sessions[sessions.length - 1];
  const daysSince = daysBetween(last.workout.date, todayISO());

  return (
    <>
      <div className="card chart-card">
        <div className="chart-head">
          <span className="card-label">{bodyweight ? 'Top set reps' : 'Top set kg'} per session</span>
          <span className="legend">
            <span className="legend-dot pr" /> PR
          </span>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-3)', fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis
                tick={{ fill: 'var(--text-3)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={44}
                ticks={ticks}
                domain={[ticks[0], ticks[ticks.length - 1]]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={3}
                isAnimationActive
                animationDuration={500}
                activeDot={false}
                dot={(props: { cx?: number; cy?: number; index?: number; payload?: (typeof data)[number] }) => {
                  const { cx = 0, cy = 0, payload } = props;
                  if (!payload) return <g key={props.index} />;
                  const isSelected = payload.id === selected.workout.id;
                  return (
                    <g key={payload.id} className="chart-dot" onClick={() => onSelect(payload.id)}>
                      <circle cx={cx} cy={cy} r={22} fill="transparent" />
                      {isSelected && <circle cx={cx} cy={cy} r={11} fill="none" stroke="var(--text)" strokeWidth={2} />}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={payload.pr ? 7 : 5}
                        fill={payload.pr ? 'var(--gold)' : 'var(--accent)'}
                        stroke="var(--surface)"
                        strokeWidth={2}
                      />
                    </g>
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="hint center">Tap a point to see that session</p>
      </div>

      <div className="card session-card">
        <div className="session-head">
          <span className="session-date">{formatDate(selected.workout.date)}</span>
          <span className="muted">{workoutTitle(selected.workout)}</span>
          {selected.hasPR && <span className="pr-chip">🏆 PR</span>}
        </div>
        <p className="session-sets">{selected.sets.map((s) => formatSet(s.kg, s.reps) + (s.rpe ? ` @${s.rpe}` : '')).join(' · ')}</p>
        <button className="btn btn-secondary btn-block" onClick={() => navigate(`/workout/${selected.workout.id}`)}>
          Open workout
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-value">{bodyweight ? `${best.reps}` : `${formatKg(best.kg)}`}</span>
          <span className="stat-label">{bodyweight ? 'Most reps' : 'Best weight kg'}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatSet(bestSet.kg, bestSet.reps)}</span>
          <span className="stat-label">{bodyweight ? 'Best set' : `Best set · e1RM ${formatKg(Math.round(estimate1RM(bestSet.kg, bestSet.reps)))}`}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{sessions.length}</span>
          <span className="stat-label">{sessions.length === 1 ? 'Session' : 'Sessions'}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{daysSince <= 0 ? 'Today' : daysSince}</span>
          <span className="stat-label">{daysSince <= 0 ? 'Last done' : daysSince === 1 ? 'Day since last' : 'Days since last'}</span>
        </div>
      </div>
    </>
  );
}

function ExerciseSelectSheet({ open, onClose, trained, onPick }: { open: boolean; onClose: () => void; trained: TrainedExercise[]; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const list = trained.filter((t) => matches(t.exercise.name, query));
  return (
    <Sheet open={open} onClose={onClose} full>
      <div className="picker">
        <div className="picker-top">
          <label className="search">
            <Icon name="search" size={20} />
            <input type="search" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search exercises" autoComplete="off" />
          </label>
          <button className="btn btn-secondary picker-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="picker-list">
          <h3 className="picker-section-title">Exercises you've logged</h3>
          {list.map((t) => (
            <button
              key={t.exercise.id}
              className="picker-row"
              onClick={() => {
                haptic();
                onPick(t.exercise.id);
                onClose();
                setQuery('');
              }}
            >
              <span className="picker-name">{t.exercise.name}</span>
              <span className="muted">{plural(t.sessions, 'session')}</span>
            </button>
          ))}
          {list.length === 0 && <p className="muted pad">No logged exercise matches “{query}”.</p>}
        </div>
      </div>
    </Sheet>
  );
}

// ---------- B) Compare with the last workout of the same type ----------

function CompareTab({ workoutId }: { workoutId?: string }) {
  const workouts = useLiveQuery(async () => (await db.workouts.toArray()).sort(byWorkoutKeyDesc));
  if (!workouts) return null;
  const finished = workouts.filter((w) => w.finishedAt !== null || w.id === workoutId);
  if (finished.length < 2) {
    return <EmptyState icon="compare" title="Nothing to compare yet" text="After two workouts of the same type (e.g. two Pull days) you'll see them side by side here." />;
  }
  const selected = workoutId ?? finished[0].id;
  return (
    <>
      <label className="select-btn">
        <span className="select-label">Workout</span>
        <select value={selected} onChange={(e) => navigate(`/progress/compare/${e.target.value}`, { replace: true })} aria-label="Workout to compare">
          {finished.map((w) => (
            <option key={w.id} value={w.id}>
              {workoutTitle(w)} · {formatDate(w.date)}
            </option>
          ))}
        </select>
        <Icon name="down" size={20} />
      </label>
      <CompareView workoutId={selected} />
    </>
  );
}
