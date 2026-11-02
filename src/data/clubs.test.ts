import { describe, expect, it } from 'vitest';
import { clubOf, clubSlug, fallbackClubName } from './clubs';

const clubs = [
  { id: '1', name: 'B 77' },
  { id: '2', name: 'Vallensbæk BTK' },
  { id: '3', name: 'Politiets IF, København' },
  { id: '4', name: 'BTK' },
];

describe('clubs', () => {
  it('matches a team to the longest official club name it starts with', () => {
    expect(clubOf('Vallensbæk BTK 3', clubs)).toEqual({ name: 'Vallensbæk BTK', id: '2' });
    expect(clubOf('B 77 5', clubs)).toEqual({ name: 'B 77', id: '1' });
    expect(clubOf('B 77', clubs)).toEqual({ name: 'B 77', id: '1' });
    expect(clubOf('Politiets IF, København 1', clubs)).toEqual({ name: 'Politiets IF, København', id: '3' });
  });

  it('needs a team number or nothing after the club name', () => {
    expect(clubOf('BTK Posten, København 4', clubs)).toEqual({ name: 'BTK Posten, København', id: null });
  });

  it('falls back to dropping the team number', () => {
    expect(fallbackClubName('Hvidovre Bordtennis 7')).toBe('Hvidovre Bordtennis');
    expect(fallbackClubName('Solo Klub')).toBe('Solo Klub');
  });

  it('makes URL-friendly slugs', () => {
    expect(clubSlug('Vallensbæk BTK')).toBe('vallensbaek-btk');
    expect(clubSlug('Politiets IF, København')).toBe('politiets-if-koebenhavn');
    expect(clubSlug('Allerød/Gribskov')).toBe('alleroed-gribskov');
  });
});
