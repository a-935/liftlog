import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { getSettings } from '../../db/queries';
import { updateSettings } from '../../db/repo';
import { PageHeader, Section } from '../../ui/layout';
import { Icon } from '../../ui/Icon';
import { useConfirm, useToast } from '../../ui/feedback';
import { exportToExcel } from '../../lib/exportExcel';
import { downloadBackup, readBackup, restoreBackup } from '../../lib/backup';
import { pickFile } from '../../lib/files';
import { formatClock, plural } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { playChime, unlockAudio } from '../../lib/sound';
import { isLogged } from '../../lib/stats';

const LAST_UPDATED = new Date(__BUILD_TIME__).toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const STEP = 15;
const MIN = 30;
const MAX = 600;

export function SettingsScreen() {
  const settings = useLiveQuery(getSettings);
  const counts = useLiveQuery(async () => ({
    workouts: await db.workouts.filter((w) => w.finishedAt !== null).count(),
    sets: await db.sets.filter(isLogged).count(),
  }));
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  if (!settings) return <div className="screen has-tabs" />;

  const run = async (key: string, fn: () => Promise<void>) => {
    haptic();
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast({ message: (err as Error).message || 'Something went wrong' });
    } finally {
      setBusy(null);
    }
  };

  const setSeconds = (s: number) => updateSettings({ restSoundSeconds: Math.min(MAX, Math.max(MIN, s)) });

  // The picker opens before anything is marked busy: older iOS never reports a cancelled picker.
  const restore = async () => {
    const file = await pickFile('application/json,.json');
    if (!file) return;
    await run('restore', async () => {
      const summary = await readBackup(file);
      const ok = await confirm({
        title: 'Restore this backup?',
        message: `It has ${plural(summary.workouts, 'workout')} and ${plural(summary.sets, 'set')}${summary.exportedAt ? ` (saved ${new Date(summary.exportedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })})` : ''}. Everything currently on this phone will be replaced.`,
        confirmLabel: 'Replace my data',
        danger: true,
      });
      if (!ok) return;
      await restoreBackup(summary.backup);
      toast({ message: 'Backup restored' });
    });
  };

  return (
    <div className="screen has-tabs">
      <PageHeader title="Settings" />

      <Section title="Rest timer">
        <div className="card settings-card">
          <button
            className="setting-row"
            role="switch"
            aria-checked={settings.restSoundEnabled}
            onClick={() => {
              haptic();
              if (!settings.restSoundEnabled) unlockAudio();
              void updateSettings({ restSoundEnabled: !settings.restSoundEnabled });
            }}
          >
            <span className="setting-text">
              <span className="setting-title">Soft sound during rest</span>
              <span className="setting-sub">The rest timer starts by itself when you tick a set. This adds one gentle chime at the time you pick.</span>
            </span>
            <span className={`switch${settings.restSoundEnabled ? ' on' : ''}`} aria-hidden="true" />
          </button>

          {settings.restSoundEnabled && (
            <>
              <div className="setting-row static">
                <span className="setting-text">
                  <span className="setting-title">Chime at</span>
                </span>
                <div className="stepper">
                  <button className="icon-btn stepper-btn" aria-label="Earlier" onClick={() => setSeconds(settings.restSoundSeconds - STEP)} disabled={settings.restSoundSeconds <= MIN}>
                    −
                  </button>
                  <span className="stepper-value">{formatClock(settings.restSoundSeconds)}</span>
                  <button className="icon-btn stepper-btn" aria-label="Later" onClick={() => setSeconds(settings.restSoundSeconds + STEP)} disabled={settings.restSoundSeconds >= MAX}>
                    +
                  </button>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => {
                  unlockAudio();
                  playChime();
                }}
              >
                <Icon name="sound" /> Play test sound
              </button>
              <p className="hint">Tip: iPhone's silent switch mutes it, and it can't play while the phone is locked.</p>
            </>
          )}
        </div>
      </Section>

      <Section title="Your data">
        <div className="card settings-card">
          <p className="setting-sub">
            Everything is stored on this phone{counts ? ` — ${plural(counts.workouts, 'workout')}, ${plural(counts.sets, 'set')}` : ''}. Make a backup now and then.
          </p>
          <div className="stack">
            <button
              className="btn btn-secondary btn-lg btn-block"
              disabled={!!busy}
              onClick={() =>
                run('excel', async () => {
                  const rows = await exportToExcel();
                  toast({ message: `Exported ${plural(rows, 'set')}` });
                })
              }
            >
              <Icon name="sheet" /> {busy === 'excel' ? 'Exporting…' : 'Export to Excel'}
            </button>
            <button className="btn btn-secondary btn-lg btn-block" disabled={!!busy} onClick={() => run('backup', downloadBackup)}>
              <Icon name="download" /> {busy === 'backup' ? 'Saving…' : 'Backup (download JSON)'}
            </button>
            <button className="btn btn-secondary btn-lg btn-block" disabled={!!busy} onClick={restore}>
              <Icon name="upload" /> Restore from backup
            </button>
          </div>
          {persisted !== null && (
            <p className="hint">{persisted ? '✓ Storage is protected from automatic clean-up.' : 'Storage may be cleared by the browser if space runs low — add the app to your Home Screen and keep backups.'}</p>
          )}
        </div>
      </Section>

      <Section title="About">
        <div className="card settings-card">
          <div className="setting-row static">
            <span className="setting-title">App version</span>
            <span className="setting-value">v{__APP_VERSION__}</span>
          </div>
          <div className="setting-row static">
            <span className="setting-title">Last updated</span>
            <span className="setting-value">{LAST_UPDATED}</span>
          </div>
          <p className="setting-sub">Updates install by themselves when you open the app with internet.</p>
        </div>
      </Section>

      <p className="about">LiftLog · works offline</p>
    </div>
  );
}
