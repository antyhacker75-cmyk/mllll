import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndSortHeroRanks,
  formatBattleScore,
  formatKda,
  formatPercent,
  formatRelativeTime,
  formatWinRate,
  getLaneLabel,
  resolveRankFromLevel,
  stripHtmlTags,
  validateAccountCredentials,
} from './mlbb';
import type { HeroPositionRecord, HeroRankRecord } from '../types/mlbb';

test('resolveRankFromLevel maps standard and Mythic star thresholds accurately', () => {
  const warrior = resolveRankFromLevel(3);
  assert.equal(warrior.tierName, 'Warrior');
  assert.equal(warrior.division, 'III');

  const epic = resolveRankFromLevel(88);
  assert.equal(epic.tierName, 'Epic');
  assert.equal(epic.division, 'III');

  const mythic = resolveRankFromLevel(148);
  assert.equal(mythic.tierName, 'Mythic');
  assert.equal(mythic.stars, 12);

  const honor = resolveRankFromLevel(161);
  assert.equal(honor.tierName, 'Mythical Honor');
  assert.equal(honor.stars, 25);

  const glory = resolveRankFromLevel(204);
  assert.equal(glory.tierName, 'Mythical Glory');
  assert.equal(glory.stars, 68);

  const immortal = resolveRankFromLevel(246);
  assert.equal(immortal.tierName, 'Mythical Immortal');
  assert.equal(immortal.stars, 110);
});

test('metric formatters handle decimals, zero matches, and zero deaths', () => {
  assert.equal(formatWinRate(60, 100), '60.0%');
  assert.equal(formatWinRate(0, 0), '0.0%');
  assert.equal(formatPercent(0.5482), '54.82%');
  assert.equal(formatBattleScore(864), '8.6');

  const perfect = formatKda(8, 0, 7);
  assert.equal(perfect.kdaText, '8/0/7');
  assert.equal(perfect.ratio, '15.0');

  const standard = formatKda(6, 3, 9);
  assert.equal(standard.kdaText, '6/3/9');
  assert.equal(standard.ratio, '5.0');
});

test('getLaneLabel and formatRelativeTime return expected labels', () => {
  assert.equal(getLaneLabel(1), 'EXP Lane');
  assert.equal(getLaneLabel(2), 'Mid Lane');
  assert.equal(getLaneLabel(3), 'Roam');
  assert.equal(getLaneLabel(4), 'Jungle');
  assert.equal(getLaneLabel(5), 'Gold Lane');

  const now = 1_760_000_000_000;
  assert.equal(formatRelativeTime(now / 1000 - 120, now), '2m ago');
  assert.equal(formatRelativeTime(now / 1000 - 7200, now), '2h ago');
  assert.equal(formatRelativeTime(now / 1000 - 172800, now), '2d ago');
});

test('validateAccountCredentials rejects empty or malformed IDs and verification codes', () => {
  const empty = validateAccountCredentials('', '');
  assert.equal(empty.valid, false);
  assert.ok(empty.roleIdError);
  assert.ok(empty.zoneIdError);

  const badIds = validateAccountCredentials('abc', '12');
  assert.equal(badIds.valid, false);
  assert.ok(badIds.roleIdError);
  assert.ok(badIds.zoneIdError);

  const step1Valid = validateAccountCredentials('184920312', '2418', '', false);
  assert.equal(step1Valid.valid, true);

  const step2MissingVc = validateAccountCredentials('184920312', '2418', '', true);
  assert.equal(step2MissingVc.valid, false);
  assert.ok(step2MissingVc.vcError);

  const step2Valid = validateAccountCredentials('184920312', '2418', '4829', true);
  assert.equal(step2Valid.valid, true);
});

test('filterAndSortHeroRanks filters by name, role, and lane and sorts deterministically', () => {
  const sampleRanks: HeroRankRecord[] = [
    {
      data: {
        main_heroid: 1,
        main_hero_win_rate: 0.51,
        main_hero_appearance_rate: 0.03,
        main_hero_ban_rate: 0.05,
        main_hero: { data: { name: 'Miya', head: '' } },
      },
    },
    {
      data: {
        main_heroid: 18,
        main_hero_win_rate: 0.55,
        main_hero_appearance_rate: 0.02,
        main_hero_ban_rate: 0.14,
        main_hero: { data: { name: 'Layla', head: '' } },
      },
    },
    {
      data: {
        main_heroid: 88,
        main_hero_win_rate: 0.59,
        main_hero_appearance_rate: 0.01,
        main_hero_ban_rate: 0.18,
        main_hero: { data: { name: 'Masha', head: '' } },
      },
    },
  ];

  const posMap = new Map([
    [1, { roles: ['marksman'], lanes: ['gold lane'] }],
    [18, { roles: ['marksman'], lanes: ['gold lane'] }],
    [88, { roles: ['fighter', 'tank'], lanes: ['exp lane', 'roam'] }],
  ]);

  const marksmen = filterAndSortHeroRanks(sampleRanks, '', 'marksman', 'all', posMap, 'win_rate', 'desc');
  assert.equal(marksmen.length, 2);
  assert.equal(marksmen[0].data.main_hero.data.name, 'Layla');
  assert.equal(marksmen[1].data.main_hero.data.name, 'Miya');

  const search = filterAndSortHeroRanks(sampleRanks, 'masha', 'all', 'all', posMap, 'ban_rate', 'desc');
  assert.equal(search.length, 1);
  assert.equal(search[0].data.main_heroid, 88);

  assert.equal(stripHtmlTags('<font color="#fff">Deals <b>200</b> dmg</font>'), 'Deals 200 dmg');
});
