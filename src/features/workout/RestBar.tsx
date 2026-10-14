import { useEffect, useRef } from 'react';
import type { Settings, Workout } from '../../db/schema';
import { startRest, stopRest } from '../../db/repo';
import { Icon } from '../../ui/Icon';
import { useNow } from '../../lib/hooks';
import { formatClock } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { playChime, unlockAudio } from '../../lib/sound';

/**
 * Manual rest stopwatch that counts up. Elapsed time is computed from the stored start
 * timestamp, so it stays right after the phone locks or the app is closed.
 */
export function RestBar({ workout, settings }: { workout: Workout; settings: Settings }) {
  const timer = workout.restTimer;
  const now = useNow(timer ? 250 : null);
  const elapsed = timer ? Math.max(0, (now - timer.startedAt) / 1000) : 0;
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

  const toggle = () => {
    haptic();
    if (timer) {
      void stopRest(workout.id);
    } else {
      if (settings.restSoundEnabled) unlockAudio();
      void startRest(workout.id);
    }
  };

  return (
    <div className="dock">
      <button className={`rest-btn${timer ? ' running' : ''}`} onClick={toggle} aria-live="polite">
        {timer ? (
          <>
            <span className="rest-time">{formatClock(elapsed)}</span>
            <span className="rest-label">Resting · tap to stop</span>
          </>
        ) : (
          <>
            <Icon name="timer" size={26} />
            <span>Rest</span>
          </>
        )}
      </button>
    </div>
  );
}
