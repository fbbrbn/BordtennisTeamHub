import { describe, expect, it } from 'vitest';
import { nextRun } from './clock.ts';

const next = (utc: string) => {
  const r = nextRun(new Date(`${utc}Z`));
  return `${r.workflow} ${r.at.toISOString().slice(0, 16)}`;
};

describe('nextRun', () => {
  it('goes from the midday import to the evening ones, hour by hour', () => {
    expect(next('2026-11-05T13:16')).toBe('data.yml 2026-11-05T16:23');
    expect(next('2026-11-05T16:25')).toBe('data.yml 2026-11-05T17:23');
  });

  it('never returns the run that is starting now', () => {
    expect(next('2026-11-05T16:23:00')).toBe('data.yml 2026-11-05T17:23');
    expect(next('2026-11-05T16:22:59')).toBe('data.yml 2026-11-05T16:23');
  });

  it('starts the history import after the last evening import, then the morning import', () => {
    expect(next('2026-11-05T22:30')).toBe('history.yml 2026-11-06T00:41');
    expect(next('2026-11-06T00:41:05')).toBe('data.yml 2026-11-06T05:23');
    expect(next('2026-11-06T05:30')).toBe('data.yml 2026-11-06T12:23');
  });

  it('crosses the end of a month and a year', () => {
    expect(next('2026-11-30T23:00')).toBe('history.yml 2026-12-01T00:41');
    expect(next('2026-12-31T22:30')).toBe('history.yml 2027-01-01T00:41');
  });
});
