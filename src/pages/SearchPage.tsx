import { useEffect, useMemo, useState } from 'react';
import { RowLink, useShowAll } from '../components/ui';
import { loadIndex, loadPlayers, useLoaded } from '../data/load';
import type { DataIndex, NamedId, PlayerEntry, PoolRef } from '../data/model';
import { ageGroupsIn, leaguesIn, NO_FILTERS, search, type PlayerHit, type PoolHit, type SearchFilters, type SearchResults, type TeamHit } from '../data/search';
import { t } from '../i18n';
import { href, parseHash, replaceHash } from '../lib/router';

type Tab = 'pools' | 'teams' | 'players';
const TABS: readonly Tab[] = ['pools', 'teams', 'players'];
/** Rows a list starts with. */
const ROWS = 20;

/** The address of a search, e.g. every pool of a league: `#/search?union=4004&age=4006&league=Serie+4`. */
export function searchLink(filters: Partial<SearchFilters>, tab: Tab = 'pools'): string {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.union) params.set('union', filters.union);
  if (filters.age) params.set('age', filters.age);
  if (filters.league) params.set('league', filters.league);
  if (tab !== 'pools') params.set('tab', tab);
  const text = params.toString();
  return `${href('search')}${text ? `?${text}` : ''}`;
}

/** "ØST (Sjælland, Lolland F.)" -> "ØST": the union's name without the area in brackets. */
const shortUnion = (name: string | undefined) => (name ?? '').replace(/\s*\(.*\)\s*$/, '');

/**
 * The advanced search: every pool, team and player of the season, by the portal's three levels
 * (union, age group and league) and by words. The address keeps the search.
 */
export function SearchPage({ query }: { query: URLSearchParams }) {
  const index = useLoaded(loadIndex, 'index');
  const players = useLoaded(loadPlayers, 'players');
  if (index.status === 'loading') return <p className="page-state">{t.states.loadingShort}</p>;
  if (index.status === 'error') return <p className="page-state muted">{t.start.clubsUnavailable}</p>;
  // Without the player list, the players tab is simply empty.
  const list = players.status === 'ready' ? players.data.players : players.status === 'error' ? [] : null;
  return <Search index={index.data} players={list} initial={fromQuery(query)} initialTab={tabFrom(query)} />;
}

function fromQuery(query: URLSearchParams): SearchFilters {
  return { query: query.get('q') ?? '', union: query.get('union') ?? '', age: query.get('age') ?? '', league: query.get('league') ?? '' };
}

function tabFrom(query: URLSearchParams): Tab {
  const tab = query.get('tab');
  return TABS.includes(tab as Tab) ? (tab as Tab) : 'pools';
}

/** Keeps only choices that exist: an age group of the union, a league of the union and age group. */
function valid(index: DataIndex, filters: SearchFilters): SearchFilters {
  const next = { ...filters };
  if (next.union && !(index.regions ?? []).some((r) => r.id === next.union)) next.union = '';
  if (next.age && !ageGroupsIn(index.pools, index.ageGroups ?? [], next.union).some((a) => a.id === next.age)) next.age = '';
  if (next.league && !leaguesIn(index.pools, next.union, next.age).includes(next.league)) next.league = '';
  return next;
}

function Search({ index, players, initial, initialTab }: { index: DataIndex; players: PlayerEntry[] | null; initial: SearchFilters; initialTab: Tab }) {
  const [filters, setFilters] = useState(() => valid(index, initial));
  const [tab, setTab] = useState(initialTab);
  const ages = ageGroupsIn(index.pools, index.ageGroups ?? [], filters.union);
  const leagues = leaguesIn(index.pools, filters.union, filters.age);
  const results = useMemo(() => search(index.pools, players, filters), [index.pools, players, filters]);
  const set = (change: Partial<SearchFilters>) => setFilters((current) => valid(index, { ...current, ...change }));
  const searched = filters.query !== '' || filters.union !== '' || filters.age !== '' || filters.league !== '';

  // The address keeps the search, so Back and a shared link come back to it (without a new history entry).
  useEffect(() => replaceHash(searchLink(filters, tab)), [filters, tab]);
  // And a new search address while the page is open (typed, or Forward) becomes the search.
  useEffect(() => {
    const follow = () => {
      const route = parseHash(window.location.hash);
      if (route.path[0] !== 'search') return;
      setFilters(valid(index, fromQuery(route.query)));
      setTab(tabFrom(route.query));
    };
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [index]);

  const count = (id: Tab) => (id === 'pools' ? results.pools.length : id === 'teams' ? results.teams.length : (results.players?.length ?? '…'));
  // A list starts short again whenever the search changes.
  const key = JSON.stringify(filters);

  return (
    <div className="dash">
      <header className="dash-head">
        <h1>{t.search.title}</h1>
      </header>

      <section className="card picker" aria-label={t.search.label}>
        <label className="field search-field">
          <span className="sr-only">{t.search.label}</span>
          <input type="search" placeholder={t.search.placeholder} value={filters.query} onChange={(e) => set({ query: e.target.value })} />
        </label>
        <div className="filter-grid">
          <Choice label={t.search.union} all={t.search.all} value={filters.union} options={index.regions ?? []} onChange={(union) => set({ union })} />
          <Choice label={t.search.ageGroup} all={t.search.all} value={filters.age} options={ages} onChange={(age) => set({ age })} />
          {/* Until the data has the leagues, there is nothing to choose. */}
          {leagues.length > 0 && (
            <Choice
              label={t.search.league}
              all={t.search.all}
              value={filters.league}
              options={leagues.map((name) => ({ id: name, name }))}
              onChange={(league) => set({ league })}
            />
          )}
        </div>
        {searched && (
          <p>
            <button type="button" className="link-button" onClick={() => setFilters(NO_FILTERS)}>
              {t.search.reset}
            </button>
          </p>
        )}
      </section>

      <div className="tabs" role="group" aria-label={t.search.tabsLabel}>
        {TABS.map((id) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
            {t.search.tabs[id]} <span className="tab-count">{count(id)}</span>
          </button>
        ))}
      </div>

      <section className="card">
        {tab === 'pools' && <Pools key={key} results={results} />}
        {tab === 'teams' && <Teams key={key} results={results} />}
        {tab === 'players' && <Players key={key} results={results} />}
      </section>
    </div>
  );
}

function Choice({ label, all, value, options, onChange }: { label: string; all: string; value: string; options: readonly NamedId[]; onChange: (id: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Where a pool belongs, when the results span several unions or age groups. */
function placeOf(pool: PoolRef, results: SearchResults): string[] {
  return [results.manyUnions ? shortUnion(pool.regionName) : '', results.manyAgeGroups ? (pool.ageGroupName ?? '') : ''].filter(Boolean);
}

function Pools({ results }: { results: SearchResults }) {
  const [shown, more] = useShowAll<PoolHit>(results.pools, ROWS);
  if (results.pools.length === 0) return <p className="muted">{t.search.none}</p>;
  return (
    <>
      <ul className="result-list">
        {shown.map(({ pool, average }) => (
          <li key={pool.id} className="result-row">
            <RowLink to={href('pool', pool.id)}>
              <span className="result-main">
                <span className="result-vs">{pool.name}</span>
                <span className="result-venue">{[...placeOf(pool, results), t.n.teams(pool.teams.length)].join(' · ')}</span>
              </span>
              {average !== null && <span className="muted small">{t.search.average(average)}</span>}
            </RowLink>
          </li>
        ))}
      </ul>
      {more}
      {results.pools.some((h) => h.average !== null) && <p className="muted small">{t.search.averageNote}</p>}
    </>
  );
}

function Teams({ results }: { results: SearchResults }) {
  const [shown, more] = useShowAll<TeamHit>(results.teams, ROWS);
  if (results.teams.length === 0) return <p className="muted">{t.search.none}</p>;
  return (
    <>
      <ul className="result-list">
        {shown.map(({ team, pool }) => (
          <li key={`${pool.id}-${team.id}`} className="result-row">
            <RowLink to={href('team', pool.id, team.id)}>
              <span className="result-main">
                <span className="result-vs">{team.name}</span>
                <span className="result-venue">{[...placeOf(pool, results), pool.name].join(' · ')}</span>
              </span>
              {team.position ? <span className="muted small">{t.start.place(team.position)}</span> : null}
            </RowLink>
          </li>
        ))}
      </ul>
      {more}
    </>
  );
}

function Players({ results }: { results: SearchResults }) {
  const hits = results.players ?? [];
  const [shown, more] = useShowAll<PlayerHit>(hits, ROWS);
  if (!results.players) return <p className="muted">{t.search.loadingPlayers}</p>;
  if (hits.length === 0) return <p className="muted">{t.search.none}</p>;
  return (
    <>
      <p className="muted small">{t.search.byRating}</p>
      <ul className="result-list">
        {shown.map(({ player, team, pool }) => (
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
        ))}
      </ul>
      {more}
    </>
  );
}
