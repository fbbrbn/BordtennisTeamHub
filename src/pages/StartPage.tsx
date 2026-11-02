import { useMemo, useState } from 'react';
import { loadIndex, useLoaded } from '../data/load';
import { href } from '../lib/router';
import { listSavedPlanners, newId } from '../lineup/storage';
import { LAST_TEAM_KEY } from './TeamPage';

function lastTeam(): { poolId: string; teamId: string; name: string } | null {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_TEAM_KEY) ?? 'null');
    return value && typeof value.poolId === 'string' && typeof value.teamId === 'string' && typeof value.name === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}

const fold = (s: string) => s.toLocaleLowerCase('da').normalize('NFKD').replace(/[̀-ͯ]/g, '');

export function StartPage() {
  const index = useLoaded(loadIndex, 'index');
  const [query, setQuery] = useState('');
  const recent = useMemo(lastTeam, []);
  const saved = useMemo(() => listSavedPlanners().filter((s) => !s.key.startsWith('team-')), []);
  const newKey = saved.length === 0 ? 'my-team' : newId(saved.map((s) => s.key));

  const pools = index.status === 'ready' ? index.data.pools : [];
  const q = fold(query.trim());
  const matches = pools
    .map((pool) => ({
      pool,
      teams: q && !fold(`${pool.name} ${pool.league}`).includes(q) ? pool.teams.filter((t) => fold(t.name).includes(q)) : pool.teams,
    }))
    .filter((p) => p.teams.length > 0);

  return (
    <>
      <section className="hero">
        <h1>Run your table tennis team</h1>
        <p>
          Results, standings and player statistics from the Danish team tournament, plus a planner for who plays each
          match.
        </p>
      </section>

      {recent && (
        <a className="card recent" href={href('team', recent.poolId, recent.teamId)}>
          <span className="muted small">Your last team</span>
          <strong>{recent.name}</strong>
        </a>
      )}

      <section className="card picker">
        <h2>Find your team</h2>
        <label className="field">
          <span>Team or club</span>
          <input type="search" placeholder="e.g. Vallensbæk" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {index.status === 'loading' && <p className="muted">Loading teams…</p>}
        {index.status === 'error' && <p className="muted">Team data is not available right now.</p>}
        {index.status === 'ready' && matches.length === 0 && (
          <p className="muted">No team matches “{query}”. Only some pools are imported so far.</p>
        )}
        {matches.map(({ pool, teams }) => (
          <div key={pool.id} className="picker-pool">
            <h3>
              <a href={href('pool', pool.id)}>{pool.name}</a> <span className="muted">· {pool.league}</span>
            </h3>
            <ul className="team-chips">
              {teams.map((t) => (
                <li key={t.id}>
                  <a href={href('team', pool.id, t.id)}>{t.name}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {index.status === 'ready' && (
          <p className="muted small">
            {pools.length} {pools.length === 1 ? 'pool' : 'pools'} imported from bordtennisportalen.dk. More pools are
            being added.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Lineup planner</h2>
        <p className="muted">
          Open your team above and choose <em>Plan lineups</em>: players and matches fill in from the results. Or plan by
          hand for any team:
        </p>
        {saved.length > 0 && (
          <ul className="saved-list">
            {saved.map((s) => (
              <li key={s.key}>
                <a href={href('lineup', s.key)}>{s.teamName || 'Unnamed team'}</a>
              </li>
            ))}
          </ul>
        )}
        <a className="button" href={href('lineup', newKey)}>
          {saved.length === 0 ? 'Plan by hand' : 'Plan another team by hand'}
        </a>
      </section>
    </>
  );
}
