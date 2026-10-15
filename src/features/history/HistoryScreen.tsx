import { useLiveQuery } from 'dexie-react-hooks';
import { loadHistory, groupBy } from '../../db/queries';
import { navigate } from '../../router';
import { DayBadge, EmptyState, PageHeader } from '../../ui/layout';
import { Icon } from '../../ui/Icon';
import { formatDate, startOfWeekISO, weekLabel } from '../../lib/dates';
import { plural, workoutTitle } from '../../lib/format';

export function HistoryScreen() {
  const entries = useLiveQuery(loadHistory);
  if (!entries) return <div className="screen has-tabs" />;

  const weeks = [...groupBy(entries, (e) => startOfWeekISO(e.workout.date))];

  return (
    <div className="screen has-tabs">
      <PageHeader title="History" sub={entries.length ? plural(entries.length, 'workout') : undefined} />

      {entries.length === 0 && (
        <EmptyState icon="history" title="No workouts yet" text="Finished workouts appear here, grouped by week. Tap one to view or fix it.">
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/new')}>
            Start a workout
          </button>
        </EmptyState>
      )}

      {weeks.map(([weekStart, list]) => (
        <section key={weekStart} className="section">
          <div className="section-head">
            <h2 className="section-title">{weekLabel(weekStart)}</h2>
            <span className="section-meta">{plural(list.length, 'workout')}</span>
          </div>
          <div className="history-list">
            {list.map(({ workout, exerciseNames, setCount }) => (
              <button key={workout.id} className={`card history-item day-edge-${workout.type}`} onClick={() => navigate(`/workout/${workout.id}`)}>
                <div className="history-top">
                  <span className="history-date">{formatDate(workout.date)}</span>
                  <DayBadge type={workout.type} label={workoutTitle(workout)} />
                  {workout.finishedAt === null && <span className="flag flag-live">In progress</span>}
                  <span className="edit-pill">
                    <Icon name="edit" size={16} /> {workout.finishedAt === null ? 'Open' : 'Edit'}
                  </span>
                </div>
                <p className="history-exercises">{exerciseNames.length ? exerciseNames.join(' · ') : 'No exercises'}</p>
                <p className="history-meta">
                  {plural(exerciseNames.length, 'exercise')} · {plural(setCount, 'set')}
                </p>
                {workout.notes && <p className="history-notes">“{workout.notes}”</p>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
