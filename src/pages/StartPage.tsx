import { useMemo } from 'react';
import { href } from '../lib/router';
import { listSavedPlanners, newId } from '../lineup/storage';

export function StartPage() {
  const saved = useMemo(listSavedPlanners, []);
  const newKey = saved.length === 0 ? 'my-team' : newId(saved.map((s) => s.key));

  return (
    <>
      <section className="hero">
        <h1>Run your table tennis team</h1>
        <p>
          Plan who plays each team match and keep the season fair for everyone. Built for teams in the Danish
          table tennis team tournament.
        </p>
      </section>

      <section className="start-grid">
        <article className="card">
          <h2>Lineup planner</h2>
          <p className="muted">
            Collect who can play, get a fair rotation over the whole season, and share the plan in your team
            chat.
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
          <a className="button primary" href={href('lineup', newKey)}>
            {saved.length === 0 ? 'Start planning' : 'Plan another team'}
          </a>
        </article>

        <article className="card">
          <h2>Team and player statistics</h2>
          <p className="muted">
            Standings, results and per-player numbers from bordtennisportalen.dk, for any team. In progress: the
            match data import is being built.
          </p>
        </article>
      </section>
    </>
  );
}
