import { useId, useState, type Dispatch } from 'react';
import { t } from '../i18n';
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

type RowStatus = 'plays' | 'reserve' | 'rest';
const ANSWERS: Exclude<Availability, 'unknown'>[] = ['yes', 'maybe', 'no'];

/**
 * One match to come. Folded, it is a single row: when, against whom and the lineup so far. Open, it
 * has every player's answer. Tapping the row opens and closes it.
 */
export function PlannedMatch({ item, state, dispatch, nameOf, startOpen = true }: MatchProps & { startOpen?: boolean }) {
  const f = item.fixture;
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(startOpen);
  const active = state.players.filter((p) => p.active);
  const inLineup = new Set(item.lineup);
  const isReserve = new Set(item.reserves);
  const notes = matchNotes(item, nameOf, active.length);
  const time = formatTime(f.date);
  const lineup =
    item.lineup.length > 0 ? item.lineup.map(nameOf).join(' · ') : item.unanswered.length > 0 ? t.planner.waitingAnswers : t.planner.nobodyCan;
  // The portal keeps its own matches up to date, so only the captain's own matches can be edited.
  const own = !f.portalId;

  return (
    <article className={open ? 'card match is-open' : 'card match'}>
      <h3 className="match-title">
        <button type="button" className="match-summary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="match-summary-main">
            <span className="match-when">
              {formatDay(f.date)}
              {time && ` · ${time}`}
            </span>
            <span className="match-vs">
              {t.common.vs} {f.opponent || t.planner.noOpponent}{' '}
              <span className={`tag ${f.home ? 'tag-home' : ''}`}>{f.home ? t.common.home : t.common.away}</span>
            </span>
            {!open && (
              <span className={item.lineup.length > 0 ? 'match-status' : 'match-status is-waiting'}>
                {lineup}
                {/* Names alone would look like a full lineup: say how many places are still open. */}
                {item.lineup.length > 0 && item.missing > 0 && <span className="match-open"> · {t.planner.openPlaces(item.missing)}</span>}
                {notes.some((n) => n.tone === 'warn') && (
                  <span className="match-alert">
                    <span aria-hidden="true">!</span>
                    <span className="sr-only">{t.planner.warning}</span>
                  </span>
                )}
              </span>
            )}
          </span>
        </button>
      </h3>

      {open && (
        <>
          <p className="match-lineup">
            <span className="label">{t.planner.lineup}</span>
            <span>{lineup}</span>
          </p>

          <MatchNotices notes={notes} />

          {active.length === 0 && <p className="muted">{t.planner.addPlayersFirst}</p>}
          {active.length > 0 && (
            <ul className="player-rows">
              {active.map((p) => {
                const answer = availabilityOf(state, f.id, p.id);
                const override = state.overrides[f.id]?.[p.id];
                // Said only when it adds something: the buttons already show who cannot play or has not answered.
                const status: RowStatus | null = inLineup.has(p.id) ? 'plays' : override === 'out' ? 'rest' : isReserve.has(p.id) ? 'reserve' : null;
                return (
                  <li key={p.id} className="player-row">
                    <span className="player-name">{p.name}</span>
                    {status && (
                      <span className={`status status-${status}`}>
                        {t.planner.status[status]}
                        {override === 'in' && <span className="sr-only">{t.planner.setByCaptain}</span>}
                      </span>
                    )}
                    <AnswerButtons
                      name={p.name}
                      value={answer}
                      onChange={(value) => dispatch({ type: 'availability', fixtureId: f.id, playerId: p.id, value })}
                    />
                    <select
                      className="pick"
                      aria-label={t.planner.selectionFor(p.name)}
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
                      <option value="auto">{t.planner.auto}</option>
                      <option value="in">{t.planner.mustPlay}</option>
                      <option value="out">{t.planner.rest}</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          )}

          {(own || isPast(f.date)) && (
            <div className="match-foot">
              {own && (
                <button type="button" className="button quiet" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
                  {t.planner.editMatch}
                </button>
              )}
              <button
                type="button"
                className="button"
                disabled={item.lineup.length === 0}
                onClick={() => dispatch({ type: 'markPlayed', fixtureId: f.id, playerIds: item.lineup })}
              >
                {t.planner.markPlayed}
              </button>
            </div>
          )}

          {editing && (
            <FixtureForm
              initial={f}
              onSubmit={(patch) => {
                dispatch({ type: 'updateFixture', id: f.id, patch });
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
              onDelete={() => {
                if (window.confirm(t.planner.deleteConfirm)) dispatch({ type: 'removeFixture', id: f.id });
              }}
            />
          )}
        </>
      )}
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
          {t.common.vs} {f.opponent || t.planner.noOpponent} <span className="tag">{f.home ? t.common.home : t.common.away}</span>
        </span>
        <span className="played-by">{item.lineup.length > 0 ? item.lineup.map(nameOf).join(', ') : t.planner.nobodyRecorded}</span>
        <button
          type="button"
          className="link-button"
          aria-expanded={editing}
          onClick={() => {
            setChosen(f.playedBy ?? []);
            setEditing((v) => !v);
          }}
        >
          {t.planner.edit}
        </button>
      </div>
      {editing && (
        <div className="played-edit">
          <fieldset>
            <legend>{t.planner.whoPlayed}</legend>
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
              {t.planner.save}
            </button>
            <button type="button" className="button" onClick={() => setEditing(false)}>
              {t.planner.cancel}
            </button>
            <button
              type="button"
              className="button quiet"
              onClick={() => {
                dispatch({ type: 'unmarkPlayed', fixtureId: f.id });
                setEditing(false);
              }}
            >
              {t.planner.notPlayedYet}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

interface Note {
  tone: 'warn' | 'info';
  text: string;
}

/**
 * What a captain should know about a match's lineup: open places, too many forced in, someone forced
 * in who cannot play, a date that has passed. Nothing while everybody is still to answer: the lineup
 * line says that already.
 */
function matchNotes(item: FixturePlan, nameOf: (id: string) => string, activeCount: number): Note[] {
  const notes: Note[] = [];
  if (item.missing > 0 && item.unanswered.length > 0) {
    if (item.unanswered.length < activeCount) {
      notes.push({ tone: 'info', text: t.planner.stillToAnswer(item.missing, item.unanswered.map(nameOf).join(', ')) });
    }
  } else if (item.missing > 0) {
    notes.push({ tone: 'warn', text: t.planner.everyoneAnswered(item.missing) });
  }
  if (item.surplus > 0) {
    notes.push({ tone: 'warn', text: t.planner.surplus(item.surplus) });
  }
  if (item.conflicts.length > 0) {
    notes.push({ tone: 'warn', text: t.planner.conflicts(item.conflicts.map(nameOf).join(', ')) });
  }
  if (isPast(item.fixture.date)) {
    notes.push({ tone: 'info', text: t.planner.datePassed });
  }
  return notes;
}

function MatchNotices({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="notices">
      {notes.map((n) => (
        <li key={n.text} className={`notice notice-${n.tone}`}>
          <span className="notice-icon" aria-hidden="true">{n.tone === 'warn' ? '!' : 'i'}</span>
          <span className="sr-only">{n.tone === 'warn' ? t.planner.warning : t.planner.note}</span>
          {n.text}
        </li>
      ))}
    </ul>
  );
}

function AnswerButtons({ name, value, onChange }: { name: string; value: Availability; onChange: (v: Availability) => void }) {
  return (
    <div className="answers" role="group" aria-label={t.planner.canPlay(name)}>
      {ANSWERS.map((a) => (
        <button
          key={a}
          type="button"
          className={`answer answer-${a}`}
          aria-pressed={value === a}
          onClick={() => onChange(value === a ? 'unknown' : a)}
        >
          {t.planner.answers[a]}
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
  cancelLabel = t.planner.cancel,
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
        <span>{t.planner.date}</span>
        <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
      </label>
      <label className="field">
        <span>{t.planner.time}</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <label className="field grow">
        <span>{t.planner.opponent}</span>
        <input value={opponent} placeholder={t.planner.opponentPlaceholder} onChange={(e) => setOpponent(e.target.value)} />
      </label>
      <fieldset className="field">
        <legend>{t.planner.venue}</legend>
        <div className="radio-row">
          <label className="check">
            <input type="radio" name={`${id}-venue`} checked={home} onChange={() => setHome(true)} /> {t.common.home}
          </label>
          <label className="check">
            <input type="radio" name={`${id}-venue`} checked={!home} onChange={() => setHome(false)} /> {t.common.away}
          </label>
        </div>
      </fieldset>
      <div className="button-row">
        <button type="submit" className="button primary">
          {initial ? t.planner.saveMatch : t.planner.addMatch}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        {onDelete && (
          <button type="button" className="button quiet" onClick={onDelete}>
            {t.planner.deleteMatch}
          </button>
        )}
      </div>
    </form>
  );
}
