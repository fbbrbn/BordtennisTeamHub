import { useId, useState, type Dispatch } from 'react';
import { formatDay, formatTime, isPast } from './format';
import { availabilityOf } from './planner';
import type { Action } from './state';
import type { Availability, Fixture, FixturePlan, Override, PlannerState } from './types';

interface MatchProps {
  item: FixturePlan;
  state: PlannerState;
  dispatch: Dispatch<Action>;
  nameOf: (id: string) => string;
}

type RowStatus = 'plays' | 'reserve' | 'rest' | 'out';
const STATUS_LABEL: Record<RowStatus, string> = {
  plays: 'Plays',
  reserve: 'Reserve',
  rest: 'Resting',
  out: "Can't play",
};

const ANSWERS: { value: Exclude<Availability, 'unknown'>; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

export function PlannedMatch({ item, state, dispatch, nameOf }: MatchProps) {
  const f = item.fixture;
  const [editing, setEditing] = useState(false);
  const active = state.players.filter((p) => p.active);
  const inLineup = new Set(item.lineup);
  const isReserve = new Set(item.reserves);

  return (
    <article className="card match">
      <MatchHeading fixture={f} editing={editing} onEdit={() => setEditing((v) => !v)} />

      {editing && (
        <FixtureForm
          initial={f}
          onSubmit={(patch) => {
            dispatch({ type: 'updateFixture', id: f.id, patch });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onDelete={() => {
            if (window.confirm('Delete this match from the plan?')) dispatch({ type: 'removeFixture', id: f.id });
          }}
        />
      )}

      <p className="match-lineup">
        <span className="label">Lineup</span>
        <span>{item.lineup.length > 0 ? item.lineup.map(nameOf).join(' · ') : 'Nobody available yet'}</span>
      </p>

      <MatchNotices item={item} nameOf={nameOf} />

      {active.length === 0 ? (
        <p className="muted">Add players to the roster to plan this match.</p>
      ) : (
        <ul className="player-rows">
          {active.map((p) => {
            const answer = availabilityOf(state, f.id, p.id);
            const override = state.overrides[f.id]?.[p.id];
            const status: RowStatus = inLineup.has(p.id)
              ? 'plays'
              : override === 'out'
                ? 'rest'
                : isReserve.has(p.id)
                  ? 'reserve'
                  : 'out';
            return (
              <li key={p.id} className="player-row">
                <span className="player-name">{p.name}</span>
                <span className={`status status-${status}`}>
                  {STATUS_LABEL[status]}
                  {override === 'in' && <span className="sr-only"> (set by captain)</span>}
                </span>
                <AnswerButtons
                  name={p.name}
                  value={answer}
                  onChange={(value) => dispatch({ type: 'availability', fixtureId: f.id, playerId: p.id, value })}
                />
                <select
                  className="pick"
                  aria-label={`Selection for ${p.name}`}
                  value={override ?? 'auto'}
                  onChange={(e) =>
                    dispatch({
                      type: 'override',
                      fixtureId: f.id,
                      playerId: p.id,
                      value: e.target.value === 'auto' ? null : (e.target.value as Override),
                    })
                  }
                >
                  <option value="auto">Auto</option>
                  <option value="in">Must play</option>
                  <option value="out">Rest</option>
                </select>
              </li>
            );
          })}
        </ul>
      )}

      <div className="match-foot">
        <button
          type="button"
          className="button"
          disabled={item.lineup.length === 0}
          onClick={() => dispatch({ type: 'markPlayed', fixtureId: f.id, playerIds: item.lineup })}
        >
          Mark as played
        </button>
      </div>
    </article>
  );
}

export function PlayedMatch({ item, state, dispatch, nameOf }: MatchProps) {
  const f = item.fixture;
  const [editing, setEditing] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const time = formatTime(f.date);

  return (
    <li className="played">
      <div className="played-main">
        <span className="played-when">
          {formatDay(f.date)}
          {time && <span className="muted"> {time}</span>}
        </span>
        <span className="played-vs">
          vs {f.opponent || 'opponent not set'} <span className="tag">{f.home ? 'Home' : 'Away'}</span>
        </span>
        <span className="played-by">{item.lineup.length > 0 ? item.lineup.map(nameOf).join(', ') : 'Nobody recorded'}</span>
        <button
          type="button"
          className="link-button"
          aria-expanded={editing}
          onClick={() => {
            setChosen(f.playedBy ?? []);
            setEditing((v) => !v);
          }}
        >
          Edit
        </button>
      </div>
      {editing && (
        <div className="played-edit">
          <fieldset>
            <legend>Who played?</legend>
            <div className="check-grid">
              {state.players.map((p) => (
                <label key={p.id} className="check">
                  <input
                    type="checkbox"
                    checked={chosen.includes(p.id)}
                    onChange={(e) =>
                      setChosen((c) => (e.target.checked ? [...c, p.id] : c.filter((id) => id !== p.id)))
                    }
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="button-row">
            <button
              type="button"
              className="button primary"
              onClick={() => {
                dispatch({ type: 'markPlayed', fixtureId: f.id, playerIds: chosen });
                setEditing(false);
              }}
            >
              Save
            </button>
            <button type="button" className="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="button quiet"
              onClick={() => {
                dispatch({ type: 'unmarkPlayed', fixtureId: f.id });
                setEditing(false);
              }}
            >
              Not played yet
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function MatchHeading({ fixture, editing, onEdit }: { fixture: Fixture; editing: boolean; onEdit: () => void }) {
  const time = formatTime(fixture.date);
  return (
    <header className="match-head">
      <div>
        <div className="match-when">
          {formatDay(fixture.date)}
          {time && <span className="muted"> · {time}</span>}
        </div>
        <h3 className="match-vs">
          vs {fixture.opponent || 'opponent not set'}{' '}
          <span className={`tag ${fixture.home ? 'tag-home' : ''}`}>{fixture.home ? 'Home' : 'Away'}</span>
        </h3>
      </div>
      <button type="button" className="link-button" aria-expanded={editing} onClick={onEdit}>
        Edit
      </button>
    </header>
  );
}

function MatchNotices({ item, nameOf }: { item: FixturePlan; nameOf: (id: string) => string }) {
  const notes: { tone: 'warn' | 'info'; text: string }[] = [];
  if (item.missing > 0) {
    notes.push({
      tone: 'warn',
      text: `${item.missing} ${item.missing === 1 ? 'place is' : 'places are'} still open: nobody else is available.`,
    });
  }
  if (item.surplus > 0) {
    notes.push({ tone: 'warn', text: `${item.surplus} more ${item.surplus === 1 ? 'player is' : 'players are'} set to "Must play" than there are places.` });
  }
  if (item.conflicts.length > 0) {
    notes.push({ tone: 'warn', text: `${item.conflicts.map(nameOf).join(', ')} set to "Must play" but answered No.` });
  }
  if (isPast(item.fixture.date)) {
    notes.push({ tone: 'info', text: 'This date has passed. Mark the match as played to keep the season count right.' });
  }
  if (notes.length === 0) return null;
  return (
    <ul className="notices">
      {notes.map((n) => (
        <li key={n.text} className={`notice notice-${n.tone}`}>
          <span className="notice-icon" aria-hidden="true">{n.tone === 'warn' ? '!' : 'i'}</span>
          <span className="sr-only">{n.tone === 'warn' ? 'Warning: ' : 'Note: '}</span>
          {n.text}
        </li>
      ))}
    </ul>
  );
}

function AnswerButtons({ name, value, onChange }: { name: string; value: Availability; onChange: (v: Availability) => void }) {
  return (
    <div className="answers" role="group" aria-label={`Can ${name} play?`}>
      {ANSWERS.map((a) => (
        <button
          key={a.value}
          type="button"
          className={`answer answer-${a.value}`}
          aria-pressed={value === a.value}
          onClick={() => onChange(value === a.value ? 'unknown' : a.value)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export interface FixtureInput {
  date: string;
  opponent: string;
  home: boolean;
}

export function FixtureForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
  cancelLabel = 'Cancel',
}: {
  initial?: Fixture;
  onSubmit: (value: FixtureInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  cancelLabel?: string;
}) {
  const id = useId();
  const [day, setDay] = useState(initial?.date.split('T')[0] ?? '');
  const [time, setTime] = useState(initial ? (initial.date.split('T')[1] ?? '') : '19:00');
  const [opponent, setOpponent] = useState(initial?.opponent ?? '');
  const [home, setHome] = useState(initial?.home ?? true);

  return (
    <form
      className="fixture-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!day) return;
        onSubmit({ date: time ? `${day}T${time}` : day, opponent: opponent.trim(), home });
      }}
    >
      <label className="field">
        <span>Date</span>
        <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
      </label>
      <label className="field">
        <span>Time</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <label className="field grow">
        <span>Opponent</span>
        <input value={opponent} placeholder="Club and team number" onChange={(e) => setOpponent(e.target.value)} />
      </label>
      <fieldset className="field">
        <legend>Venue</legend>
        <div className="radio-row">
          <label className="check">
            <input type="radio" name={`${id}-venue`} checked={home} onChange={() => setHome(true)} /> Home
          </label>
          <label className="check">
            <input type="radio" name={`${id}-venue`} checked={!home} onChange={() => setHome(false)} /> Away
          </label>
        </div>
      </fieldset>
      <div className="button-row">
        <button type="submit" className="button primary">
          {initial ? 'Save match' : 'Add match'}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        {onDelete && (
          <button type="button" className="button quiet" onClick={onDelete}>
            Delete match
          </button>
        )}
      </div>
    </form>
  );
}
