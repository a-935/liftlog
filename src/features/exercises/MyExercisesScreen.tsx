import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DayType, type Exercise } from '../../db/schema';
import { createExercise, updateExercise } from '../../db/repo';
import { PageHeader } from '../../ui/layout';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { useConfirm, useToast } from '../../ui/feedback';
import { matches } from './ExercisePicker';
import { normalizeUrl } from './VideoLinkSheet';
import { DAY_LABEL } from '../../lib/format';
import { haptic } from '../../lib/haptics';

const DAY_TYPES: DayType[] = ['push', 'pull', 'legs', 'core', 'other'];

export function MyExercisesScreen() {
  const exercises = useLiveQuery(async () => (await db.exercises.toArray()).sort((a, b) => a.name.localeCompare(b.name)));
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const toast = useToast();

  if (!exercises) return <div className="screen has-tabs" />;

  const visible = exercises.filter((e) => !e.archived && matches(e.name, query));
  const removed = exercises.filter((e) => e.archived);
  const editingFresh = editing && (exercises.find((e) => e.id === editing.id) ?? editing);

  return (
    <div className="screen has-tabs has-dock-tabs">
      <PageHeader title="My Exercises" sub={`${exercises.length - removed.length} exercises`} />

      <label className="search search-standalone">
        <Icon name="search" size={20} />
        <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search exercises" autoComplete="off" />
      </label>

      {DAY_TYPES.map((type) => {
        const list = visible.filter((e) => e.dayType === type);
        if (!list.length) return null;
        return (
          <section key={type} className="section">
            <div className="section-head">
              <h2 className="section-title">{DAY_LABEL[type]}</h2>
              <span className="section-meta">{list.length}</span>
            </div>
            <div className="list">
              {list.map((e) => (
                <button key={e.id} className="list-row" onClick={() => setEditing(e)}>
                  <span className="list-main">
                    <span className="list-title">{e.name}</span>
                    <span className="list-sub">
                      {e.isCustom ? 'Custom' : 'Built-in'}
                      {e.videoUrl ? ' · 🎥 video saved' : ''}
                    </span>
                  </span>
                  <Icon name="chevron" size={20} />
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {visible.length === 0 && <p className="muted pad">No exercise matches “{query}”.</p>}

      {removed.length > 0 && (
        <section className="section">
          <button className="link-btn removed-toggle" onClick={() => setShowRemoved((v) => !v)}>
            {showRemoved ? 'Hide' : 'Show'} removed exercises ({removed.length})
          </button>
          {showRemoved && (
            <div className="list">
              {removed.map((e) => (
                <div key={e.id} className="list-row static">
                  <span className="list-main">
                    <span className="list-title muted">{e.name}</span>
                    <span className="list-sub">History kept</span>
                  </span>
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      await updateExercise(e.id, { archived: false });
                      toast({ message: `${e.name} restored` });
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="dock dock-above-tabs">
        <button
          className="btn btn-primary btn-lg btn-block"
          onClick={() => {
            haptic();
            setCreating(true);
          }}
        >
          <Icon name="plus" /> New exercise
        </button>
      </div>

      <EditExerciseSheet exercise={editingFresh} open={!!editing} onClose={() => setEditing(null)} />
      <CreateExerciseSheet open={creating} onClose={() => setCreating(false)} initialName={query} />
    </div>
  );
}

function DayTypePicker({ value, onChange }: { value: DayType; onChange: (t: DayType) => void }) {
  return (
    <div className="daytype-grid" role="radiogroup" aria-label="Day type">
      {DAY_TYPES.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={value === t} className={`daytype-btn day-${t}${value === t ? ' selected' : ''}`} onClick={() => onChange(t)}>
          {DAY_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

function EditExerciseSheet({ exercise, open, onClose }: { exercise: Exercise | null; open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [dayType, setDayType] = useState<DayType>('push');
  const [video, setVideo] = useState('');
  const [error, setError] = useState('');
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    if (open && exercise) {
      setName(exercise.name);
      setDayType(exercise.dayType);
      setVideo(exercise.videoUrl ?? '');
      setError('');
    }
  }, [open, exercise?.id]);

  if (!exercise) return null;

  const save = async () => {
    haptic();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return setError('Give it a name.');
    const duplicate = await db.exercises.filter((e) => e.id !== exercise.id && e.name.toLowerCase() === clean.toLowerCase()).first();
    if (duplicate) return setError(`“${duplicate.name}” already exists${duplicate.archived ? ' (removed – restore it below)' : ''}.`);
    const url = video.trim() ? normalizeUrl(video) : null;
    if (video.trim() && !url) return setError('The video link doesn’t look like a URL.');
    await updateExercise(exercise.id, { name: clean, dayType, videoUrl: url });
    onClose();
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Remove ${exercise.name}?`,
      message: 'It disappears from the exercise list. Your past workouts and progress for it are kept, and you can restore it later.',
      confirmLabel: 'Remove exercise',
      danger: true,
    });
    if (!ok) return;
    await updateExercise(exercise.id, { archived: true });
    onClose();
    toast({ message: `${exercise.name} removed`, undo: () => updateExercise(exercise.id, { archived: false }) });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Edit exercise">
      <label className="field-label" htmlFor="ex-name">
        Name
      </label>
      <input id="ex-name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      <span className="field-label">Day type</span>
      <DayTypePicker value={dayType} onChange={setDayType} />
      <label className="field-label" htmlFor="ex-video">
        🎥 Technique video link
      </label>
      <input
        id="ex-video"
        className="text-input"
        type="url"
        inputMode="url"
        placeholder="Paste a YouTube / TikTok / Instagram link"
        value={video}
        onChange={(e) => setVideo(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
      />
      {error && <p className="field-error">{error}</p>}
      <div className="stack">
        <button className="btn btn-primary btn-lg" onClick={save}>
          Save
        </button>
        <button className="btn btn-ghost btn-lg" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-danger btn-lg remove-ex" onClick={remove}>
          <Icon name="trash" /> Remove exercise
        </button>
      </div>
    </Sheet>
  );
}

function CreateExerciseSheet({ open, onClose, initialName }: { open: boolean; onClose: () => void; initialName: string }) {
  const [name, setName] = useState('');
  const [dayType, setDayType] = useState<DayType>('push');
  const toast = useToast();

  useEffect(() => {
    if (open) setName(initialName.trim());
  }, [open]);

  const create = async () => {
    if (!name.trim()) return;
    haptic();
    await createExercise(name, dayType);
    onClose();
    toast({ message: `${name.trim()} added` });
  };

  return (
    <Sheet open={open} onClose={onClose} title="New exercise">
      <label className="field-label" htmlFor="new-ex-name">
        Name
      </label>
      <input id="new-ex-name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cable Y-Raise" autoComplete="off" />
      <span className="field-label">Day type</span>
      <DayTypePicker value={dayType} onChange={setDayType} />
      <div className="stack">
        <button className="btn btn-primary btn-lg" disabled={!name.trim()} onClick={create}>
          Add exercise
        </button>
        <button className="btn btn-ghost btn-lg" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

