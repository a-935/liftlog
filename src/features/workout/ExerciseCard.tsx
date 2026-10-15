import { useRef } from 'react';
import type { SetEntry } from '../../db/schema';
import type { WorkoutItem } from '../../db/queries';
import { addSet, completeSet, uncompleteSet, updateSet } from '../../db/repo';
import { NumberField } from '../../ui/NumberField';
import { Icon } from '../../ui/Icon';
import { formatClock, formatKg, formatSet } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { unlockAudio } from '../../lib/sound';

export interface CardActions {
  onVideo: (item: WorkoutItem) => void;
  onMenu: (item: WorkoutItem) => void;
  onSetMenu: (set: SetEntry, index: number) => void;
  onRpe: (set: SetEntry) => void;
}

interface Props extends CardActions {
  item: WorkoutItem;
  active: boolean;
  prSetIds: Set<string>;
  /** Rest chime is on: unlock audio while we still have the tap. */
  soundOn: boolean;
}

export function ExerciseCard({ item, active, prSetIds, soundOn, onVideo, onMenu, onSetMenu, onRpe }: Props) {
  const { exercise, sets, lastTime } = item;
  const suggestion = (i: number) => {
    if (!lastTime?.length) return { kg: null, reps: null };
    const s = lastTime[Math.min(i, lastTime.length - 1)];
    return { kg: s.kg, reps: s.reps };
  };

  return (
    <section className="card ex-card">
      <div className="ex-head">
        <h2 className="ex-name">{exercise.name}</h2>
        {exercise.videoUrl ? (
          <a
            className="icon-btn video-btn has-link"
            href={exercise.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Technique video for ${exercise.name}`}
            onClick={haptic}
          >
            🎥
          </a>
        ) : (
          <button className="icon-btn video-btn" onClick={() => onVideo(item)} aria-label={`Add technique video for ${exercise.name}`}>
            🎥
          </button>
        )}
        <button className="icon-btn" onClick={() => onMenu(item)} aria-label={`Options for ${exercise.name}`}>
          <Icon name="more" />
        </button>
      </div>

      <p className="last-time">
        {lastTime?.length ? (
          <>
            <span className="last-label">Last time</span> {lastTime.map((s) => formatSet(s.kg, s.reps)).join(' · ')}
          </>
        ) : (
          <span className="last-label">First time — no history yet</span>
        )}
      </p>

      <div className="set-grid set-head" aria-hidden="true">
        <span>Set</span>
        <span>kg</span>
        <span>Reps</span>
        <span>RPE</span>
        <span>Done</span>
      </div>

      {sets.map((set, i) => (
        <SetRow
          key={set.id}
          set={set}
          index={i}
          suggestion={suggestion(i)}
          isPR={prSetIds.has(set.id)}
          soundOn={soundOn}
          onMenu={() => onSetMenu(set, i)}
          onRpe={() => onRpe(set)}
        />
      ))}

      <button
        className="btn btn-secondary btn-block add-set"
        onClick={() => {
          haptic();
          void addSet(item.we.id, { markDone: !active });
        }}
      >
        <Icon name="plus" /> Set
      </button>
    </section>
  );
}

interface SetRowProps {
  set: SetEntry;
  index: number;
  suggestion: { kg: number | null; reps: number | null };
  isPR: boolean;
  soundOn: boolean;
  onMenu: () => void;
  onRpe: () => void;
}

function SetRow({ set, index, suggestion, isPR, soundOn, onMenu, onRpe }: SetRowProps) {
  const repsRef = useRef<HTMLInputElement>(null);
  const showHint = !set.done;

  const toggle = async () => {
    if (set.done) {
      haptic();
      await uncompleteSet(set.id);
      return;
    }
    // Haptic and focus must happen synchronously inside the tap for iOS to honour them.
    // The store is still checked, in case reps were typed a moment ago.
    const hasReps = !!(set.reps ?? suggestion.reps);
    if (hasReps) haptic();
    else repsRef.current?.focus();
    if (soundOn) unlockAudio();
    if ((await completeSet(set.id, suggestion)) && !hasReps) repsRef.current?.blur();
  };

  return (
    <div className={`set-wrap${set.done ? ' done' : ''}`}>
      <div className="set-grid set-row">
        <button className="set-num" onClick={onMenu} aria-label={`Set ${index + 1} options`}>
          {index + 1}
        </button>
        <NumberField
          mode="decimal"
          label={`Set ${index + 1} kg`}
          value={set.kg}
          placeholder={showHint && suggestion.kg != null ? formatKg(suggestion.kg) : 'kg'}
          onChange={(kg) => updateSet(set.id, { kg })}
        />
        <NumberField
          ref={repsRef}
          mode="numeric"
          label={`Set ${index + 1} reps`}
          value={set.reps}
          placeholder={showHint && suggestion.reps != null ? String(suggestion.reps) : 'reps'}
          onChange={(reps) => updateSet(set.id, { reps })}
        />
        <button className={`rpe-btn${set.rpe ? ' has-value' : ''}`} onClick={onRpe} aria-label={`Set ${index + 1} RPE`}>
          {set.rpe ?? '–'}
        </button>
        <button className="check-btn" aria-pressed={set.done} onClick={toggle} aria-label={`Mark set ${index + 1} done`}>
          <Icon name="check" size={26} stroke={3} />
        </button>
      </div>
      {(isPR || set.restSeconds != null) && (
        <div className="set-meta">
          {isPR && <span className="pr-chip">🏆 PR</span>}
          {set.restSeconds != null && <span className="rest-chip">rest {formatClock(set.restSeconds)}</span>}
        </div>
      )}
    </div>
  );
}
