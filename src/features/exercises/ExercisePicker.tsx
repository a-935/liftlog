import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DayType, type Exercise, type WorkoutType } from '../../db/schema';
import { recentExerciseIds } from '../../db/queries';
import { createExercise } from '../../db/repo';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { DayBadge } from '../../ui/layout';
import { DAY_LABEL } from '../../lib/format';
import { haptic } from '../../lib/haptics';

export const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Every word of the query appears somewhere in the name. */
export function matches(name: string, query: string) {
  const n = normalize(name);
  return normalize(query).split(' ').every((w) => n.includes(w));
}

interface Props {
  open: boolean;
  onClose: () => void;
  workoutType: WorkoutType;
  /** Exercises already in the workout. */
  addedIds: Set<string>;
  onPick: (exerciseId: string) => void;
}

export function ExercisePicker({ open, onClose, workoutType, addedIds, onPick }: Props) {
  const [query, setQuery] = useState('');
  const data = useLiveQuery(async () => ({
    exercises: (await db.exercises.toArray()).filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name)),
    recent: await recentExerciseIds(6),
  }));

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const sections = useMemo(() => {
    if (!data) return [];
    const { exercises } = data;
    const q = query.trim();
    if (q) {
      const rank = (e: Exercise) => (e.dayType === workoutType ? 0 : e.dayType === 'core' ? 1 : 2);
      return [{ title: 'Results', items: exercises.filter((e) => matches(e.name, q)).sort((a, b) => rank(a) - rank(b)) }];
    }
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const recent = data.recent.map((id) => byId.get(id)).filter((e): e is Exercise => !!e);
    const today = workoutType === 'other' ? [] : exercises.filter((e) => e.dayType === workoutType);
    const core = exercises.filter((e) => e.dayType === 'core');
    const shown = new Set([...today, ...core].map((e) => e.id));
    return [
      { title: 'Recently used', items: recent },
      { title: `${DAY_LABEL[workoutType]} day`, items: today },
      { title: 'More · Core', items: core },
      { title: 'All exercises', items: exercises.filter((e) => !shown.has(e.id)) },
    ].filter((s) => s.items.length > 0);
  }, [data, query, workoutType]);

  const q = query.trim();
  const resultCount = sections.reduce((n, s) => n + s.items.length, 0);
  const exact = !!data?.exercises.some((e) => normalize(e.name) === normalize(q));

  const pick = (id: string) => {
    haptic();
    onPick(id);
    onClose();
  };

  const addCustom = async () => {
    haptic();
    const dayType: DayType = workoutType;
    onPick(await createExercise(q, dayType));
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} full>
      <div className="picker">
        <div className="picker-top">
          <label className="search">
            <Icon name="search" size={20} />
            <input
              type="search"
              placeholder="Search exercises"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="search"
              aria-label="Search exercises"
            />
          </label>
          <button className="btn btn-secondary picker-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="picker-list">
          {q && resultCount === 0 && (
            <div className="picker-empty">
              <p>No exercise called “{q}” yet.</p>
              <button className="btn btn-primary btn-lg btn-block" onClick={addCustom}>
                <Icon name="plus" /> Add “{q}”
              </button>
              <p className="hint">It's saved to your exercises for good, tagged {DAY_LABEL[workoutType]}.</p>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.title} className="picker-section">
              <h3 className="picker-section-title">{section.title}</h3>
              {section.items.map((e) => {
                const added = addedIds.has(e.id);
                return (
                  <button key={`${section.title}-${e.id}`} className="picker-row" disabled={added} onClick={() => pick(e.id)}>
                    <span className="picker-name">{e.name}</span>
                    {added ? <span className="picker-added">Added</span> : <DayBadge type={e.dayType} />}
                  </button>
                );
              })}
            </div>
          ))}

          {q && resultCount > 0 && !exact && (
            <button className="btn btn-secondary btn-lg btn-block picker-add-bottom" onClick={addCustom}>
              <Icon name="plus" /> Add “{q}” as new exercise
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
