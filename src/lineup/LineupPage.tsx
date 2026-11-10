import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useShowAll } from '../components/ui';
import { loadPool } from '../data/load';
import { t } from '../i18n';
import { copyText } from '../lib/clipboard';
import { href, replaceHash } from '../lib/router';
import { BalanceTable } from './BalanceTable';
import { lineupMessage } from './format';
import { FixtureForm, PlannedMatch, PlayedMatch } from './Matches';
import { buildPlan } from './planner';
import { RosterEditor } from './RosterEditor';
import { reducer } from './state';
import { decodeState, emptyState, encodeState, loadState, normalizeState, saveState } from './storage';
import type { PlannerState } from './types';

const isBlank = (s: PlannerState) => !s.teamName && s.players.length === 0 && s.fixtures.length === 0;
/** The page starts with this many of the matches to come: about as far ahead as a captain plans. */
const UPCOMING_SHOWN = 5;

export interface TeamLink {
  poolId: string;
  teamId: string;
}

export function LineupPage({
  storageKey,
  sharedToken,
  link,
}: {
  storageKey: string;
  sharedToken: string | null;
  link: TeamLink | null;
}) {
  const [state, dispatch] = useReducer(reducer, storageKey, (key) => loadState(key) ?? emptyState());
  const [incoming, setIncoming] = useState<PlannerState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [linked, setLinked] = useState<'no' | 'loading' | 'ok' | 'failed'>(link ? 'loading' : 'no');
  const fileInput = useRef<HTMLInputElement>(null);
  const plan = useMemo(() => buildPlan(state), [state]);

  // Save on every change, but don't create a stored plan just by opening an empty page.
  useEffect(() => {
    if (isBlank(state) && !loadState(storageKey)) return;
    if (!saveState(storageKey, state)) setNotice(t.planner.savingBlocked);
  }, [storageKey, state]);

  // A shared link carries a whole plan in the address: offer it, never silently overwrite.
  useEffect(() => {
    if (!sharedToken) return;
    let cancelled = false;
    void decodeState(sharedToken).then((decoded) => {
      if (cancelled) return;
      replaceHash(href('lineup', storageKey));
      if (!decoded) {
        setNotice(t.planner.brokenLink);
        return;
      }
      const current = loadState(storageKey);
      if (!current || isBlank(current)) dispatch({ type: 'replace', state: decoded });
      else if (JSON.stringify(current) !== JSON.stringify(decoded)) setIncoming(decoded);
    });
    return () => {
      cancelled = true;
    };
  }, [sharedToken, storageKey]);

  // Linked to a team on bordtennisportalen.dk: refresh roster, fixtures and who played from the imported data.
  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    loadPool(link.poolId).then(
      (pool) => {
        if (cancelled) return;
        dispatch({ type: 'sync', pool, teamId: link.teamId });
        setLinked('ok');
      },
      () => !cancelled && setLinked('failed'),
    );
    return () => {
      cancelled = true;
    };
  }, [link?.poolId, link?.teamId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const names = useMemo(() => new Map(state.players.map((p) => [p.id, p.name])), [state.players]);
  const nameOf = (id: string) => names.get(id) ?? t.planner.formerPlayer;
  const planned = plan.fixtures.filter((f) => f.status === 'planned');
  const played = plan.fixtures.filter((f) => f.status === 'played').reverse();
  const [shownPlanned, showAllPlanned] = useShowAll(planned, UPCOMING_SHOWN);

  const playersPerMatchField = (
    <label className="field inline">
      <span>{t.planner.playersPerMatch}</span>
      <select
        value={state.settings.playersPerMatch}
        onChange={(e) => dispatch({ type: 'settings', patch: { playersPerMatch: Number(e.target.value) } })}
      >
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );

  async function share(kind: 'link' | 'message') {
    let text: string;
    if (kind === 'link') {
      const token = await encodeState(state);
      text = `${window.location.origin}${window.location.pathname}${href('lineup', storageKey)}?plan=${token}`;
    } else {
      text = lineupMessage(state, plan);
    }
    if (await copyText(text)) {
      setManualCopy(null);
      setNotice(kind === 'link' ? t.planner.linkCopied : t.planner.messageCopied);
    } else {
      setManualCopy(text);
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = state.teamName.toLowerCase().replace(/[^a-z0-9æøå]+/g, '-').replace(/^-|-$/g, '');
    link.href = url;
    link.download = `lineup-${slug || storageKey}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function restore(file: File) {
    try {
      const restored = normalizeState(JSON.parse(await file.text()));
      if (!restored) {
        setNotice(t.planner.notBackup);
        return;
      }
      if (isBlank(state) || window.confirm(t.planner.replaceConfirm)) {
        dispatch({ type: 'replace', state: restored });
        setNotice(t.planner.restored);
      }
    } catch {
      setNotice(t.planner.unreadable);
    }
  }

  return (
    <div className="planner">
      <div className="page-head">
        <h1>{t.planner.title}</h1>
        {link ? (
          <p className={linked === 'failed' ? 'linked-note is-failed' : 'linked-note'}>
            {linked === 'failed'
              ? t.planner.loadFailed
              : t.planner.linked(<a href={href('team', link.poolId, link.teamId)}>{state.teamName || t.planner.yourTeam}</a>)}
          </p>
        ) : (
          <label className="field team-field">
            <span>{t.planner.team}</span>
            <input
              value={state.teamName}
              placeholder={t.planner.teamPlaceholder}
              onChange={(e) => dispatch({ type: 'teamName', name: e.target.value })}
            />
          </label>
        )}
      </div>

      {/* Opened without a team: most teams are in the data, and then nothing has to be typed. */}
      {!link && isBlank(state) && (
        <section className="card compact">
          <p className="muted">{t.planner.findTeamHint}</p>
          <a className="button" href="#/">
            {t.planner.findTeam}
          </a>
        </section>
      )}

      {incoming && (
        <div className="banner" role="status">
          <p>{t.planner.incoming(<strong>{incoming.teamName || t.planner.aTeam}</strong>)}</p>
          <div className="button-row">
            <button
              type="button"
              className="button primary"
              onClick={() => {
                dispatch({ type: 'replace', state: incoming });
                setIncoming(null);
              }}
            >
              {t.planner.useShared}
            </button>
            <button type="button" className="button" onClick={() => setIncoming(null)}>
              {t.planner.keepMine}
            </button>
          </div>
        </div>
      )}

      {state.players.length === 0 && <RosterEditor state={state} dispatch={dispatch} />}

      <section className="stack">
        <h2>{t.planner.upcoming}</h2>
        {planned.length === 0 && !adding && <p className="empty">{t.planner.noUpcoming}</p>}
        {shownPlanned.map((item, i) => (
          <PlannedMatch key={item.fixture.id} item={item} state={state} dispatch={dispatch} nameOf={nameOf} startOpen={i === 0} />
        ))}
        <div className="button-row">
          {showAllPlanned}
          {!adding && (
            <button type="button" className={planned.length === 0 ? 'button primary' : 'button quiet'} onClick={() => setAdding(true)}>
              {t.planner.addMatch}
            </button>
          )}
        </div>
        {adding && (
          <div className="card">
            <FixtureForm
              key={formKey}
              cancelLabel={t.planner.done}
              onSubmit={(value) => {
                dispatch({ type: 'addFixture', ...value });
                setFormKey((k) => k + 1);
                setNotice(t.planner.matchAdded);
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}
      </section>

      {state.players.length > 0 && state.fixtures.length > 0 && <BalanceTable state={state} plan={plan} />}

      {/* How lineups are chosen, and the one setting: a manual planner shows the setting outright. */}
      <section className="card settings">
        {!link && playersPerMatchField}
        <details className="explain">
          <summary>{t.planner.howMade}</summary>
          <p>{t.planner.howMade1}</p>
          <p>{t.planner.howMade2}</p>
          {link && playersPerMatchField}
        </details>
      </section>

      {played.length > 0 && (
        <details className="card fold">
          <summary>
            <h2>{t.planner.playedMatches}</h2>
            <span className="muted small">{played.length}</span>
          </summary>
          <ul className="played-list">
            {played.map((item) => (
              <PlayedMatch key={item.fixture.id} item={item} state={state} dispatch={dispatch} nameOf={nameOf} />
            ))}
          </ul>
        </details>
      )}

      {state.players.length > 0 &&
        (link ? (
          <details className="card fold">
            <summary>
              <h2>{t.planner.players}</h2>
              <span className="muted small">{t.planner.activeEdit(state.players.filter((p) => p.active).length)}</span>
            </summary>
            <p className="muted small">{t.planner.untickNote}</p>
            <RosterEditor state={state} dispatch={dispatch} bare />
          </details>
        ) : (
          <RosterEditor state={state} dispatch={dispatch} />
        ))}

      {!isBlank(state) && (
      <section className="card">
        <h2>{t.planner.share}</h2>
        <p className="muted small">{t.planner.shareNote}</p>
        <div className="button-row">
          <button type="button" className="button primary" onClick={() => void share('link')}>
            {t.planner.copyLink}
          </button>
          <button type="button" className="button" onClick={() => void share('message')}>
            {t.planner.copyMessage}
          </button>
        </div>
        <details className="why">
          <summary>{t.planner.backup}</summary>
          <div className="button-row">
            <button type="button" className="button" onClick={download}>
              {t.planner.download}
            </button>
            <button type="button" className="button" onClick={() => fileInput.current?.click()}>
              {t.planner.restore}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void restore(file);
                e.target.value = '';
              }}
            />
          </div>
        </details>
        {manualCopy && (
          <label className="field manual-copy">
            <span>{t.planner.copyBlocked}</span>
            <textarea readOnly rows={4} value={manualCopy} onFocus={(e) => e.target.select()} />
          </label>
        )}
      </section>
      )}

      <div className="toast" role="status" aria-live="polite">
        {notice}
      </div>
    </div>
  );
}
