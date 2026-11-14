import test from 'node:test';
import assert from 'node:assert/strict';
import type { FavoriteLineupHero, HeroRankRecord } from '../types/mlbb';
import {
  addHeroToLineup,
  buildHeroRosterForLineup,
  calculateLineupWinRate,
  createSavedLineup,
  parseSavedLineups,
  removeHeroFromLineup,
  resolveLineupHeroes,
  serializeSavedLineups,
  validateLineupForSave,
} from './favoriteLineup';
import type { HeroMetadataSummary } from './mlbb';

function makeHeroRank(
  id: number,
  name: string,
  wr: number,
  pr: number = 0.02,
  br: number = 0.05,
): HeroRankRecord {
  return {
    data: {
      main_heroid: id,
      main_hero_win_rate: wr,
      main_hero_appearance_rate: pr,
      main_hero_ban_rate: br,
      main_hero: {
        data: {
          name,
          head: `https://example.com/${id}.png`,
        },
      },
    },
  };
}

function makePosMap(): Map<number, HeroMetadataSummary> {
  return new Map<number, HeroMetadataSummary>([
    [21, { roles: ['assassin'], lanes: ['jungle'] }],
    [6, { roles: ['tank'], lanes: ['roam'] }],
    [110, { roles: ['mage'], lanes: ['mid'] }],
    [76, { roles: ['marksman'], lanes: ['gold'] }],
    [102, { roles: ['fighter'], lanes: ['exp'] }],
    [52, { roles: ['fighter', 'tank'], lanes: ['exp'] }],
  ]);
}

test('addHeroToLineup enforces uniqueness and max 5 heroes', () => {
  let ids: number[] = [];
  ids = addHeroToLineup(ids, 21);
  ids = addHeroToLineup(ids, 21); // duplicate ignored
  assert.deepEqual(ids, [21]);

  ids = addHeroToLineup(ids, 6);
  ids = addHeroToLineup(ids, 110);
  ids = addHeroToLineup(ids, 76);
  ids = addHeroToLineup(ids, 102);
  ids = addHeroToLineup(ids, 52); // 6th hero blocked by cap
  assert.deepEqual(ids, [21, 6, 110, 76, 102]);

  ids = removeHeroFromLineup(ids, 110);
  assert.deepEqual(ids, [21, 6, 76, 102]);
});

test('calculateLineupWinRate computes exact mean win rate and role coverage', () => {
  const heroes: FavoriteLineupHero[] = [
    {
      heroId: 21,
      name: 'Hayabusa',
      head: '',
      roles: ['assassin'],
      lanes: ['jungle'],
      winRatePct: 54.0,
      pickRatePct: 2.1,
      banRatePct: 40.0,
    },
    {
      heroId: 6,
      name: 'Tigreal',
      head: '',
      roles: ['tank'],
      lanes: ['roam'],
      winRatePct: 51.5,
      pickRatePct: 1.9,
      banRatePct: 12.0,
    },
    {
      heroId: 110,
      name: 'Valentina',
      head: '',
      roles: ['mage'],
      lanes: ['mid'],
      winRatePct: 48.8,
      pickRatePct: 1.4,
      banRatePct: 8.0,
    },
  ];

  const summary = calculateLineupWinRate(heroes);
  assert.equal(summary.heroCount, 3);
  assert.equal(summary.ratedHeroCount, 3);
  assert.equal(summary.averageWinRatePct, 51.43);
  assert.equal(summary.deltaFromFiftyPct, 1.43);
  assert.equal(summary.highestWrHero?.name, 'Hayabusa');
  assert.equal(summary.lowestWrHero?.name, 'Valentina');
  assert.deepEqual(summary.roleCoverage, ['Assassin', 'Tank', 'Mage']);
});

test('calculateLineupWinRate returns null averages for empty lineup', () => {
  const summary = calculateLineupWinRate([]);
  assert.equal(summary.heroCount, 0);
  assert.equal(summary.averageWinRatePct, null);
  assert.equal(summary.highestWrHero, null);
  assert.equal(summary.lowestWrHero, null);
});

test('resolveLineupHeroes uses live heroRanks rates and falls back to snapshot when missing', () => {
  const ranks = [
    makeHeroRank(21, 'Hayabusa', 0.5425, 0.024, 0.31),
    makeHeroRank(6, 'Tigreal', 0.518, 0.018, 0.09),
  ];
  const posMap = makePosMap();
  const snapshot: FavoriteLineupHero[] = [
    {
      heroId: 21,
      name: 'Hayabusa',
      head: '',
      roles: ['assassin'],
      lanes: ['jungle'],
      winRatePct: 50.0,
      pickRatePct: 1.0,
      banRatePct: 10.0,
    },
    {
      heroId: 999,
      name: 'FallbackHero',
      head: '',
      roles: ['support'],
      lanes: ['roam'],
      winRatePct: 52.2,
      pickRatePct: 1.1,
      banRatePct: 2.0,
    },
  ];

  const resolved = resolveLineupHeroes([21, 999], ranks, posMap, snapshot);
  assert.equal(resolved[0].winRatePct, 54.25); // live rank overrides old snapshot
  assert.equal(resolved[1].name, 'FallbackHero');
  assert.equal(resolved[1].winRatePct, 52.2); // snapshot used when hero not in ranks
});

test('validateLineupForSave rejects empty lineups and assigns default name when omitted', () => {
  const emptyCheck = validateLineupForSave('My Squad', [], 0);
  assert.equal(emptyCheck.valid, false);
  assert.ok(emptyCheck.error);

  const defaultNameCheck = validateLineupForSave('   ', [21, 6], 2);
  assert.equal(defaultNameCheck.valid, true);
  assert.equal(defaultNameCheck.resolvedName, 'Favorite Lineup #3');

  const customNameCheck = validateLineupForSave('  Mythic Push  ', [21], 0);
  assert.equal(customNameCheck.valid, true);
  assert.equal(customNameCheck.resolvedName, 'Mythic Push');
});

test('saved lineups serialize and recover gracefully from invalid JSON', () => {
  const roster = buildHeroRosterForLineup(
    [makeHeroRank(21, 'Hayabusa', 0.531), makeHeroRank(6, 'Tigreal', 0.512)],
    makePosMap(),
  );
  const lineup = createSavedLineup('Roam Jungle Duo', roster, '2026-11-14T08:00:00.000Z');
  const encoded = serializeSavedLineups([lineup]);
  const decoded = parseSavedLineups(encoded);

  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].name, 'Roam Jungle Duo');
  assert.deepEqual(decoded[0].heroIds, [21, 6]);

  assert.deepEqual(parseSavedLineups('{broken-json'), []);
  assert.deepEqual(parseSavedLineups(JSON.stringify([{ bad: true }])), []);
});
