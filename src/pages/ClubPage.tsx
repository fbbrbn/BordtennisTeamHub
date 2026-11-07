import { NotFound, PageState } from '../components/ui';
import { loadIndex, useLoaded } from '../data/load';
import type { DataIndex } from '../data/model';
import { t } from '../i18n';
import { href } from '../lib/router';
import { ordinal } from '../lib/text';
import { groupByClub } from './StartPage';

export function ClubPage({ slug }: { slug: string }) {
  const index = useLoaded(loadIndex, 'index');
  if (index.status !== 'ready') return <PageState state={index} what="club" />;
  return <ClubView index={index.data} slug={slug} />;
}

function ClubView({ index, slug }: { index: DataIndex; slug: string }) {
  const club = groupByClub(index.pools).find((c) => c.slug === slug);
  if (!club) return <NotFound what="club" />;
  const portalId = index.clubs?.find((c) => c.slug === slug)?.id ?? null;
  const pools = new Set(club.teams.map((t) => t.pool.id));

  // One section per age group and region, e.g. "Senior · ØST".
  const sections = new Map<string, typeof club.teams>();
  for (const entry of club.teams) {
    const key = [entry.pool.ageGroupName, entry.pool.regionName].filter(Boolean).join(' · ') || entry.pool.league;
    sections.set(key, [...(sections.get(key) ?? []), entry]);
  }

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="eyebrow">{t.club.eyebrow(index.season?.name ?? null)}</p>
        <h1>{club.name}</h1>
        <p className="muted">{t.club.teamsInPools(club.teams.length, pools.size)}</p>
        {portalId && index.season && (
          <div className="button-row">
            <a
              className="button"
              href={`https://www.bordtennisportalen.dk/DBTU/HoldTurnering/Stilling/#6,${index.season.id},,,,,,${portalId},`}
              target="_blank"
              rel="noreferrer"
            >
              {t.common.openOnPortal}
            </a>
          </div>
        )}
      </header>

      {[...sections].map(([title, entries]) => (
        <section key={title} className="card">
          <h2>{title}</h2>
          <ul className="result-list">
            {entries.map(({ team, pool }) => (
              <li key={`${pool.id}-${team.id}`} className="result-row">
                <div className="result-main">
                  <a className="result-vs" href={href('team', pool.id, team.id)}>
                    {team.name}
                  </a>
                  <span className="result-venue">
                    <a href={href('pool', pool.id)}>{pool.name}</a>
                  </span>
                </div>
                <div className="result-side">
                  {team.position ? (
                    <span>
                      <strong>{ordinal(team.position)}</strong>
                      <span className="muted small">{t.club.of(pool.teams.length, team.points ?? 0)}</span>
                    </span>
                  ) : (
                    <span className="muted small">{t.club.notStarted}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
