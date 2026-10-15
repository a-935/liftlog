import { useEffect, useRef } from 'react';
import type { Settings, Workout } from '../../db/schema';
import { useNow } from '../../lib/hooks';
import { formatClock } from '../../lib/format';
import { playChime } from '../../lib/sound';

/**
 * Rest display. The rest starts automatically when a set is ticked and ends when the next
 * set is ticked or "+ Set" is tapped. Elapsed time comes from the stored start timestamp,
 * so it stays right after the phone locks or the app is closed.
 */
export function RestBar({ workout, settings, label }: { workout: Workout; settings: Settings; label: string | null }) {
  const timer = workout.restTimer;
  const now = useNow(timer ? 250 : null);
  const startedAt = timer?.startedAt ?? null;
  const chimedFor = useRef<number | null>(null);

  // Optional single soft sound. Skipped if we only notice long after the target (phone was locked).
  useEffect(() => {
    if (startedAt == null || !settings.restSoundEnabled || chimedFor.current === startedAt) return;
    const target = startedAt + settings.restSoundSeconds * 1000;
    if (Date.now() - target > 3000) return;
    const t = window.setTimeout(() => {
      if (Date.now() - target > 3000) return;
      chimedFor.current = startedAt;
      playChime();
    }, Math.max(0, target - Date.now()));
    return () => window.clearTimeout(t);
  }, [startedAt, settings.restSoundEnabled, settings.restSoundSeconds]);

  if (startedAt == null) return null;
  return (
    <div className="dock rest-dock">
      <div className="rest-display" role="timer" aria-label="Rest time">
        <span className="rest-time">{formatClock(Math.max(0, (now - startedAt) / 1000))}</span>
        <span className="rest-label">
          <span className="rest-title">Resting</span>
          {label && <span className="rest-after">after {label}</span>}
        </span>
      </div>
    </div>
  );
}
