/**
 * Small client for bordtennisportalen.dk's public team-tournament service, the same
 * calls the site's own standings page makes. Requests are spaced out and retried.
 */
const BASE = 'https://www.bordtennisportalen.dk';
const PAGE = `${BASE}/DBTU/HoldTurnering/Stilling/`;
const SERVICE = `${BASE}/SportsResults/Components/WebService1.asmx/GetLeagueStanding`;

export interface StandingQuery {
  subPage: number;
  seasonId: string;
  groupId?: string;
  ageGroupId?: string;
  regionId?: string;
  teamId?: string;
  matchId?: string;
  playerId?: string;
}

export class PortalClient {
  private context = '';
  private readonly cookies = new Map<string, string>();
  private lastRequest = 0;
  private readonly options: { delayMs: number; userAgent: string };
  requests = 0;

  // No parameter properties: Node runs this file with type stripping only.
  constructor(options: { delayMs: number; userAgent: string }) {
    this.options = options;
  }

  /** Loads the standings page once to get the session cookie and the service's context key. */
  async init(): Promise<void> {
    const response = await this.request(PAGE, { method: 'GET' });
    if (!response.ok) throw new Error(`Standings page answered HTTP ${response.status}`);
    const match = /SR_CallbackContext\s*=\s*'([^']+)'/.exec(await response.text());
    if (!match) throw new Error('Could not find SR_CallbackContext on the standings page');
    this.context = match[1];
  }

  /** Returns the HTML fragment for one page of the team tournament. */
  async standing(query: StandingQuery): Promise<string> {
    if (!this.context) await this.init();
    for (let attempt = 1; ; attempt++) {
      try {
        const body = {
          callbackcontextkey: this.context,
          subPage: String(query.subPage),
          seasonID: query.seasonId,
          leagueGroupID: query.groupId ?? '',
          ageGroupID: query.ageGroupId ?? '',
          regionID: query.regionId ?? '',
          leagueGroupTeamID: query.teamId ?? '',
          leagueMatchID: query.matchId ?? '',
          clubID: '',
          playerID: query.playerId ?? '',
        };
        const response = await this.request(SERVICE, {
          method: 'POST',
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'x-requested-with': 'XMLHttpRequest',
            referer: PAGE,
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as { d?: { html?: unknown } };
        if (typeof json.d?.html !== 'string') throw new Error('Unexpected response shape');
        return json.d.html;
      } catch (error) {
        if (attempt >= 3) throw error;
        await wait(3000 * attempt);
        await this.init().catch(() => undefined);
      }
    }
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const due = this.lastRequest + this.options.delayMs - Date.now();
    if (due > 0) await wait(due);
    this.lastRequest = Date.now();
    this.requests++;

    const headers = new Headers(init.headers);
    headers.set('user-agent', this.options.userAgent);
    if (this.cookies.size > 0) {
      headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    }
    const response = await fetch(url, { ...init, headers, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    return response;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
