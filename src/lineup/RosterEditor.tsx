import { useState, type Dispatch } from 'react';
import type { Action } from './state';
import type { PlannerState } from './types';

export function RosterEditor({ state, dispatch, bare = false }: { state: PlannerState; dispatch: Dispatch<Action>; bare?: boolean }) {
  const [name, setName] = useState('');
  const empty = state.players.length === 0;

  return (
    <section className={bare ? 'roster-editor' : 'card roster-editor'}>
      {!bare && (
        <div className="section-head">
          <h2>Players</h2>
          {!empty && <span className="muted">{state.players.filter((p) => p.active).length} active</span>}
        </div>
      )}
      {empty && (
        <p className="muted">
          Start with your team's players. Ratings are optional: they only decide the order of names in a lineup.
        </p>
      )}
      {!empty && (
        <ul className="roster">
          {state.players.map((p) => (
            <li key={p.id} className={p.active ? 'roster-row' : 'roster-row inactive'}>
              <input
                className="roster-name"
                aria-label="Player name"
                value={p.name}
                onChange={(e) => dispatch({ type: 'updatePlayer', id: p.id, patch: { name: e.target.value } })}
              />
              <input
                className="roster-rating"
                aria-label={`Rating for ${p.name}`}
                inputMode="numeric"
                placeholder="Rating"
                value={p.rating ?? ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  const rating = value === '' ? undefined : Number(value);
                  if (rating === undefined || Number.isFinite(rating)) {
                    dispatch({ type: 'updatePlayer', id: p.id, patch: { rating } });
                  }
                }}
              />
              <label className="check">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={(e) => dispatch({ type: 'updatePlayer', id: p.id, patch: { active: e.target.checked } })}
                />
                Active
              </label>
              <button
                type="button"
                className="link-button"
                aria-label={`Remove ${p.name}`}
                onClick={() => {
                  const ok = window.confirm(
                    `Remove ${p.name}? Their answers and played matches in this plan are removed too. To keep their history, untick Active instead.`,
                  );
                  if (ok) dispatch({ type: 'removePlayer', id: p.id });
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="add-player"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          dispatch({ type: 'addPlayer', name });
          setName('');
        }}
      >
        <input aria-label="New player name" placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="button primary">
          Add player
        </button>
      </form>
    </section>
  );
}
