import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadWorkoutView } from '../../db/queries';
import { deleteWorkout, finishWorkout, markFilledSetsDone } from '../../db/repo';
import { navigate } from '../../router';
import { TopBar, Section } from '../../ui/layout';
import { useToast } from '../../ui/feedback';
import { CompareView } from '../progress/CompareView';
import { formatDuration, formatNumber, formatSet, plural, workoutTitle } from '../../lib/format';
import { isLogged } from '../../lib/stats';
import { haptic } from '../../lib/haptics';

export function SummaryScreen({ id }: { id: string }) {
  const [endAt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const view = useLiveQuery(() => loadWorkoutView(id), [id]);
  const toast = useToast();

  useEffect(() => {
    if (view === null) navigate('/', { replace: true });
  }, [view]);

  if (!view) return <div className="screen" />;

  const { workout, items, prSetIds } = view;
  const finished = workout.finishedAt !== null;
  const allSets = items.flatMap((i) => i.sets);
  const logged = allSets.filter(isLogged);
  const unticked = allSets.filter((s) => !s.done && (s.reps ?? 0) > 0).length;
  const volume = logged.reduce((sum, s) => sum + (s.kg ?? 0) * (s.reps ?? 0), 0);
  const prs = items.flatMap((i) => {
    const sets = i.sets.filter((s) => prSetIds.has(s.id) && isLogged(s));
    return sets.length ? [{ name: i.exercise.name, sets }] : [];
  });
  const prCount = prs.reduce((n, p) => n + p.sets.length, 0);
  const duration = (workout.finishedAt ?? endAt) - workout.startedAt;

  const save = async () => {
    haptic();
    setSaving(true);
    await finishWorkout(id, endAt);
    navigate('/', { replace: true });
    toast({ message: 'Workout saved 💪' });
  };

  const discardEmpty = async () => {
    const undo = await deleteWorkout(id);
    navigate('/', { replace: true });
    toast({ message: 'Workout discarded', undo });
  };

  return (
    <div className="screen summary-screen has-dock">
      <TopBar
        title={finished ? 'Workout summary' : 'Finish workout'}
        subtitle={workoutTitle(workout)}
        back={() => navigate(finished ? '/history' : `/workout/${id}`)}
      />

      <div className={`summary-hero${prs.length ? ' has-prs' : ''}`}>
        <div className="summary-emoji" aria-hidden="true">
          {prs.length ? '🏆' : '💪'}
        </div>
        <h2>{prs.length ? plural(prCount, 'new PR') + '!' : logged.length ? 'Nice work' : 'Nothing logged yet'}</h2>
      </div>

      <div className="stat-grid three">
        <div className="stat">
          <span className="stat-value">{formatDuration(duration)}</span>
          <span className="stat-label">Duration</span>
        </div>
        <div className="stat">
          <span className="stat-value">{logged.length}</span>
          <span className="stat-label">Sets</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatNumber(Math.round(volume))}</span>
          <span className="stat-label">Volume kg</span>
        </div>
      </div>

      {unticked > 0 && !finished && (
        <div className="card notice">
          <p>
            {plural(unticked, 'set')} with reps {unticked === 1 ? "isn't" : "aren't"} ticked and won't be saved.
          </p>
          <button className="btn btn-secondary btn-lg btn-block" onClick={() => markFilledSetsDone(id)}>
            Count {unticked === 1 ? 'it' : 'them'} as done
          </button>
        </div>
      )}

      {prs.length > 0 && (
        <Section title="Personal records">
          <div className="card pr-list">
            {prs.map((p) => (
              <div key={p.name} className="pr-row">
                <span className="pr-name">🏆 {p.name}</span>
                <span className="pr-value">{p.sets.map((s) => formatSet(s.kg, s.reps)).join(' · ')}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={`vs last ${workoutTitle(workout)} day`}>
        <CompareView workoutId={id} />
      </Section>

      <div className="dock dock-stack">
        {finished ? (
          <button className="btn btn-primary btn-xl btn-block" onClick={() => navigate('/history')}>
            Done
          </button>
        ) : logged.length ? (
          <>
            <button className="btn btn-secondary btn-lg btn-block" onClick={() => navigate(`/workout/${id}`)}>
              Keep training
            </button>
            <button className="btn btn-primary btn-xl btn-block" disabled={saving} onClick={save}>
              Save workout
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-danger btn-lg btn-block" onClick={discardEmpty}>
              Discard empty workout
            </button>
            <button className="btn btn-primary btn-xl btn-block" onClick={() => navigate(`/workout/${id}`)}>
              Back to workout
            </button>
          </>
        )}
      </div>
    </div>
  );
}
