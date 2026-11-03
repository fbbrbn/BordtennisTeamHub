import { useMemo, useState } from 'react';
import { FollowButton } from '../components/FollowButton';
import { ThinOdds } from '../components/Odds';
import { matchDay, matchTime } from '../components/ui';
import { clubSlug, fallbackClubName } from '../data/clubs';
import { fitScale, forecastMatch, lineupSize } from '../data/forecast';
import { loadIndex, loadPool, useLoaded } from '../data/load';
import type { DataIndex, IndexTeam, PoolData, PoolRef } from '../data/model';
import { isHome, opponentOf, teamMatches, teamsById } from '../data/stats';
import { useFollowing, type FollowedTeam } from '../lib/follow';
import { readLastTeam } from '../lib/lastTeam';
import { href } from '../lib/router';
import { count, ordinal, percent } from '../lib/text';
import { plannedLineup } from '../lineup/planned';
import { listSavedPlanners, newId } from '../lineup/storage';

const fold = (s: string) => s.toLocaleLowerCase('da').normalize('NFKD').replace(/[̀-ͯ]/g, '');
const RESULTS_PAGE = 20;
const BROWSE_PAGE = 12;

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
  const { following } = useFollowing();
  const last = useMemo(readLastTeam, []);
  const lastNotFollowed = last && !following.some((t) => t.poolId === last.poolId && t.teamId === last.teamId) ? last : null;
  const saved = useMemo(() => listSavedPlanners().filter((s) => !s.key.startsWith('team-')), []);
  const newKey = saved.length === 0 ? 'my-team' : newId(saved.map((s) => s.key));

  return (
    <>
      <section className="hero">
        <h1>{following.length > 0 ? 'Welcome back' : 'Find your team'}</h1>
        <p>Results, chances and lineup planning for every team in the Danish table tennis team tournament.</p>
      </section>

      {following.length > 0 && (
        <section className="stack" aria-labelledby="my-teams">
          <h2 id="my-teams">My teams</h2>
          {following.map((team) => (
            <MyTeamCard key={`${team.poolId}-${team.teamId}`} team={team} />
          ))}
        </section>
      )}

      {following.length === 0 && lastNotFollowed && (
        <section className="card suggestion">
          <p>
            Continue with <a href={href('team', lastNotFollowed.poolId, lastNotFollowed.teamId)}>{lastNotFollowed.name}</a>
          </p>
          <p className="muted small">Follow it to keep it at the top of this page, with its next match.</p>
          <div className="button-row">
            <FollowButton team={lastNotFollowed} />
          </div>
        </section>
      )}

      {following.length === 0 && !last && (
        <section className="card how-it-works">
          <h2>How it works</h2>
          <ol className="steps">
            <li>
              <strong>Find your team</strong> by club name below.
            </li>
            <li>
              <strong>Follow it</strong> with ☆ so it is always here, with its next match and your chances.
            </li>
            <li>
              <strong>Plan your lineup</strong>: mark who can play, and the planner keeps the matches fair for everyone.
            </li>
          </ol>
        </section>
      )}

      {index.status === 'ready' ? (
        <ClubSearch index={index.data} />
      ) : (
        <section className="card">
          <h2>Find a club or team</h2>
          <p className="muted">{index.status === 'loading' ? 'Loading clubs…' : 'Club data is not available right now.'}</p>
        </section>
      )}

      <section className="card compact">
        <h2>Planning for a team that is not listed?</h2>
        <p className="muted small">The lineup planner also works by hand: add your players and matches yourself.</p>
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

function MyTeamCard({ team }: { team: FollowedTeam }) {
  const loaded = useLoaded(() => loadPool(team.poolId), team.poolId);
  const base = href('team', team.poolId, team.teamId);
  if (loaded.status !== 'ready') {
    return (
      <a className="card my-team" href={base}>
        <strong>{team.name}</strong>
        <span className="muted small">{loaded.status === 'loading' ? 'Loading…' : 'Not available right now'}</span>
      </a>
    );
  }
  return <MyTeamSummary pool={loaded.data} team={team} />;
}

function MyTeamSummary({ pool, team }: { pool: PoolData; team: FollowedTeam }) {
  const scale = useMemo(() => fitScale(pool), [pool]);
  const teams = teamsById(pool);
  const standing = pool.standings.find((s) => s.teamId === team.teamId);
  const next = teamMatches(pool, team.teamId).find((m) => !m.score);
  const forecast = useMemo(() => {
    if (!next) return null;
    const planned = plannedLineup(pool.pool.id, team.teamId, next.id, lineupSize(pool));
    return forecastMatch(pool, next, team.teamId, scale, planned ? { team: planned } : {});
  }, [pool, next, team.teamId, scale]);
  const base = href('team', pool.pool.id, team.teamId);

  return (
    <article className="card my-team">
      <div className="my-team-head">
        <a className="my-team-name" href={base}>
          {team.name}
        </a>
        <span className="muted small">
          {pool.pool.name}
          {standing && standing.played > 0 && ` · ${ordinal(standing.position)} of ${pool.standings.length}, ${count(standing.points, 'point')}`}
        </span>
      </div>
      {next ? (
        <a className="my-team-next" href={href('match', pool.pool.id, next.id)}>
          <span className="my-team-when muted small">
            Next: {matchDay(next.date)} · {matchTime(next.date)}
          </span>
          <span className="my-team-vs">
            vs {teams.get(opponentOf(next, team.teamId))?.name ?? 'opponent'}{' '}
            <span className="tag">{isHome(next, team.teamId) ? 'Home' : 'Away'}</span>
          </span>
          {forecast?.odds && (
            <span className="my-team-odds">
              <span>
                <strong>{percent(forecast.odds.win)}</strong> chance to win
              </span>
              <ThinOdds odds={forecast.odds} />
            </span>
          )}
        </a>
      ) : (
        <p className="muted small">No more matches this season.</p>
      )}
      <div className="button-row">
        <a className="button" href={base}>
          Team page
        </a>
        <a className="button primary" href={href('lineup', `team-${pool.pool.id}-${team.teamId}`)}>
          Plan lineup
        </a>
      </div>
    </article>
  );
}

function ClubSearch({ index }: { index: DataIndex }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [shown, setShown] = useState(RESULTS_PAGE);
  const [browseAll, setBrowseAll] = useState(false);

  const pools = index.pools.filter((p) => (!region || p.regionId === region) && (!ageGroup || p.ageGroupId === ageGroup));
  const allClubs = groupByClub(pools);
  const q = fold(query.trim());
  const searching = q.length > 0;
  const results = searching
    ? allClubs
        .map((club) => {
          if (fold(club.name).includes(q)) return club;
          const teams = club.teams.filter(({ team, pool }) => fold(`${team.name} ${pool.name} ${pool.league}`).includes(q));
          return { ...club, teams };
        })
        .filter((club) => club.teams.length > 0)
    : [];
  const browse = browseAll ? allClubs : allClubs.slice(0, BROWSE_PAGE);
  const reset = () => setShown(RESULTS_PAGE);

  return (
    <section className="card picker">
      <h2>Find a club or team</h2>
      <label className="field search-field">
        <span className="sr-only">Club or team</span>
        <input
          type="search"
          placeholder="Search a club or team, e.g. Vallensbæk"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            reset();
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
              reset();
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
              reset();
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

      {searching ? (
        <>
          <p className="muted small" role="status">
            {results.length === 0
              ? `Nothing matches “${query.trim()}”. Try part of the club name.`
              : `${count(results.length, 'club')}, ${count(results.reduce((sum, c) => sum + c.teams.length, 0), 'team')}`}
          </p>
          <ul className="club-list">
            {results.slice(0, shown).map((club) => (
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
          {results.length > shown && (
            <button type="button" className="button" onClick={() => setShown((n) => n + RESULTS_PAGE)}>
              Show more ({results.length - shown} left)
            </button>
          )}
        </>
      ) : (
        <>
          <p className="muted small" role="status">
            {count(allClubs.length, 'club')} · {count(pools.length, 'pool')}
            {index.season ? ` · season ${index.season.name}` : ''}
          </p>
          <ul className="browse-list">
            {browse.map((club) => (
              <li key={club.slug}>
                <a href={href('club', club.slug)}>
                  <span className="browse-name">{club.name}</span>
                  <span className="muted small">{count(club.teams.length, 'team')}</span>
                </a>
              </li>
            ))}
          </ul>
          {allClubs.length > BROWSE_PAGE && (
            <button type="button" className="button" onClick={() => setBrowseAll((v) => !v)}>
              {browseAll ? 'Show fewer clubs' : `Show all ${allClubs.length} clubs`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
