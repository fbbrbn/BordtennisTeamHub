import { useEffect, useMemo, useState } from 'react';
import { FollowButton } from '../components/FollowButton';
import { ThinOdds } from '../components/Odds';
import { matchDay, matchTime, RowLink } from '../components/ui';
import { clubSlug, fallbackClubName } from '../data/clubs';
import { fitScale, forecastMatch, lineupSize, shownOdds } from '../data/forecast';
import { loadIndex, loadPlayers, loadPool, useLoaded } from '../data/load';
import type { DataIndex, IndexTeam, PlayerEntry, PoolData, PoolRef } from '../data/model';
import { isHome, opponentOf, teamMatches, teamsById } from '../data/stats';
import { useFollowing, type FollowedTeam } from '../lib/follow';
import { readLastTeam } from '../lib/lastTeam';
import { t } from '../i18n';
import { href } from '../lib/router';
import { percent } from '../lib/text';
import { plannedLineup } from '../lineup/planned';
import { listSavedPlanners, newId } from '../lineup/storage';

const fold = (s: string) => s.toLocaleLowerCase('da').normalize('NFKD').replace(/[̀-ͯ]/g, '');
const RESULTS_PAGE = 20;
const BROWSE_PAGE = 12;
/** A club that matches by name lists this many of its teams; the club page has them all. */
const CLUB_TEAMS = 6;

export interface PlayerMatch {
  player: PlayerEntry;
  teams: { team: IndexTeam; pool: PoolRef }[];
}

/**
 * Players whose name has every word of the query, in any order, with their teams in the given
 * pools. Players with no team there are left out.
 */
export function matchPlayers(players: PlayerEntry[], query: string, pools: PoolRef[]): PlayerMatch[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const byId = new Map(pools.map((p) => [p.id, p]));
  const found: PlayerMatch[] = [];
  for (const player of players) {
    const name = fold(player.name);
    if (!words.every((w) => name.includes(w))) continue;
    const teams = player.teams.flatMap(([poolId, teamId]) => {
      const pool = byId.get(poolId);
      const team = pool?.teams.find((t) => t.id === teamId);
      return pool && team ? [{ team, pool }] : [];
    });
    if (teams.length > 0) found.push({ player, teams });
  }
  return found;
}

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

/** "Senior · Serie 4 Pulje 4" */
const poolLabel = (pool: PoolRef) => (pool.ageGroupName ? `${pool.ageGroupName} · ${pool.name}` : pool.name);

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
        <h1>{following.length > 0 ? t.start.myTeams : t.start.findTeam}</h1>
        {following.length === 0 && <p>{t.start.intro}</p>}
      </section>

      {following.length > 0 && (
        <section className="stack">
          {following.map((team) => (
            <MyTeamCard key={`${team.poolId}-${team.teamId}`} team={team} />
          ))}
        </section>
      )}

      {following.length === 0 && lastNotFollowed && (
        <section className="card suggestion">
          <p>{t.start.continueWith(<a href={href('team', lastNotFollowed.poolId, lastNotFollowed.teamId)}>{lastNotFollowed.name}</a>)}</p>
          <p className="muted small">{t.start.followHint}</p>
          <div className="button-row">
            <FollowButton team={lastNotFollowed} />
          </div>
        </section>
      )}

      {index.status === 'ready' ? (
        <ClubSearch index={index.data} heading={following.length > 0} />
      ) : (
        <section className="card">
          <p className="muted">{index.status === 'loading' ? t.start.loadingClubs : t.start.clubsUnavailable}</p>
        </section>
      )}

      <section className="card compact">
        <h2>{t.versus.title}</h2>
        <p className="muted small">{t.versus.startNote}</p>
        <a className="button" href={href('vs')}>
          {t.versus.startButton}
        </a>
      </section>

      <section className="card compact">
        <h2>{t.start.notListed}</h2>
        <p className="muted small">{t.start.notListedNote}</p>
        {saved.length > 0 && (
          <ul className="saved-list">
            {saved.map((s) => (
              <li key={s.key}>
                <a href={href('lineup', s.key)}>{s.teamName || t.start.unnamedTeam}</a>
              </li>
            ))}
          </ul>
        )}
        <a className="button" href={href('lineup', newKey)}>
          {saved.length === 0 ? t.start.planByHand : t.start.planAnother}
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
        <span className="muted small">{loaded.status === 'loading' ? t.states.loadingShort : t.states.unavailable}</span>
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
  const odds = useMemo(() => {
    if (!next) return null;
    const planned = plannedLineup(pool.pool.id, team.teamId, next.id, lineupSize(pool));
    return shownOdds(forecastMatch(pool, next, team.teamId, scale, planned ? { team: planned } : {}), next).odds;
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
          {standing && standing.played > 0 && t.start.standing(standing.position, pool.standings.length, standing.points)}
        </span>
      </div>
      {next ? (
        <a className="my-team-next" href={href('match', pool.pool.id, next.id)}>
          <span className="my-team-when muted small">{t.start.next(matchDay(next.date), matchTime(next.date))}</span>
          <span className="my-team-vs">
            {t.common.vs} {teams.get(opponentOf(next, team.teamId))?.name ?? t.start.opponent}{' '}
            <span className="tag">{isHome(next, team.teamId) ? t.common.home : t.common.away}</span>
          </span>
          {odds && (
            <span className="my-team-odds">
              <span>
                <strong>{percent(odds.win)}</strong> {t.odds.chanceToWin}
              </span>
              <ThinOdds odds={odds} />
            </span>
          )}
        </a>
      ) : (
        <p className="muted small">{t.start.noMoreMatches}</p>
      )}
      <div className="button-row">
        <a className="button" href={base}>
          {t.start.teamPage}
        </a>
        <a className="button primary" href={href('lineup', `team-${pool.pool.id}-${team.teamId}`)}>
          {t.common.planLineup}
        </a>
      </div>
    </article>
  );
}

/** The search across clubs, teams and players. `heading` when the page starts with something else. */
function ClubSearch({ index, heading }: { index: DataIndex; heading: boolean }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [shown, setShown] = useState(RESULTS_PAGE);
  const [shownPlayers, setShownPlayers] = useState(RESULTS_PAGE);
  const [browseAll, setBrowseAll] = useState(false);
  const [players, setPlayers] = useState<PlayerEntry[] | null>(null);

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
  // Player names are a separate file, loaded once someone starts typing.
  const wantPlayers = q.length >= 2;
  useEffect(() => {
    if (!wantPlayers || players) return;
    let cancelled = false;
    loadPlayers().then(
      (data) => !cancelled && setPlayers(data.players),
      () => !cancelled && setPlayers([]),
    );
    return () => {
      cancelled = true;
    };
  }, [wantPlayers, players]);
  const playerResults = wantPlayers && players ? matchPlayers(players, q, pools) : [];
  const browse = browseAll ? allClubs : allClubs.slice(0, BROWSE_PAGE);
  const reset = () => {
    setShown(RESULTS_PAGE);
    setShownPlayers(RESULTS_PAGE);
  };
  const teamCount = results.reduce((sum, c) => sum + c.teams.length, 0);
  const status =
    results.length === 0 && playerResults.length === 0
      ? wantPlayers && !players
        ? t.start.searching
        : t.start.nothingMatches(query.trim())
      : [
          results.length > 0 ? `${t.n.clubs(results.length)}, ${t.n.teams(teamCount)}` : '',
          playerResults.length > 0 ? t.n.players(playerResults.length) : '',
        ]
          .filter(Boolean)
          .join(' · ');

  const filters = [
    (index.regions ?? []).find((r) => r.id === region)?.name,
    (index.ageGroups ?? []).find((a) => a.id === ageGroup)?.name,
  ].filter(Boolean);

  return (
    <section className="card picker" aria-label={t.start.searchLabel}>
      {heading && <h2>{t.start.findHeading}</h2>}
      <label className="field search-field">
        <span className="sr-only">{t.start.searchLabel}</span>
        <input
          type="search"
          placeholder={t.start.searchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            reset();
          }}
        />
      </label>
      {/* Most people only type a name, so the two filters stay folded until asked for. */}
      <details className="filters">
        <summary>
          {t.start.filters}
          {filters.length > 0 && <span className="filters-on"> · {filters.join(' · ')}</span>}
        </summary>
        <div className="filter-row">
          <label className="field">
            <span>{t.start.region}</span>
            <select
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                reset();
              }}
            >
              <option value="">{t.start.allRegions}</option>
              {(index.regions ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t.start.ageGroup}</span>
            <select
              value={ageGroup}
              onChange={(e) => {
                setAgeGroup(e.target.value);
                reset();
              }}
            >
              <option value="">{t.start.allAgeGroups}</option>
              {(index.ageGroups ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      {searching ? (
        <>
          <p className="muted small" role="status">
            {status}
          </p>
          {results.length > 0 && (
            <ul className="result-list">
              {results.slice(0, shown).map((club) => (
                <li key={club.slug} className="result-row">
                  <RowLink to={href('club', club.slug)}>
                    <span className="result-vs club-name">{club.name}</span>
                    <span className="muted small">{t.n.teams(club.teams.length)}</span>
                  </RowLink>
                  <ul className="club-teams">
                    {club.teams.slice(0, CLUB_TEAMS).map(({ team, pool }) => (
                      <li key={`${pool.id}-${team.id}`}>
                        <RowLink to={href('team', pool.id, team.id)}>
                          <span className="result-main">
                            <span className="result-vs">{team.name}</span>
                            <span className="result-venue">{poolLabel(pool)}</span>
                          </span>
                          {team.position ? <span className="muted small">{t.start.place(team.position)}</span> : null}
                        </RowLink>
                      </li>
                    ))}
                    {club.teams.length > CLUB_TEAMS && (
                      <li>
                        <RowLink to={href('club', club.slug)}>
                          <span className="result-venue">{t.start.allTeams(club.teams.length)}</span>
                        </RowLink>
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {results.length > shown && (
            <button type="button" className="button" onClick={() => setShown((n) => n + RESULTS_PAGE)}>
              {t.start.showMore(results.length - shown)}
            </button>
          )}
          {playerResults.length > 0 && (
            <>
              <h3 className={results.length > 0 ? 'results-head after-clubs' : 'results-head'}>{t.common.players}</h3>
              <ul className="result-list">
                {playerResults.slice(0, shownPlayers).flatMap(({ player, teams }) =>
                  // One row per team the player plays for: each leads to their games in that pool.
                  teams.map(({ team, pool }) => (
                    <li key={`${player.id}-${pool.id}-${team.id}`} className="result-row">
                      <RowLink to={href('player', pool.id, player.id)}>
                        <span className="result-main">
                          <span className="result-vs">{player.name}</span>
                          <span className="result-venue">
                            {team.name} · {pool.name}
                          </span>
                        </span>
                        <span className="muted small">{player.rating ?? t.common.unrated}</span>
                      </RowLink>
                    </li>
                  )),
                )}
              </ul>
              {playerResults.length > shownPlayers && (
                <button type="button" className="button" onClick={() => setShownPlayers((n) => n + RESULTS_PAGE)}>
                  {t.start.showMorePlayers(playerResults.length - shownPlayers)}
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <p className="muted small" role="status">
            {t.n.clubs(allClubs.length)}
            {index.season ? ` · ${index.season.name}` : ''}
          </p>
          <ul className="result-list">
            {browse.map((club) => (
              <li key={club.slug} className="result-row">
                <RowLink to={href('club', club.slug)}>
                  <span className="result-vs">{club.name}</span>
                  <span className="muted small">{t.n.teams(club.teams.length)}</span>
                </RowLink>
              </li>
            ))}
          </ul>
          {allClubs.length > BROWSE_PAGE && (
            <button type="button" className="button" onClick={() => setBrowseAll((v) => !v)}>
              {browseAll ? t.start.showFewerClubs : t.start.showAllClubs(allClubs.length)}
            </button>
          )}
        </>
      )}
    </section>
  );
}
