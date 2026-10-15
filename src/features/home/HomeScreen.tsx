import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { exercisesById, groupBy } from '../../db/queries';
import { navigate } from '../../router';
import { DayBadge, EmptyState, PageHeader, Section } from '../../ui/layout';
import { Icon } from '../../ui/Icon';
import { addDaysISO, formatLongDate, relativeDate, startOfWeekISO, todayISO } from '../../lib/dates';
import { formatDuration, formatSet, plural, workoutTitle } from '../../lib/format';
import { byWorkoutKeyDesc, computePRSetIds, topSet } from '../../lib/stats';
import { useNow } from '../../lib/hooks';
import { haptic } from '../../lib/haptics';

async function loadHome() {
  const [workouts, wes, sets] = await Promise.all([db.workouts.toArray(), db.workoutExercises.toArray(), db.sets.toArray()]);
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const weekStart = startOfWeekISO(todayISO());
  const weekEnd = addDaysISO(weekStart, 6);
  const inWeek = (date: string) => date >= weekStart && date <= weekEnd;
  const finished = workouts.filter((w) => w.finishedAt !== null).sort(byWorkoutKeyDesc);

  const prIds = computePRSetIds(sets, byId);
  const weekPRSets = sets.filter((s) => prIds.has(s.id) && inWeek(byId.get(s.workoutId)!.date));
  const exercises = await exercisesById(weekPRSets.map((s) => s.exerciseId));
  const prs = [...groupBy(weekPRSets, (s) => s.exerciseId)].map(([exerciseId, list]) => ({
    name: exercises.get(exerciseId)?.name ?? 'Exercise',
    best: topSet(list)!,
  }));
  const prCount = weekPRSets.length;

  const exerciseCount = new Map<string, number>();
  for (const [workoutId, list] of groupBy(wes, (we) => we.workoutId)) exerciseCount.set(workoutId, list.length);

  return {
    active: workouts.find((w) => w.finishedAt === null) ?? null,
    weekCount: finished.filter((w) => inWeek(w.date)).length,
    prs,
    prCount,
    recent: finished.slice(0, 5).map((w) => ({ workout: w, exercises: exerciseCount.get(w.id) ?? 0 })),
    total: finished.length,
  };
}

export function HomeScreen() {
  const data = useLiveQuery(loadHome);
  const now = useNow(30_000);
  if (!data) return <div className="screen" />;
  const { active, weekCount, prs, prCount, recent, total } = data;

  return (
    <div className="screen has-tabs has-dock-tabs">
      <PageHeader sub={formatLongDate(todayISO())} title="LiftLog" />

      <section className="card week-card">
        <h2 className="card-label">This week</h2>
        <div className="week-stats">
          <div className="stat-inline">
            <span className="big-number">{weekCount}</span>
            <span className="stat-label">{weekCount === 1 ? 'workout' : 'workouts'}</span>
          </div>
          <div className="stat-inline">
            <span className="big-number gold">{prCount}</span>
            <span className="stat-label">{prCount === 1 ? 'new PR' : 'new PRs'} 🏆</span>
          </div>
        </div>
        {prs.length > 0 && (
          <ul className="week-prs">
            {prs.slice(0, 4).map((p) => (
              <li key={p.name}>
                <span>{p.name}</span>
                <strong>{formatSet(p.best.kg, p.best.reps)}</strong>
              </li>
            ))}
            {prs.length > 4 && <li className="muted">+{prs.length - 4} more</li>}
          </ul>
        )}
      </section>

      {total === 0 && !active ? (
        <EmptyState icon="plus" title="Ready for your first workout?" text="Tap New workout below. Next time, your exercises will be pre-filled from the last session of the same day." />
      ) : (
        <Section
          title="Recent workouts"
          action={
            total > 0 && (
              <button className="link-btn" onClick={() => navigate('/history')}>
                See all
              </button>
            )
          }
        >
          {recent.length === 0 && <p className="muted pad">Your finished workouts will show up here.</p>}
          <div className="list">
            {recent.map(({ workout, exercises }) => (
              <button key={workout.id} className="list-row" onClick={() => navigate(`/workout/${workout.id}`)}>
                <DayBadge type={workout.type} label={workoutTitle(workout)} />
                <span className="list-main">
                  <span className="list-title">{relativeDate(workout.date)}</span>
                  <span className="list-sub">{plural(exercises, 'exercise')}</span>
                </span>
                <span className="edit-pill">
                  <Icon name="edit" size={16} /> Edit
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <div className="dock dock-above-tabs">
        {active ? (
          <button
            className="btn btn-primary btn-xl btn-block"
            onClick={() => {
              haptic();
              navigate(`/workout/${active.id}`);
            }}
          >
            <Icon name="play" /> Resume {workoutTitle(active)} · {formatDuration(now - active.startedAt)}
          </button>
        ) : (
          <button
            className="btn btn-primary btn-xl btn-block"
            onClick={() => {
              haptic();
              navigate('/new');
            }}
          >
            <Icon name="plus" stroke={2.6} /> New workout
          </button>
        )}
      </div>
    </div>
  );
}
