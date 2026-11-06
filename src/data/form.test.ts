import { describe, expect, it } from 'vitest';
import { edgeParts, FORM_PRIOR_GAMES, FORM_WEIGHT, formOf, HOME_EDGE, homeEdge, LAST_SEASON_WEIGHT, playerEdge, UNRATED_EDGE, YOUTH_EDGE } from './form';

describe('player edges', () => {
  it('counts wins above expectation, pulling a few games towards zero', () => {
    const early = playerEdge({ rating: 1500, form: { games: 3, above: 1 } });
    const later = playerEdge({ rating: 1500, form: { games: 30, above: 10 } });
    expect(early).toBeCloseTo((FORM_WEIGHT * 1) / (3 + FORM_PRIOR_GAMES), 12);
    expect(later).toBeGreaterThan(early);
    expect(playerEdge({ rating: 1500, form: { games: 20, above: -4 } })).toBeLessThan(0);
  });

  it('adds last season at a third of the weight, and the youth edge', () => {
    const parts = edgeParts({ rating: 1500, form: { games: 0, above: 0, last: { games: 45, above: 6 }, youth: true } });
    expect(parts.last).toBeCloseTo((LAST_SEASON_WEIGHT * 6) / (45 + FORM_PRIOR_GAMES), 12);
    expect(LAST_SEASON_WEIGHT / FORM_WEIGHT).toBeCloseTo(1 / 3, 2);
    expect(parts.youth).toBe(YOUTH_EDGE);
    expect(parts.unrated).toBe(0);
  });

  it('counts unrated players as weaker, except youth players', () => {
    expect(playerEdge({ rating: null })).toBe(UNRATED_EDGE);
    expect(playerEdge({ rating: null, form: { games: 0, above: 0, youth: true } })).toBe(YOUTH_EDGE);
    expect(playerEdge(undefined)).toBe(0);
  });

  it('gives the home table an edge except in veteran pools', () => {
    expect(homeEdge({ ageGroupId: '4006' })).toBe(HOME_EDGE);
    expect(homeEdge({ ageGroupId: '4004' })).toBe(HOME_EDGE);
    expect(homeEdge({ ageGroupId: '4010' })).toBe(0);
  });
});

describe('formOf', () => {
  it('rounds the tallies and leaves out players with nothing to tell', () => {
    expect(formOf({ games: 12, above: 1.23456 }, { games: 30, above: -2.5, youth: false }, false)).toEqual({
      games: 12,
      above: 1.23,
      last: { games: 30, above: -2.5 },
    });
    expect(formOf(undefined, { games: 4, above: 1, youth: true }, false)).toEqual({ games: 0, above: 0, last: { games: 4, above: 1 }, youth: true });
    expect(formOf(undefined, undefined, false)).toBeUndefined();
    expect(formOf({ games: 0, above: 0 }, undefined, true)).toEqual({ games: 0, above: 0, youth: true });
  });
});
