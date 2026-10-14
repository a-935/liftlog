import { useEffect, useState } from 'react';
import type { Exercise } from '../../db/schema';
import { updateExercise } from '../../db/repo';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/feedback';
import { haptic } from '../../lib/haptics';

/** Adds "https://" when missing; returns null for things that aren't URLs. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

export function VideoLinkSheet({ exercise, open, onClose }: { exercise: Exercise | null; open: boolean; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValue(exercise?.videoUrl ?? '');
      setError('');
    }
  }, [open, exercise?.videoUrl]);

  if (!exercise) return null;

  const save = async () => {
    const url = normalizeUrl(value);
    if (!url) return setError('That doesn’t look like a link. Paste the full video URL.');
    haptic();
    await updateExercise(exercise.id, { videoUrl: url });
    onClose();
  };

  const remove = async () => {
    const previous = exercise.videoUrl;
    await updateExercise(exercise.id, { videoUrl: null });
    onClose();
    toast({ message: 'Video link removed', undo: () => updateExercise(exercise.id, { videoUrl: previous }) });
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text.trim());
    } catch {
      setError('Couldn’t read the clipboard. Long-press the box and choose Paste.');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`🎥 ${exercise.name}`}>
      <p className="sheet-text">Paste a technique video link (YouTube, TikTok, Instagram…). It stays with this exercise.</p>
      <div className="field-row">
        <input
          className="text-input"
          type="url"
          inputMode="url"
          placeholder="https://youtube.com/…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Video link"
        />
        {'clipboard' in navigator && 'readText' in navigator.clipboard && (
          <button className="btn btn-secondary" onClick={paste}>
            Paste
          </button>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="stack">
        <button className="btn btn-primary btn-lg" onClick={save}>
          Save link
        </button>
        {exercise.videoUrl && (
          <a className="btn btn-secondary btn-lg" href={exercise.videoUrl} target="_blank" rel="noopener noreferrer">
            Open video
          </a>
        )}
        {exercise.videoUrl && (
          <button className="btn btn-danger btn-lg" onClick={remove}>
            Remove link
          </button>
        )}
        <button className="btn btn-ghost btn-lg" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
