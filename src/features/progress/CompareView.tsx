import { useLiveQuery } from 'dexie-react-hooks';
import { loadComparison, type CompareRow } from './compare';
import { formatDate } from '../../lib/dates';
import { formatNumber, workoutTitle } from '../../lib/format';
import { trend, type Trend } from '../../lib/stats';

const ARROW: Record<Trend, string> = { up: '↑', down: '↓', same: '=' };

function Metric({ label, cur, prev }: { label: string; cur: number | null; prev: number | null }) {
  const t = cur != null && prev != null ? trend(cur, prev) : null;
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{cur != null ? formatNumber(cur) : '—'}</span>
      {t && (
        <span className={`metric-delta trend-${t}`}>
          {ARROW[t]} {t === 'same' ? 'same' : `from ${formatNumber(prev!)}`}
        </span>
      )}
      {cur == null && prev != null && <span className="metric-delta">last {formatNumber(prev)}</span>}
    </div>
  );
}

function Row({ row }: { row: CompareRow }) {
  const { cur, prev } = row;
  const topKg = (s: typeof cur) => (s?.top ? s.top.kg : null);
  const topReps = (s: typeof cur) => (s?.top ? s.top.reps : null);
  return (
    <div className={`cmp-row status-${row.status}`}>
      <div className="cmp-head">
        <span className="cmp-name">{row.name}</span>
        {row.status === 'new' && <span className="flag flag-new">New</span>}
        {row.status === 'skipped' && <span className="flag flag-skipped">Skipped</span>}
      </div>
      <div className="cmp-metrics">
        <Metric label="Top kg" cur={topKg(cur)} prev={topKg(prev)} />
        <Metric label="Reps" cur={topReps(cur)} prev={topReps(prev)} />
        <Metric label="Sets" cur={cur?.setCount ?? null} prev={prev?.setCount ?? null} />
        <Metric label="Volume" cur={cur ? Math.round(cur.volume) : null} prev={prev ? Math.round(prev.volume) : null} />
      </div>
    </div>
  );
}

/** "Today vs last same day". Used on the finish summary, from History and in Progress. */
export function CompareView({ workoutId }: { workoutId: string }) {
  const data = useLiveQuery(() => loadComparison(workoutId), [workoutId]);
  if (!data) return null;
  const title = workoutTitle(data.workout);

  if (!data.previous) {
    return (
      <div className="card compare-empty">
        <p>
          This is your first <strong>{title}</strong> workout, so there's nothing to compare yet. Next {title} day you'll see
          the difference here.
        </p>
      </div>
    );
  }

  const { totals } = data;
  return (
    <div className="compare">
      <p className="compare-sub">
        {formatDate(data.workout.date)} vs {formatDate(data.previous.date)}
      </p>
      <div className="card cmp-totals">
        <Metric label="Total sets" cur={totals.cur.setCount} prev={totals.prev?.setCount ?? null} />
        <Metric label="Total volume" cur={Math.round(totals.cur.volume)} prev={totals.prev ? Math.round(totals.prev.volume) : null} />
      </div>
      <div className="card cmp-list">
        {data.rows.map((row) => (
          <Row key={row.exerciseId} row={row} />
        ))}
        {data.rows.length === 0 && <p className="muted">No sets logged yet.</p>}
      </div>
    </div>
  );
}
