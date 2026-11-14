import test from 'node:test';
import assert from 'node:assert/strict';
import type { HeroRankRecord } from '../types/mlbb';
import type { HeroMetadataSummary } from './mlbb';
import { predictTeamWinProbability } from './winPredictor';

function makeRank(id: number, name: string, winRate: number): HeroRankRecord {
  return {
    data: {
      main_heroid: id,
      main_hero_win_rate: winRate,
      main_hero_appearance_rate: 0.02,
      main_hero_ban_rate: 0.05,
      main_hero: {
        data: {
          name,
          head: '',
        },
      },
    },
  };
}

function buildTestFixtures() {
  const heroRanks: HeroRankRecord[] = [
    makeRank(1, 'Miya', 0.505),
    makeRank(6, 'Tigreal', 0.525),
    makeRank(21, 'Hayabusa', 0.555),
    makeRank(34, 'Estes', 0.495),
    makeRank(15, 'Eudora', 0.485),
    makeRank(18, 'Layla', 0.51),
    makeRank(110, 'Valentina', 0.535),
    makeRank(95, 'Yu Zhong', 0.54),
    makeRank(84, 'Ling', 0.52),
    makeRank(55, 'Angela', 0.53),
  ];

  const positionMap = new Map<number, HeroMetadataSummary>([
    [1, { roles: ['marksman'], lanes: ['gold lane'], assistIds: [6], strongIds: [], weakIds: [21] }],
    [6, { roles: ['tank'], lanes: ['roam'], assistIds: [1, 110], strongIds: [18, 15], weakIds: [] }],
    [21, { roles: ['assassin'], lanes: ['jungle'], assistIds: [55], strongIds: [18, 15], weakIds: [6] }],
    [34, { roles: ['support'], lanes: ['roam'], assistIds: [18], strongIds: [], weakIds: [21] }],
    [15, { roles: ['mage'], lanes: ['mid lane'], assistIds: [], strongIds: [], weakIds: [21, 6] }],
    [18, { roles: ['marksman'], lanes: ['gold lane'], assistIds: [34], strongIds: [], weakIds: [21, 6] }],
    [110, { roles: ['mage'], lanes: ['mid lane'], assistIds: [6], strongIds: [34], weakIds: [] }],
    [95, { roles: ['fighter'], lanes: ['exp lane'], assistIds: [], strongIds: [34], weakIds: [] }],
    [84, { roles: ['assassin'], lanes: ['jungle'], assistIds: [55], strongIds: [18], weakIds: [6] }],
    [55, { roles: ['support'], lanes: ['roam'], assistIds: [21, 84], strongIds: [], weakIds: [] }],
  ]);

  const heroNameMap = new Map<number, { name: string; head: string }>([
    [1, { name: 'Miya', head: '' }],
    [6, { name: 'Tigreal', head: '' }],
    [21, { name: 'Hayabusa', head: '' }],
    [34, { name: 'Estes', head: '' }],
    [15, { name: 'Eudora', head: '' }],
    [18, { name: 'Layla', head: '' }],
    [110, { name: 'Valentina', head: '' }],
    [95, { name: 'Yu Zhong', head: '' }],
    [84, { name: 'Ling', head: '' }],
    [55, { name: 'Angela', head: '' }],
  ]);

  return { heroRanks, positionMap, heroNameMap };
}

test('predictTeamWinProbability returns neutral 50% awaiting draft when both teams are empty', () => {
  const { heroRanks, positionMap, heroNameMap } = buildTestFixtures();
  const res = predictTeamWinProbability({
    allyHeroIds: [],
    enemyHeroIds: [],
    heroRanks,
    positionMap,
    heroNameMap,
  });

  assert.equal(res.hasTeams, false);
  assert.equal(res.winProbabilityPct, 50);
  assert.equal(res.opponentProbabilityPct, 50);
  assert.equal(res.verdict, 'Awaiting Draft');
});

test('predictTeamWinProbability returns exact 50% on identical mirror lineups', () => {
  const { heroRanks, positionMap, heroNameMap } = buildTestFixtures();
  const lineup = [6, 21, 110, 1, 95];
  const res = predictTeamWinProbability({
    allyHeroIds: lineup,
    enemyHeroIds: [...lineup],
    heroRanks,
    positionMap,
    heroNameMap,
  });

  assert.equal(res.hasTeams, true);
  assert.equal(res.isFullFiveVsFive, true);
  assert.equal(res.winProbabilityPct, 50);
  assert.equal(res.opponentProbabilityPct, 50);
  assert.equal(res.verdict, 'Even Matchup');
});

test('predictTeamWinProbability preserves exact zero-sum symmetry when teams are swapped', () => {
  const { heroRanks, positionMap, heroNameMap } = buildTestFixtures();
  const teamA = [6, 21, 110, 1, 95]; // balanced high-WR comp with Tigreal+Valentina+Hayabusa
  const teamB = [34, 15, 18, 84, 55]; // squishier opponent comp

  const forward = predictTeamWinProbability({
    allyHeroIds: teamA,
    enemyHeroIds: teamB,
    heroRanks,
    positionMap,
    heroNameMap,
  });

  const reversed = predictTeamWinProbability({
    allyHeroIds: teamB,
    enemyHeroIds: teamA,
    heroRanks,
    positionMap,
    heroNameMap,
  });

  assert.ok(forward.winProbabilityPct > 55, `Expected Team A favored (>55%), got ${forward.winProbabilityPct}`);
  assert.equal(
    Math.round((forward.winProbabilityPct + reversed.winProbabilityPct) * 100) / 100,
    100,
  );
  assert.equal(forward.opponentProbabilityPct, reversed.winProbabilityPct);
  assert.ok(forward.winProbabilityPct >= 5 && forward.winProbabilityPct <= 95);
});

test('predictTeamWinProbability rewards balanced frontline + mixed damage over all-marksman stack', () => {
  const { heroRanks, positionMap, heroNameMap } = buildTestFixtures();

  const balanced = predictTeamWinProbability({
    allyHeroIds: [6, 110, 1], // Tank + Mage + Marksman (51.33% avg WR)
    enemyHeroIds: [1, 18, 15], // No tank, 2 marksmen + mage
    heroRanks,
    positionMap,
    heroNameMap,
  });

  assert.ok(
    balanced.allyProfile.balanceScore > balanced.enemyProfile.balanceScore,
    'Balanced tank+mage+marksman draft should score higher balance than tankless comp',
  );
  assert.ok(balanced.winProbabilityPct > 52);
  assert.ok(balanced.factors.length === 4);
});

test('predictTeamWinProbability handles one-sided draft without uncontested balance inflation', () => {
  const { heroRanks, positionMap, heroNameMap } = buildTestFixtures();
  const oneSided = predictTeamWinProbability({
    allyHeroIds: [6, 110, 1], // avg WR ~52.33%
    enemyHeroIds: [],
    heroRanks,
    positionMap,
    heroNameMap,
  });

  assert.equal(oneSided.hasTeams, true);
  assert.equal(oneSided.verdict, 'Pick Opponent');
  assert.ok(
    oneSided.winProbabilityPct > 50 && oneSided.winProbabilityPct < 60,
    `Expected modest meta-only baseline (~55%), got ${oneSided.winProbabilityPct}`,
  );
});
