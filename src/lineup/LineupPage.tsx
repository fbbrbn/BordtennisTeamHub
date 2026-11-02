import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { loadPool } from '../data/load';
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
    if (!saveState(storageKey, state)) setNotice('This browser blocks saving. Download a backup to keep your plan.');
  }, [storageKey, state]);

  // A shared link carries a whole plan in the address: offer it, never silently overwrite.
  useEffect(() => {
    if (!sharedToken) return;
    let cancelled = false;
    void decodeState(sharedToken).then((decoded) => {
      if (cancelled) return;
      replaceHash(href('lineup', storageKey));
      if (!decoded) {
        setNotice('That share link is incomplete or broken.');
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
  const nameOf = (id: string) => names.get(id) ?? 'Former player';
  const planned = plan.fixtures.filter((f) => f.status === 'planned');
  const played = plan.fixtures.filter((f) => f.status === 'played').reverse();

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
      setNotice(kind === 'link' ? 'Share link copied' : 'Message copied');
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
        setNotice('That file is not a lineup backup.');
        return;
      }
      if (isBlank(state) || window.confirm('Replace the current plan with this backup?')) {
        dispatch({ type: 'replace', state: restored });
        setNotice('Backup restored');
      }
    } catch {
      setNotice('That file could not be read.');
    }
  }

  return (
    <div className="planner">
      <div className="page-head">
        <h1>Lineup planner</h1>
        <label className="field team-field">
          <span>Team</span>
          <input
            value={state.teamName}
            placeholder="Team name, e.g. Vallensbæk BTK 3"
            onChange={(e) => dispatch({ type: 'teamName', name: e.target.value })}
          />
        </label>
      </div>

      {link && (
        <p className={linked === 'failed' ? 'linked-note is-failed' : 'linked-note'}>
          {linked === 'failed'
            ? 'Could not load the latest results. The plan below is the last saved version.'
            : <>Linked to <a href={href('team', link.poolId, link.teamId)}>{state.teamName || 'your team'}</a> on bordtennisportalen.dk: players, matches and who played fill in from the results. Untick <em>Active</em> for anyone who should not be planned.</>}
        </p>
      )}

      {incoming && (
        <div className="banner" role="status">
          <p>
            This link holds a plan for <strong>{incoming.teamName || 'a team'}</strong> that differs from the one
            saved on this device.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button primary"
              onClick={() => {
                dispatch({ type: 'replace', state: incoming });
                setIncoming(null);
              }}
            >
              Use the shared plan
            </button>
            <button type="button" className="button" onClick={() => setIncoming(null)}>
              Keep mine
            </button>
          </div>
        </div>
      )}

      <section className="card settings">
        <label className="field inline">
          <span>Players per match</span>
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
        <details className="explain">
          <summary>How the plan is made</summary>
          <p>
            Nobody is planned on guesses. For each match, mark who said <em>I can</em>, <em>Maybe</em> or{' '}
            <em>I can't</em>. Only players who said <em>I can</em> or <em>Maybe</em> are picked, and <em>I can</em> goes
            first.
          </p>
          <p>
            Among them, the planner picks whoever has played the fewest matches so far. Matches already played count,
            and so do the upcoming matches a player is already picked for. Use <em>Must play</em> or <em>Rest</em> to
            overrule it for one match.
          </p>
        </details>
      </section>

      {state.players.length === 0 && <RosterEditor state={state} dispatch={dispatch} />}

      {state.players.length > 0 && state.fixtures.length > 0 && <BalanceTable state={state} plan={plan} />}

      <section className="stack">
        <div className="section-head">
          <h2>Upcoming matches</h2>
          {!adding && (
            <button type="button" className="button" onClick={() => setAdding(true)}>
              Add match
            </button>
          )}
        </div>
        {adding && (
          <div className="card">
            <FixtureForm
              key={formKey}
              cancelLabel="Done"
              onSubmit={(value) => {
                dispatch({ type: 'addFixture', ...value });
                setFormKey((k) => k + 1);
                setNotice('Match added');
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}
        {planned.length === 0 && !adding && (
          <p className="empty">No upcoming matches yet. Add them from your team's schedule.</p>
        )}
        {planned.map((item, i) => (
          <PlannedMatch
            key={item.fixture.id}
            item={item}
            state={state}
            dispatch={dispatch}
            nameOf={nameOf}
            startOpen={i < 3}
          />
        ))}
      </section>

      {played.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>Played</h2>
            <span className="muted">
              {played.length} {played.length === 1 ? 'match' : 'matches'}
            </span>
          </div>
          <ul className="played-list">
            {played.map((item) => (
              <PlayedMatch key={item.fixture.id} item={item} state={state} dispatch={dispatch} nameOf={nameOf} />
            ))}
          </ul>
        </section>
      )}

      {state.players.length > 0 && <RosterEditor state={state} dispatch={dispatch} />}

      <section className="card">
        <h2>Share and back up</h2>
        <p className="muted">
          The plan is saved in this browser only. Send the link in your team chat: whoever opens it gets their own
          copy.
        </p>
        <div className="button-row">
          <button type="button" className="button primary" onClick={() => void share('link')}>
            Copy share link
          </button>
          <button type="button" className="button" onClick={() => void share('message')}>
            Copy message for the team chat
          </button>
          <button type="button" className="button" onClick={download}>
            Download backup
          </button>
          <button type="button" className="button" onClick={() => fileInput.current?.click()}>
            Restore backup
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
        {manualCopy && (
          <label className="field manual-copy">
            <span>Copying is blocked here. Select the text and copy it yourself:</span>
            <textarea readOnly rows={4} value={manualCopy} onFocus={(e) => e.target.select()} />
          </label>
        )}
      </section>

      <div className="toast" role="status" aria-live="polite">
        {notice}
      </div>
    </div>
  );
}
