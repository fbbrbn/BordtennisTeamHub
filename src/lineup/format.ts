import { lang, t } from '../i18n';
import { decimal, parseLocal, weekdayDate } from '../i18n/format';
import type { Plan, PlannerState } from './types';

export { parseLocal };

/** "Sat 7 Nov" and "lør. 7. nov." */
export function formatDay(date: string): string {
  return weekdayDate(date, lang);
}

export function formatTime(date: string): string | null {
  const time = date.split('T')[1];
  return time && time !== '00:00' ? time : null;
}

export function isPast(date: string, now = new Date()): boolean {
  const d = parseLocal(date);
  if (!date.includes('T')) d.setHours(23, 59);
  return d.getTime() < now.getTime();
}

export function formatShare(value: number | null): string {
  if (value === null) return '–';
  return decimal(value, lang);
}

/** Plain-text summary to paste into the team chat. */
export function lineupMessage(state: PlannerState, plan: Plan, maxMatches = 5): string {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?';
  const upcoming = plan.fixtures.filter((f) => f.status === 'planned').slice(0, maxMatches);
  const activeCount = state.players.filter((p) => p.active).length;
  const m = t.planner.message;
  const lines = [m.title(state.teamName || m.ourTeam)];

  for (const f of upcoming) {
    const time = formatTime(f.fixture.date);
    const when = `${formatDay(f.fixture.date)}${time ? ` ${time}` : ''}`;
    const where = f.fixture.home ? m.home : m.away;
    const nobodyAnswered = f.lineup.length === 0 && f.unanswered.length === activeCount;
    const players = nobodyAnswered ? m.noAnswers : f.lineup.map(name).join(', ') || m.noLineup;
    let open = '';
    if (f.missing > 0 && !nobodyAnswered) {
      open = f.unanswered.length > 0 ? m.moreNeededWaiting(f.missing, f.unanswered.map(name).join(', ')) : m.moreNeeded(f.missing);
    }
    const reserve = f.reserves.length > 0 ? m.reserve(name(f.reserves[0])) : '';
    lines.push(`• ${when} ${t.common.vs} ${f.fixture.opponent || '?'} (${where}): ${players}${open}${reserve}`);
  }
  if (upcoming.length === 0) lines.push(m.noUpcoming);

  const played = plan.tallies
    .filter((t) => t.played > 0)
    .map((t) => `${name(t.playerId)} ${t.played}`)
    .join(' · ');
  if (played) lines.push(m.playedSoFar(played));
  lines.push(m.ask);
  return lines.join('\n');
}
