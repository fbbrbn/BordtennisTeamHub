import { useMemo, useState } from 'react';
import { clubSlug, fallbackClubName } from '../data/clubs';
import { loadIndex, useLoaded } from '../data/load';
import type { DataIndex, IndexTeam, PoolRef } from '../data/model';
import { readLastTeam } from '../lib/lastTeam';
import { href } from '../lib/router';
import { count, ordinal } from '../lib/text';
import { listSavedPlanners, newId } from '../lineup/storage';

const fold = (s: string) => s.toLocaleLowerCase('da').normalize('NFKD').replace(/[̀-ͯ]/g, '');
const PAGE = 30;

export interface ClubGroup {
  slug: string;
  name: string;
  teams: { team: IndexTeam; pool: PoolRef }[];
}

/** Every club with its teams across the given pools, A to Z. */
export function groupByClub(pools: PoolRef[]): ClubGroup[] {
  const clubs = new Map<string, ClubGroup>();
  for (const pool of pools) {
    for (const team of pool.teams) {
      const name = team.club ?? fallbackClubName(team.name);
      const slug = clubSlug(name);
      const group = clubs.get(slug) ?? { slug, name, teams: [] };
      group.teams.push({ team, pool });
      clubs.set(slug, group);
    }
  }
  for (const group of clubs.values()) {
    group.teams.sort((a, b) => a.team.name.localeCompare(b.team.name, 'da', { numeric: true }));
  }
  return [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name, 'da'));
}

export function StartPage() {
  const index = useLoaded(loadIndex, 'index');
  const recent = useMemo(readLastTeam, []);
  const saved = useMemo(() => listSavedPlanners().filter((s) => !s.key.startsWith('team-')), []);
  const newKey = saved.length === 0 ? 'my-team' : newId(saved.map((s) => s.key));

  return (
    <>
      <section className="hero">
        <h1>Run your table tennis team</h1>
        <p>
          Results, standings, odds and player statistics for every club in the Danish team tournament, plus a planner
          for who plays each match.
        </p>
      </section>

      {recent && (
        <a className="card recent" href={href('team', recent.poolId, recent.teamId)}>
          <span className="muted small">Your last team</span>
          <strong>{recent.name}</strong>
        </a>
      )}

      {index.status === 'ready' ? (
        <ClubSearch index={index.data} />
      ) : (
        <section className="card">
          <h2>Find your club or team</h2>
          <p className="muted">{index.status === 'loading' ? 'Loading clubs…' : 'Club data is not available right now.'}</p>
        </section>
      )}

      <section className="card">
        <h2>Lineup planner</h2>
        <p className="muted">
          Open your team and choose <em>Plan lineups</em>: players and matches fill in from the results. Or plan by hand
          for any team:
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

function ClubSearch({ index }: { index: DataIndex }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [shown, setShown] = useState(PAGE);

  const pools = index.pools.filter((p) => (!region || p.regionId === region) && (!ageGroup || p.ageGroupId === ageGroup));
  const q = fold(query.trim());
  const clubs = groupByClub(pools)
    .map((club) => {
      if (!q || fold(club.name).includes(q)) return club;
      const teams = club.teams.filter(({ team, pool }) => fold(`${team.name} ${pool.name} ${pool.league}`).includes(q));
      return { ...club, teams };
    })
    .filter((club) => club.teams.length > 0);
  const teamCount = clubs.reduce((sum, c) => sum + c.teams.length, 0);
  const visible = clubs.slice(0, shown);

  return (
    <section className="card picker">
      <h2>Find your club or team</h2>
      <label className="field">
        <span>Club or team</span>
        <input
          type="search"
          placeholder="e.g. Vallensbæk"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
        />
      </label>
      <div className="filter-row">
        <label className="field">
          <span>Region</span>
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setShown(PAGE);
            }}
          >
            <option value="">All regions</option>
            {(index.regions ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Age group</span>
          <select
            value={ageGroup}
            onChange={(e) => {
              setAgeGroup(e.target.value);
              setShown(PAGE);
            }}
          >
            <option value="">All age groups</option>
            {(index.ageGroups ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small" role="status">
        {count(clubs.length, 'club')} · {count(teamCount, 'team')} · {count(pools.length, 'pool')}
        {index.season ? ` · season ${index.season.name}` : ''}
      </p>

      {clubs.length === 0 && <p className="muted">Nothing matches “{query}”. Try part of the club name.</p>}
      <ul className="club-list">
        {visible.map((club) => (
          <li key={club.slug} className="club-item">
            <a className="club-name" href={href('club', club.slug)}>
              {club.name}
            </a>
            <ul className="club-teams">
              {club.teams.map(({ team, pool }) => (
                <li key={`${pool.id}-${team.id}`}>
                  <a href={href('team', pool.id, team.id)}>{team.name}</a>
                  <span className="muted small">
                    {' '}
                    {pool.ageGroupName ? `${pool.ageGroupName} · ` : ''}
                    {pool.name}
                    {team.position ? ` · ${ordinal(team.position)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {clubs.length > shown && (
        <button type="button" className="button" onClick={() => setShown((n) => n + PAGE)}>
          Show more clubs ({clubs.length - shown} left)
        </button>
      )}
    </section>
  );
}
