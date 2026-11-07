import { useEffect, useMemo, useState } from 'react';
import { FollowButton } from '../components/FollowButton';
import { ThinOdds } from '../components/Odds';
import { matchDay, matchTime } from '../components/ui';
import { clubSlug, fallbackClubName } from '../data/clubs';
import { fitScale, forecastMatch, lineupSize } from '../data/forecast';
import { loadIndex, loadPlayers, loadPool, useLoaded } from '../data/load';
import type { DataIndex, IndexTeam, PlayerEntry, PoolData, PoolRef } from '../data/model';
import { isHome, opponentOf, teamMatches, teamsById } from '../data/stats';
import { useFollowing, type FollowedTeam } from '../lib/follow';
import { readLastTeam } from '../lib/lastTeam';
import { t } from '../i18n';
import { href } from '../lib/router';
import { ordinal, percent } from '../lib/text';
import { plannedLineup } from '../lineup/planned';
import { listSavedPlanners, newId } from '../lineup/storage';

const fold = (s: string) => s.toLocaleLowerCase('da').normalize('NFKD').replace(/[̀-ͯ]/g, '');
const RESULTS_PAGE = 20;
const BROWSE_PAGE = 12;

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
        <h1>{following.length > 0 ? t.start.welcomeBack : t.start.findTeam}</h1>
        <p>{t.start.intro}</p>
      </section>

      {following.length > 0 && (
        <section className="stack" aria-labelledby="my-teams">
          <h2 id="my-teams">{t.start.myTeams}</h2>
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

      {following.length === 0 && !last && (
        <section className="card how-it-works">
          <h2>{t.start.howItWorks}</h2>
          <ol className="steps">
            {t.start.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      {index.status === 'ready' ? (
        <ClubSearch index={index.data} />
      ) : (
        <section className="card">
          <h2>{t.start.findHeading}</h2>
          <p className="muted">{index.status === 'loading' ? t.start.loadingClubs : t.start.clubsUnavailable}</p>
        </section>
      )}

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
          {forecast?.odds && (
            <span className="my-team-odds">
              <span>
                <strong>{percent(forecast.odds.win)}</strong> {t.odds.chanceToWin}
              </span>
              <ThinOdds odds={forecast.odds} />
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

function ClubSearch({ index }: { index: DataIndex }) {
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

  return (
    <section className="card picker">
      <h2>{t.start.findHeading}</h2>
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

      {searching ? (
        <>
          <p className="muted small" role="status">
            {status}
          </p>
          {results.length > 0 && (
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
          )}
          {results.length > shown && (
            <button type="button" className="button" onClick={() => setShown((n) => n + RESULTS_PAGE)}>
              {t.start.showMore(results.length - shown)}
            </button>
          )}
          {playerResults.length > 0 && (
            <>
              <h3 className={results.length > 0 ? 'results-head after-clubs' : 'results-head'}>{t.common.players}</h3>
              <ul className="club-list">
                {playerResults.slice(0, shownPlayers).map(({ player, teams }) => (
                  <li key={player.id} className="club-item">
                    <span>
                      <a className="club-name" href={href('player', teams[0].pool.id, player.id)}>
                        {player.name}
                      </a>
                      <span className="muted small"> {player.rating === null ? t.common.unrated : t.common.ratingOf(player.rating)}</span>
                    </span>
                    <ul className="club-teams">
                      {teams.map(({ team, pool }) => {
                        const club = team.club ?? fallbackClubName(team.name);
                        return (
                          <li key={`${pool.id}-${team.id}`}>
                            <a href={href('club', clubSlug(club))}>{club}</a>
                            {' · '}
                            <a href={href('team', pool.id, team.id)}>{team.name}</a>
                            <span className="muted small">
                              {' '}
                              {pool.ageGroupName ? `${pool.ageGroupName} · ` : ''}
                              {pool.name}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
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
            {t.n.clubs(allClubs.length)} · {t.n.pools(pools.length)}
            {index.season ? t.start.season(index.season.name) : ''}
          </p>
          <ul className="browse-list">
            {browse.map((club) => (
              <li key={club.slug}>
                <a href={href('club', club.slug)}>
                  <span className="browse-name">{club.name}</span>
                  <span className="muted small">{t.n.teams(club.teams.length)}</span>
                </a>
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
