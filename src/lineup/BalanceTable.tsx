import { formatShare } from './format';
import type { Plan, PlannerState } from './types';

/** Matches per player this season: played + planned, against an even share. */
export function BalanceTable({ state, plan }: { state: PlannerState; plan: Plan }) {
  const rows = plan.tallies
    .map((tally) => ({ tally, player: state.players.find((p) => p.id === tally.playerId) }))
    .filter((row): row is { tally: typeof row.tally; player: NonNullable<typeof row.player> } => !!row.player)
    .sort((a, b) => Number(b.player.active) - Number(a.player.active));
  const fair = rows.find((r) => r.player.active)?.tally.fairShare ?? null;
  const scale = Math.max(1, fair ?? 0, ...rows.map((r) => r.tally.total));

  return (
    <section className="card">
      <div className="section-head">
        <h2>Season balance</h2>
        {fair !== null && <span className="muted">Even share: {formatShare(fair)} matches each</span>}
      </div>
      <table className="balance">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col" className="num">Played</th>
            <th scope="col" className="num">Planned</th>
            <th scope="col" className="num">Total</th>
            <th scope="col" className="bar-cell">
              <span className="sr-only">Total compared with the even share</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ tally, player }) => (
            <tr key={player.id} className={player.active ? undefined : 'inactive'}>
              <th scope="row">
                {player.name}
                {!player.active && <span className="muted"> · inactive</span>}
              </th>
              <td className="num">{tally.played}</td>
              <td className="num">{tally.planned}</td>
              <td className="num total">{tally.total}</td>
              <td className="bar-cell">
                <ShareBar played={tally.played} planned={tally.planned} fair={tally.fairShare} scale={scale} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="legend" aria-hidden="true">
        <span><i className="swatch swatch-played" /> Played</span>
        <span><i className="swatch swatch-planned" /> Planned</span>
        {fair !== null && <span><i className="swatch-tick" /> Even share</span>}
      </div>
    </section>
  );
}

function ShareBar({ played, planned, fair, scale }: { played: number; planned: number; fair: number | null; scale: number }) {
  const pct = (n: number) => `${(n / scale) * 100}%`;
  return (
    <div className="share-bar" aria-hidden="true">
      {played > 0 && <span className="seg seg-played" style={{ width: pct(played) }} />}
      {planned > 0 && <span className="seg seg-planned" style={{ width: pct(planned) }} />}
      {fair !== null && <span className="fair-tick" style={{ left: pct(fair) }} />}
    </div>
  );
}
