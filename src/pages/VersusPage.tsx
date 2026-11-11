import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { OddsBar } from '../components/Odds';
import { dayWithYear, matchDay, NotFound, PageState, percent, RowLink, useShowAll } from '../components/ui';
import { gameChance, teamRoster, type Odds } from '../data/forecast';
import { loadHeadToHead, loadIndex, loadPlayers, loadPool, useLoaded } from '../data/load';
import type { Player, PlayerEntry, PoolData, PoolRef } from '../data/model';
import { opponentOf, teamMatches, teamsById } from '../data/stats';
import { playerTeam, versus, type Versus, type VersusPlayer, type VersusStep } from '../data/versus';
import { t } from '../i18n';
import { useMyTeam, type FollowedTeam } from '../lib/follow';
import { href } from '../lib/router';
import { matchPlayers } from './StartPage';

/** A player as the address names them: the pool to take them from, and their id. */
export interface PlayerPick {
  poolId: string;
  playerId: string;
}

/** Rows a list starts with; the rest wait behind a button. */
const ROWS = 10;
const SEARCH_ROWS = 20;

/**
 * Player against player: `#/vs` picks the first player, `#/vs/<pool>/<player>` the opponent, and
 * `#/vs/<pool>/<player>/<pool>/<player>` shows the chance and why. `match` is the team match the
 * single belongs to (from the match preview's matchup table).
 */
export function VersusPage({ first, second, matchId }: { first: PlayerPick | null; second: PlayerPick | null; matchId: string | null }) {
  if (!first) return <ChooseFirst />;
  if (!second) return <ChooseOpponent first={first} />;
  return <Comparison first={first} second={second} matchId={matchId} />;
}

function Comparison({ first, second, matchId }: { first: PlayerPick; second: PlayerPick; matchId: string | null }) {
  const loaded = useLoaded(() => Promise.all([loadPool(first.poolId), loadPool(second.poolId)]), `${first.poolId}/${second.poolId}`);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="player" />;
  const [poolA, poolB] = loaded.data;
  const a = poolA.players.find((p) => p.id === first.playerId);
  const b = poolB.players.find((p) => p.id === second.playerId);
  if (!a || !b) return <NotFound what="player" />;
  if (a.id === b.id) return <ChooseOpponent first={first} />;
  return <ComparisonView a={{ pool: poolA, player: a }} b={{ pool: poolB, player: b }} matchId={matchId} />;
}

function ComparisonView({ a, b, matchId }: { a: VersusPlayer; b: VersusPlayer; matchId: string | null }) {
  const result = useMemo(() => versus(a, b, { matchId }), [a, b, matchId]);
  const samePool = a.pool.pool.id === b.pool.pool.id;
  const [nameA, nameB] = [a.player.name, b.player.name];
  // A single cannot end level: the bar has the two players' shares.
  const odds: Odds = { win: result.chance, draw: 0, loss: 1 - result.chance, expectedGames: result.chance, totalGames: 1, drawPossible: false };
  const teams = teamsById(a.pool);
  const match = result.match;
  const share100 = gameChance(100, 0, result.scale);

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">
          {t.versus.title}
          {samePool && (
            <>
              {' · '}
              <a href={href('pool', a.pool.pool.id)}>{a.pool.pool.name}</a>
            </>
          )}
        </p>
        <h1 className="scoreboard">
          <span className="score-row">
            <a href={href('player', a.pool.pool.id, a.player.id)}>{nameA}</a>
          </span>
          <span className="score-row">
            <span>
              <span className="score-vs">{t.common.vs} </span>
              <a href={href('player', b.pool.pool.id, b.player.id)}>{nameB}</a>
            </span>
          </span>
        </h1>
        {match && (
          <p className="muted">
            <a href={href('match', a.pool.pool.id, match.id)}>
              {t.versus.inMatch(teams.get(match.homeTeamId)?.name ?? t.common.home, teams.get(match.awayTeamId)?.name ?? t.common.away, matchDay(match.date))}
            </a>
          </p>
        )}
      </header>

      <section className="card">
        <p className="odds-headline">
          <strong>{percent(result.chance)}</strong> {t.preview.winFor(nameA)}
        </p>
        <OddsBar odds={odds} sides={{ win: nameA, loss: nameB }} />
        <div className="steps">
          <p className="steps-head steps-head-split">
            <span>{t.versus.why}</span>
            <span>{t.reasons.chanceToWin}</span>
          </p>
          {result.steps.map((step) => (
            <div key={step.reason} className="step">
              <p className="step-line">
                <span>{t.versus.steps[step.reason]}</span>
                <span className="step-win">{percent(step.chance)}</span>
              </p>
              {stepNotes(step, a, b, result).map((note) => (
                <p key={note} className="step-note">
                  {note}
                </p>
              ))}
            </div>
          ))}
        </div>
        <details className="why">
          <summary>{t.common.howWorkedOut}</summary>
          <p className="muted small">
            {t.versus.gap(Math.round(Math.abs(result.gap)), result.gap >= 0 ? nameA : nameB)}{' '}
            {samePool ? t.versus.curve(share100) : t.versus.curveBoth(share100)}
          </p>
          <p className="muted small">{t.versus.how}</p>
        </details>
      </section>

      <HeadToHeadCard a={a.player} b={b.player} />

      <div className="button-row">
        <a className="button" href={href('vs', a.pool.pool.id, a.player.id)}>
          {t.versus.other}
        </a>
      </div>
    </div>
  );
}

/** What each step rests on, one line per player it concerns. */
function stepNotes(step: VersusStep, a: VersusPlayer, b: VersusPlayer, result: Versus): string[] {
  const players = [a.player, b.player] as const;
  /** A line for each player the step concerns: `points` rounded for the text, `part` as counted. */
  const each = (line: (player: Player, points: number, part: number) => string | null) =>
    ([0, 1] as const).flatMap((i) => {
      const text = line(players[i], Math.round(step.points[i]), step.points[i]);
      return text === null ? [] : [text];
    });
  switch (step.reason) {
    case 'rating':
      return [players.map((p, i) => t.versus.rating(p.name, Math.round(step.points[i]), p.rating === null)).join(' · ')];
    case 'form':
      return each((p, points) => (p.form && p.form.games > 0 ? t.versus.form(p.name, points, p.form.above, p.form.games) : null));
    case 'last':
      return each((p, points) => (p.form?.last && p.form.last.games > 0 ? t.versus.form(p.name, points, p.form.last.above, p.form.last.games) : null));
    case 'youth':
      return each((p, points, part) => (part !== 0 ? t.versus.youth(p.name, points) : null));
    case 'unrated':
      return each((p, points, part) => (part !== 0 ? t.versus.unrated(p.name, points) : null));
    case 'home':
      // No home edge in veteran pools.
      if (result.home === null || step.points[result.home] === 0) return [t.reasons.noHomeEdge];
      return [t.versus.home(players[result.home].name, Math.round(step.points[result.home]))];
  }
}

/** Their singles against each other, this season and before (src/data/headtohead.ts). */
function HeadToHeadCard({ a, b }: { a: Player; b: Player }) {
  const loaded = useLoaded(() => loadHeadToHead([a.id]), `h2h:${a.id}`);
  const record = loaded.status === 'ready' ? loaded.data.records.get(a.id)?.get(b.id) : undefined;
  const from = loaded.status === 'ready' ? loaded.data.from : '';
  return (
    <section className="card">
      <h2>{t.versus.h2h}</h2>
      {loaded.status === 'loading' ? (
        <p className="muted">{t.states.loadingShort}</p>
      ) : record ? (
        <>
          <p>{t.versus.h2hRecord(a.name, b.name, record[0], record[1], from, dayWithYear(record[2]))}</p>
          {record[0] + record[1] > 1 && <p className="muted small">{t.versus.h2hLast(dayWithYear(record[2]), record[3] === 1 ? a.name : b.name)}</p>}
        </>
      ) : (
        <p>{t.versus.h2hNone(from)}</p>
      )}
      <p className="muted small">{t.versus.h2hNotCounted}</p>
    </section>
  );
}

/** Highest rated first; unrated players last, by name. */
function byRating(pool: PoolData, ids: string[]): Player[] {
  const players = new Map(pool.players.map((p) => [p.id, p]));
  return ids
    .flatMap((id) => (players.has(id) ? [players.get(id)!] : []))
    .sort((x, y) => (y.rating ?? -Infinity) - (x.rating ?? -Infinity) || x.name.localeCompare(y.name, 'da'));
}

function ChooseOpponent({ first }: { first: PlayerPick }) {
  const loaded = useLoaded(() => loadPool(first.poolId), first.poolId);
  if (loaded.status !== 'ready') return <PageState state={loaded} what="player" />;
  const player = loaded.data.players.find((p) => p.id === first.playerId);
  if (!player) return <NotFound what="player" />;
  return <OpponentPicker pool={loaded.data} player={player} />;
}

/** The first player is chosen: their next opponent's players first, then the rest of the pool, or a search. */
function OpponentPicker({ pool, player }: { pool: PoolData; player: Player }) {
  const teams = teamsById(pool);
  const team = playerTeam(pool, player.id);
  const next = team ? teamMatches(pool, team).find((m) => !m.score) : undefined;
  const nextOpponent = next && team ? opponentOf(next, team) : null;
  const opponents = nextOpponent ? byRating(pool, teamRoster(pool, nextOpponent)).filter((p) => p.id !== player.id) : [];
  const listed = new Set(opponents.map((p) => p.id));
  const rest = byRating(
    pool,
    pool.players.map((p) => p.id).filter((id) => id !== player.id && !listed.has(id)),
  );
  const [restShown, restButton] = useShowAll(rest, ROWS);
  const to = (poolId: string, id: string) => href('vs', pool.pool.id, player.id, poolId, id);
  const teamName = (id: string) => {
    const teamId = playerTeam(pool, id);
    return teamId ? teams.get(teamId)?.name : undefined;
  };

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">
          {t.versus.title} · <a href={href('pool', pool.pool.id)}>{pool.pool.name}</a>
        </p>
        <h1 className="scoreboard">
          <span className="score-row">
            <a href={href('player', pool.pool.id, player.id)}>{player.name}</a>
          </span>
          <span className="score-row">
            <span className="score-vs">{t.common.vs} …</span>
          </span>
        </h1>
      </header>

      <section className="card picker">
        <h2>{t.versus.pickOpponent}</h2>
        <PlayerSearch exclude={player.id} link={to}>
          {opponents.length > 0 && nextOpponent && (
            <>
              <h3 className="results-head">{t.versus.nextOpponent(teams.get(nextOpponent)?.name ?? t.common.team)}</h3>
              <ul className="result-list">
                {opponents.map((p) => (
                  <PlayerRow key={p.id} to={to(pool.pool.id, p.id)} name={p.name} rating={p.rating} />
                ))}
              </ul>
            </>
          )}
          {rest.length > 0 && (
            <>
              <h3 className={opponents.length > 0 ? 'results-head after-clubs' : 'results-head'}>{t.versus.restOfPool}</h3>
              <ul className="result-list">
                {restShown.map((p) => (
                  <PlayerRow key={p.id} to={to(pool.pool.id, p.id)} name={p.name} detail={teamName(p.id)} rating={p.rating} />
                ))}
              </ul>
              {restButton}
            </>
          )}
        </PlayerSearch>
      </section>
    </div>
  );
}

/** No player chosen yet: your team's players, or a search. */
function ChooseFirst() {
  const myTeam = useMyTeam();
  return (
    <div className="dash">
      <header className="dash-head">
        <h1>{t.versus.title}</h1>
        <p className="muted">{t.versus.startNote}</p>
      </header>
      <section className="card picker">
        <h2>{t.versus.pickFirst}</h2>
        <PlayerSearch exclude={null} link={(poolId, id) => href('vs', poolId, id)}>
          {myTeam && <TeamPlayers team={myTeam} />}
        </PlayerSearch>
      </section>
    </div>
  );
}

function TeamPlayers({ team }: { team: FollowedTeam }) {
  const loaded = useLoaded(() => loadPool(team.poolId), team.poolId);
  if (loaded.status !== 'ready') return null;
  const players = byRating(loaded.data, teamRoster(loaded.data, team.teamId));
  if (players.length === 0) return null;
  return (
    <>
      <h3 className="results-head">{team.name}</h3>
      <ul className="result-list">
        {players.map((p) => (
          <PlayerRow key={p.id} to={href('vs', team.poolId, p.id)} name={p.name} rating={p.rating} />
        ))}
      </ul>
    </>
  );
}

/**
 * A search across every player of the season, with `children` (quick picks) while nothing is typed.
 * Each result row leads to `link(pool, player)`: a player on several teams has a row per team.
 */
function PlayerSearch({ exclude, link, children }: { exclude: string | null; link: (poolId: string, playerId: string) => string; children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<{ players: PlayerEntry[]; pools: PoolRef[] } | null>(null);
  const searching = query.trim().length >= 2;
  // The player list is a separate file, loaded once someone starts typing.
  useEffect(() => {
    if (!searching || data) return;
    let cancelled = false;
    Promise.all([loadPlayers(), loadIndex()]).then(
      ([players, index]) => !cancelled && setData({ players: players.players, pools: index.pools }),
      () => !cancelled && setData({ players: [], pools: [] }),
    );
    return () => {
      cancelled = true;
    };
  }, [searching, data]);
  const rows = searching && data
    ? matchPlayers(data.players, query, data.pools)
        .filter((m) => m.player.id !== exclude)
        .flatMap(({ player, teams }) => teams.map(({ team, pool }) => ({ player, team, pool })))
    : [];
  const [shown, more] = useShowAll(rows, SEARCH_ROWS);

  return (
    <>
      <label className="field search-field">
        <span className="sr-only">{t.versus.searchLabel}</span>
        <input type="search" placeholder={t.versus.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {!searching ? (
        children
      ) : !data ? (
        <p className="muted small" role="status">
          {t.start.searching}
        </p>
      ) : rows.length === 0 ? (
        <p className="muted small" role="status">
          {t.versus.noPlayer(query.trim())}
        </p>
      ) : (
        <>
          <ul className="result-list">
            {shown.map(({ player, team, pool }) => (
              <PlayerRow
                key={`${player.id}-${pool.id}-${team.id}`}
                to={link(pool.id, player.id)}
                name={player.name}
                detail={`${team.name} · ${pool.name}`}
                rating={player.rating}
              />
            ))}
          </ul>
          {more}
        </>
      )}
    </>
  );
}

function PlayerRow({ to, name, detail, rating }: { to: string; name: string; detail?: string; rating: number | null }) {
  return (
    <li className="result-row">
      <RowLink to={to}>
        <span className="result-main">
          <span className="result-vs">{name}</span>
          {detail && <span className="result-venue">{detail}</span>}
        </span>
        <span className="muted small">{rating ?? t.common.unrated}</span>
      </RowLink>
    </li>
  );
}
