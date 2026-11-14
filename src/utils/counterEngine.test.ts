import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDraftAndRecommendItems } from './counterEngine';
import { filterLeaderboardPlayers } from './mlbb';
import { TOP_TIER_LEADERBOARD } from '../data/topPlayers';
import type { EquipmentRecord } from '../types/mlbb';

const MOCK_EQUIPMENT: EquipmentRecord[] = [
  { id: 1, data: { equipid: 3013, equipname: 'Sea Halberd', equipicon: '', equiptypename: 'Attack', equiptips: '+80 Physical Attack' } },
  { id: 2, data: { equipid: 3105, equipname: 'Glowing Wand', equipicon: '', equiptypename: 'Magic', equiptips: '+60 Magic Power' } },
  { id: 3, data: { equipid: 3206, equipname: 'Dominance Ice', equipicon: '', equiptypename: 'Defense', equiptips: '+40 Physical Defense' } },
  { id: 4, data: { equipid: 3205, equipname: "Athena's Shield", equipicon: '', equiptypename: 'Defense', equiptips: '+48 Magic Defense' } },
  { id: 5, data: { equipid: 3210, equipname: 'Radiant Armor', equipicon: '', equiptypename: 'Defense', equiptips: '+40 Magic Defense' } },
  { id: 6, data: { equipid: 3001, equipname: 'Malefic Roar', equipicon: '', equiptypename: 'Attack', equiptips: '+60 Physical Attack' } },
  { id: 7, data: { equipid: 3204, equipname: 'Oracle', equipicon: '', equiptypename: 'Defense', equiptips: '+850 HP' } },
  { id: 8, data: { equipid: 2011, equipname: 'Wind of Nature', equipicon: '', equiptypename: 'Attack', equiptips: '+30 Physical Attack' } },
];

test('filterLeaderboardPlayers filters by player name and region', () => {
  const byName = filterLeaderboardPlayers(TOP_TIER_LEADERBOARD, 'kairi', 'all');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].playerName, 'Kairi');

  const byRegionQuery = filterLeaderboardPlayers(TOP_TIER_LEADERBOARD, 'indonesia', 'all');
  assert.ok(byRegionQuery.length >= 3);
  assert.ok(byRegionQuery.every((p) => p.region === 'ID'));

  const byRegionSelect = filterLeaderboardPlayers(TOP_TIER_LEADERBOARD, '', 'PH');
  assert.ok(byRegionSelect.length >= 2);
  assert.ok(byRegionSelect.every((p) => p.region === 'PH'));
});

test('analyzeDraftAndRecommendItems recommends anti-heal, magic def, and penetration accurately', () => {
  const positionMap = new Map([
    [1, { roles: ['marksman'], lanes: ['gold lane'] }],
    [34, { roles: ['support'], lanes: ['roam'] }],
    [15, { roles: ['mage'], lanes: ['mid lane'] }],
    [10, { roles: ['tank'], lanes: ['roam'] }],
    [18, { roles: ['marksman'], lanes: ['gold lane'] }],
    [55, { roles: ['support'], lanes: ['roam'] }],
  ]);

  const heroNameMap = new Map([
    [1, { name: 'Miya', head: '' }],
    [34, { name: 'Estes', head: '' }],
    [15, { name: 'Eudora', head: '' }],
    [10, { name: 'Tigreal', head: '' }],
    [18, { name: 'Layla', head: '' }],
    [55, { name: 'Angela', head: '' }],
  ]);

  const result = analyzeDraftAndRecommendItems({
    myHeroId: 1, // Miya (Marksman)
    allyHeroIds: [55], // Angela
    enemyHeroIds: [34, 15, 10, 18], // Estes, Eudora, Tigreal, Layla
    positionMap,
    heroNameMap,
    equipmentList: MOCK_EQUIPMENT,
  });

  const names = result.recommendations.map((r) => r.equipName);
  assert.ok(names.includes('Sea Halberd'), 'Should recommend Sea Halberd for Marksman vs Estes');
  assert.ok(names.includes("Athena's Shield"), 'Should recommend Athena Shield vs Eudora');
  assert.ok(names.includes('Wind of Nature'), 'Should recommend Wind of Nature vs Layla');
  assert.ok(names.includes('Malefic Roar'), 'Should recommend Malefic Roar vs Tigreal');
  assert.ok(result.threats.healerCount >= 1);
  assert.ok(result.threats.allyHealerCount === 1);
});

test('analyzeDraftAndRecommendItems recommends Glowing Wand for mages and Oracle for tanks with allied healers', () => {
  const positionMap = new Map([
    [15, { roles: ['mage'], lanes: ['mid lane'] }],
    [10, { roles: ['tank'], lanes: ['roam'] }],
    [34, { roles: ['support'], lanes: ['roam'] }],
    [55, { roles: ['support'], lanes: ['roam'] }],
  ]);

  const heroNameMap = new Map([
    [15, { name: 'Eudora', head: '' }],
    [10, { name: 'Tigreal', head: '' }],
    [34, { name: 'Estes', head: '' }],
    [55, { name: 'Angela', head: '' }],
  ]);

  const mageResult = analyzeDraftAndRecommendItems({
    myHeroId: 15,
    allyHeroIds: [],
    enemyHeroIds: [34],
    positionMap,
    heroNameMap,
    equipmentList: MOCK_EQUIPMENT,
  });
  assert.ok(mageResult.recommendations.some((r) => r.equipName === 'Glowing Wand'));

  const tankResult = analyzeDraftAndRecommendItems({
    myHeroId: 10,
    allyHeroIds: [55],
    enemyHeroIds: [34],
    positionMap,
    heroNameMap,
    equipmentList: MOCK_EQUIPMENT,
  });
  assert.ok(tankResult.recommendations.some((r) => r.equipName === 'Dominance Ice'));
  assert.ok(tankResult.recommendations.some((r) => r.equipName === 'Oracle'));
});
