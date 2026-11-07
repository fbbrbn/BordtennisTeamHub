import { useState, type Dispatch } from 'react';
import { t } from '../i18n';
import type { Action } from './state';
import type { PlannerState } from './types';

export function RosterEditor({ state, dispatch, bare = false }: { state: PlannerState; dispatch: Dispatch<Action>; bare?: boolean }) {
  const [name, setName] = useState('');
  const empty = state.players.length === 0;

  return (
    <section className={bare ? 'roster-editor' : 'card roster-editor'}>
      {!bare && (
        <div className="section-head">
          <h2>{t.planner.players}</h2>
          {!empty && <span className="muted">{t.planner.active(state.players.filter((p) => p.active).length)}</span>}
        </div>
      )}
      {empty && (
        <p className="muted">{t.planner.rosterIntro}</p>
      )}
      {!empty && (
        <ul className="roster">
          {state.players.map((p) => (
            <li key={p.id} className={p.active ? 'roster-row' : 'roster-row inactive'}>
              <input
                className="roster-name"
                aria-label={t.planner.playerName}
                value={p.name}
                onChange={(e) => dispatch({ type: 'updatePlayer', id: p.id, patch: { name: e.target.value } })}
              />
              <input
                className="roster-rating"
                aria-label={t.planner.ratingFor(p.name)}
                inputMode="numeric"
                placeholder={t.common.rating}
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
                {t.planner.activeLabel}
              </label>
              <button
                type="button"
                className="link-button"
                aria-label={t.planner.removeLabel(p.name)}
                onClick={() => {
                  const ok = window.confirm(t.planner.removeConfirm(p.name));
                  if (ok) dispatch({ type: 'removePlayer', id: p.id });
                }}
              >
                {t.planner.remove}
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
        <input aria-label={t.planner.newPlayer} placeholder={t.planner.playerName} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="button primary">
          {t.planner.addPlayer}
        </button>
      </form>
    </section>
  );
}
