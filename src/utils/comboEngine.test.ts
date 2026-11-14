import test from 'node:test';
import assert from 'node:assert/strict';
import type { HeroRankRecord } from '../types/mlbb';
import {
  buildDeterministicProTips,
  buildTeamComboRecommendations,
} from './comboEngine';
import type { HeroMetadataSummary } from './mlbb';

test('buildTeamComboRecommendations ranks compatible partners, marks allied heroes, and infers synergy labels', () => {
  const compatRecord: HeroRankRecord = {
    data: {
      main_heroid: 1,
      main_hero_win_rate: 0.504,
      main_hero_appearance_rate: 0.024,
      main_hero_ban_rate: 0.03,
      main_hero: { data: { name: 'Miya', head: '' } },
      sub_hero: [
        { heroid: 10, increase_win_rate: 0.0325, hero: { data: { name: 'Tigreal', head: 't.png' } } },
        { heroid: 55, increase_win_rate: 0.024, hero: { data: { name: 'Angela', head: 'a.png' } } },
        { heroid: 15, increase_win_rate: 0.015, hero: { data: { name: 'Eudora', head: 'e.png' } } },
      ],
    },
  };

  const heroNameMap = new Map([
    [1, { name: 'Miya', head: 'm.png' }],
    [10, { name: 'Tigreal', head: 't.png' }],
    [55, { name: 'Angela', head: 'a.png' }],
    [15, { name: 'Eudora', head: 'e.png' }],
  ]);

  const positionMap = new Map<number, HeroMetadataSummary>([
    [1, { roles: ['marksman'], lanes: ['gold'] }],
    [10, { roles: ['tank'], lanes: ['roam'] }],
    [55, { roles: ['support'], lanes: ['roam'] }],
    [15, { roles: ['mage'], lanes: ['mid'] }],
  ]);

  const combos = buildTeamComboRecommendations({
    myHeroId: 1,
    allyHeroIds: [10],
    compatRecord,
    heroNameMap,
    positionMap,
  });

  assert.equal(combos.length, 3);
  assert.equal(combos[0].partnerName, 'Tigreal');
  assert.equal(combos[0].alreadyInTeam, true);
  assert.equal(combos[0].winRateBoostPct, 3.25);
  assert.equal(combos[0].synergyLabel, 'Frontline Set + Backline Follow-Up');
  assert.equal(combos[1].partnerName, 'Angela');
  assert.equal(combos[1].alreadyInTeam, false);
  assert.equal(combos[1].synergyLabel, 'Sustain Enable + Dive / Carry');
});

test('buildDeterministicProTips synthesizes skill priority and combo sequences from hero skills', () => {
  const tips = buildDeterministicProTips({
    heroName: 'Khufra',
    roles: ['tank'],
    lanes: ['roam'],
    winRatePct: 53.2,
    skills: [
      { slot: 'Passive', name: 'Spell Curse', summary: 'Empowers basic attack.' },
      { slot: 'Skill 1', name: "Tyrant's Revenge", summary: 'Long-range dash knock-up.' },
      { slot: 'Skill 2', name: 'Bouncing Ball', summary: 'Blocks enemy dashes.' },
      { slot: 'Ult', name: "Tyrant's Rage", summary: 'Pulls enemies toward Khufra.' },
    ],
  });

  assert.equal(tips.skillPriority.orderLabel, 'Ult > Skill 2 > Skill 1');
  assert.ok(tips.recommendedCombos.length >= 2);
  assert.equal(tips.recommendedCombos[0].sequence[0].label, "Tyrant's Revenge");
  assert.equal(tips.recommendedCombos[0].sequence[1].label, "Tyrant's Rage");
});
