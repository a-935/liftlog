import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type SetEntry } from '../../db/schema';
import { getSettings, loadWorkoutView, type WorkoutItem } from '../../db/queries';
import {
  addExerciseToWorkout,
  deleteSet,
  deleteWorkout,
  moveWorkoutExercise,
  removeWorkoutExercise,
  reopenWorkout,
  updateSet,
  updateWorkout,
} from '../../db/repo';
import { navigate } from '../../router';
import { TopBar, EmptyState } from '../../ui/layout';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { useConfirm, useToast } from '../../ui/feedback';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { VideoLinkSheet } from '../exercises/VideoLinkSheet';
import { ExerciseCard } from './ExerciseCard';
import { RestBar } from './RestBar';
import { formatDate } from '../../lib/dates';
import { formatDuration, formatSet, workoutTitle } from '../../lib/format';
import { useNow } from '../../lib/hooks';
import { haptic } from '../../lib/haptics';
import { byWorkoutKeyDesc } from '../../lib/stats';

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export function WorkoutScreen({ id }: { id: string }) {
  const view = useLiveQuery(() => loadWorkoutView(id), [id]);
  const settings = useLiveQuery(getSettings);
  const toast = useToast();
  const confirm = useConfirm();
  const now = useNow(30_000);
  // A finished workout can be resumed if it's the latest one and nothing else is in progress.
  const resumable = useLiveQuery(async () => {
    const all = await db.workouts.toArray();
    if (all.some((w) => w.finishedAt === null)) return false;
    return all.sort(byWorkoutKeyDesc)[0]?.id === id;
  }, [id]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exMenu, setExMenu] = useState<WorkoutItem | null>(null);
  const [setMenu, setSetMenu] = useState<{ set: SetEntry; index: number } | null>(null);
  const [rpeFor, setRpeFor] = useState<SetEntry | null>(null);
  const [videoFor, setVideoFor] = useState<Exercise | null>(null);

  // Keep the sheets' data fresh while they're open (e.g. after saving a link).
  const videoExercise = videoFor && (view?.items.find((i) => i.exercise.id === videoFor.id)?.exercise ?? videoFor);

  const closeExMenu = useCallback(() => setExMenu(null), []);
  const closeSetMenu = useCallback(() => setSetMenu(null), []);
  const closeRpe = useCallback(() => setRpeFor(null), []);
  const closeVideo = useCallback(() => setVideoFor(null), []);

  if (view === undefined || settings === undefined) return <div className="screen" />;
  if (view === null) {
    return (
      <div className="screen">
        <TopBar title="Workout" back={() => navigate('/')} />
        <EmptyState icon="history" title="Workout not found" text="It may have been deleted." />
      </div>
    );
  }

  const { workout, items, prSetIds } = view;
  const active = workout.finishedAt === null;
  const title = workoutTitle(workout);
  const elapsed = (active ? now : workout.finishedAt!) - workout.startedAt;

  const removeExercise = async (item: WorkoutItem) => {
    setExMenu(null);
    const undo = await removeWorkoutExercise(item.we.id);
    toast({ message: `Removed ${item.exercise.name}`, undo });
  };

  const removeSet = async (set: SetEntry, index: number) => {
    setSetMenu(null);
    const undo = await deleteSet(set.id);
    toast({ message: `Deleted set ${index + 1}`, undo });
  };

  const discard = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: active ? 'Discard this workout?' : 'Delete this workout?',
      message: active ? 'Everything logged in this workout will be removed.' : 'This removes the workout and all its sets from your history.',
      confirmLabel: active ? 'Discard workout' : 'Delete workout',
      danger: true,
    });
    if (!ok) return;
    const undo = await deleteWorkout(workout.id);
    navigate(active ? '/' : '/history', { replace: true });
    toast({ message: active ? 'Workout discarded' : 'Workout deleted', undo });
  };

  const finish = async () => {
    haptic();
    const ok = await confirm({
      title: 'Finish this workout?',
      message: 'You’ll see a summary before it’s saved, and you can still edit it later from History.',
      confirmLabel: 'Yes, finish workout',
    });
    if (ok) navigate(`/summary/${workout.id}`);
  };

  const resume = async () => {
    haptic();
    setMenuOpen(false);
    await reopenWorkout(workout.id);
    toast({ message: 'Workout resumed' });
  };

  // "after Bench Press · set 2" for the rest display
  const restLabel = (() => {
    const setId = workout.restTimer?.setId;
    for (const item of items) {
      const i = item.sets.findIndex((s) => s.id === setId);
      if (i >= 0) return `${item.exercise.name} · set ${i + 1}`;
    }
    return null;
  })();

  return (
    <div className={`screen workout-screen${active ? ' has-dock' : ''}`}>
      <TopBar
        back={() => navigate(active ? '/' : '/history')}
        title={active ? title : `${title} · edit`}
        subtitle={
          <>
            <label className="date-chip">
              <Icon name="calendar" size={16} />
              {formatDate(workout.date)}
              <input
                type="date"
                value={workout.date}
                aria-label="Workout date"
                onChange={(e) => e.target.value && updateWorkout(workout.id, { date: e.target.value })}
              />
            </label>
            <span className="topbar-dot">·</span>
            <span>{formatDuration(elapsed)}</span>
          </>
        }
        right={
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Workout options">
            <Icon name="more" />
          </button>
        }
      />

      {!active && (
        <div className="edit-banner">
          <Icon name="edit" size={18} />
          <span>Editing a saved workout. Changes save automatically.</span>
        </div>
      )}

      {items.length === 0 && (
        <div className="card empty-card">
          <p>No exercises yet. Add your first one below.</p>
        </div>
      )}

      <div className="ex-list">
        {items.map((item) => (
          <ExerciseCard
            key={item.we.id}
            item={item}
            active={active}
            prSetIds={prSetIds}
            soundOn={active && settings.restSoundEnabled}
            onVideo={(i) => setVideoFor(i.exercise)}
            onMenu={setExMenu}
            onSetMenu={(set, index) => setSetMenu({ set, index })}
            onRpe={setRpeFor}
          />
        ))}
      </div>

      <button
        className="btn btn-secondary btn-lg btn-block add-exercise"
        onClick={() => {
          haptic();
          setPickerOpen(true);
        }}
      >
        <Icon name="plus" /> Exercise
      </button>

      <NotesBox workoutId={workout.id} value={workout.notes} />

      {active ? (
        <button className="btn btn-primary btn-xl btn-block finish-btn" onClick={finish}>
          Finish workout
        </button>
      ) : (
        <div className="stack">
          {resumable && (
            <button className="btn btn-secondary btn-lg btn-block" onClick={resume}>
              <Icon name="play" /> Ended by accident? Resume workout
            </button>
          )}
          <button className="btn btn-secondary btn-lg btn-block" onClick={() => navigate(`/progress/compare/${workout.id}`)}>
            <Icon name="compare" /> Compare with previous {title}
          </button>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => navigate('/history')}>
            Done
          </button>
        </div>
      )}

      {active && <RestBar workout={workout} settings={settings} label={restLabel} />}

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        workoutType={workout.type}
        addedIds={new Set(items.map((i) => i.exercise.id))}
        onPick={(exerciseId) => {
          void addExerciseToWorkout(workout.id, exerciseId);
          requestAnimationFrame(() => setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 120));
        }}
      />

      <VideoLinkSheet exercise={videoExercise} open={!!videoFor} onClose={closeVideo} />

      {/* Workout options */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={title}>
        <div className="stack">
          {!active && (
            <button className="btn btn-secondary btn-lg" onClick={() => navigate(`/progress/compare/${workout.id}`)}>
              <Icon name="compare" /> Compare with previous
            </button>
          )}
          <button className="btn btn-danger btn-lg" onClick={discard}>
            <Icon name="trash" /> {active ? 'Discard workout' : 'Delete workout'}
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => setMenuOpen(false)}>
            Cancel
          </button>
        </div>
      </Sheet>

      {/* Exercise options */}
      <Sheet open={!!exMenu} onClose={closeExMenu} title={exMenu?.exercise.name}>
        {exMenu && (
          <div className="stack">
            <div className="row-2">
              <button
                className="btn btn-secondary btn-lg"
                disabled={items[0]?.we.id === exMenu.we.id}
                onClick={() => moveWorkoutExercise(exMenu.we.id, -1)}
              >
                <Icon name="up" /> Move up
              </button>
              <button
                className="btn btn-secondary btn-lg"
                disabled={items[items.length - 1]?.we.id === exMenu.we.id}
                onClick={() => moveWorkoutExercise(exMenu.we.id, 1)}
              >
                <Icon name="down" /> Move down
              </button>
            </div>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => {
                setVideoFor(exMenu.exercise);
                setExMenu(null);
              }}
            >
              🎥 {exMenu.exercise.videoUrl ? 'Edit video link' : 'Add video link'}
            </button>
            <button className="btn btn-danger btn-lg" onClick={() => removeExercise(exMenu)}>
              <Icon name="trash" /> Remove from workout
            </button>
            <button className="btn btn-ghost btn-lg" onClick={closeExMenu}>
              Cancel
            </button>
          </div>
        )}
      </Sheet>

      {/* Set options */}
      <Sheet
        open={!!setMenu}
        onClose={closeSetMenu}
        title={setMenu && `Set ${setMenu.index + 1}${setMenu.set.reps ? ` · ${formatSet(setMenu.set.kg, setMenu.set.reps)}` : ''}`}
      >
        {setMenu && (
          <div className="stack">
            <button className="btn btn-danger btn-lg" onClick={() => removeSet(setMenu.set, setMenu.index)}>
              <Icon name="trash" /> Delete set
            </button>
            <button className="btn btn-ghost btn-lg" onClick={closeSetMenu}>
              Cancel
            </button>
          </div>
        )}
      </Sheet>

      {/* RPE picker */}
      <Sheet open={!!rpeFor} onClose={closeRpe} title="RPE (optional)">
        {rpeFor && (
          <>
            <div className="rpe-grid">
              {RPE_VALUES.map((v) => (
                <button
                  key={v}
                  className={`rpe-choice${rpeFor.rpe === v ? ' selected' : ''}`}
                  onClick={() => {
                    haptic();
                    void updateSet(rpeFor.id, { rpe: v });
                    setRpeFor(null);
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="stack">
              <button
                className="btn btn-secondary btn-lg"
                onClick={() => {
                  void updateSet(rpeFor.id, { rpe: null });
                  setRpeFor(null);
                }}
              >
                No RPE
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

/** Notes keep their own state while typing and save shortly after you stop. */
function NotesBox({ workoutId, value }: { workoutId: string; value: string }) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  const save = (t: string) => {
    window.clearTimeout(timer.current);
    void updateWorkout(workoutId, { notes: t });
  };

  return (
    <label className="notes">
      <span className="notes-label">Notes</span>
      <textarea
        rows={3}
        placeholder="How did you feel today?"
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          save(text);
        }}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => save(t), 400);
        }}
      />
    </label>
  );
}
