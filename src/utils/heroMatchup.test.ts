import test from 'node:test';
import assert from 'node:assert/strict';
import type { EquipmentRecord, HeroDetailRecord, HeroRankRecord } from '../types/mlbb';
import {
  buildHeroCounterItems,
  buildHeroMatchupPayload,
  formatProTipsContext,
} from './heroMatchup';

const mockEquipment: EquipmentRecord[] = [
  {
    id: 1,
    data: {
      equipid: 3102,
      equipname: 'Sea Halberd',
      equipicon: 'https://example.com/sea.png',
      equiptypename: 'Attack',
      equiptips: '+80 Physical Attack<br>+20% Attack Speed',
    },
  },
  {
    id: 2,
    data: {
      equipid: 2103,
      equipname: "Athena's Shield",
      equipicon: 'https://example.com/athena.png',
      equiptypename: 'Defense',
      equiptips: '+900 HP<br>+62 Magic Defense',
    },
  },
  {
    id: 3,
    data: {
      equipid: 2104,
      equipname: 'Blade Armor',
      equipicon: 'https://example.com/blade.png',
      equiptypename: 'Defense',
      equiptips: '+90 Physical Defense',
    },
  },
];

test('buildHeroCounterItems maps sustain healers and magic burst heroes to accurate MLBB counters', () => {
  const estesItems = buildHeroCounterItems(
    'Estes',
    { roles: ['support'], lanes: ['roam'] },
    mockEquipment,
  );
  assert.ok(estesItems.some((i) => i.equipName === 'Sea Halberd'));
  assert.ok(estesItems.some((i) => i.equipName === 'Dominance Ice'));
  const sea = estesItems.find((i) => i.equipName === 'Sea Halberd');
  assert.equal(sea?.icon, 'https://example.com/sea.png');
  assert.equal(sea?.statsSummary, '+80 Physical Attack · +20% Attack Speed');

  const eudoraItems = buildHeroCounterItems(
    'Eudora',
    { roles: ['mage'], lanes: ['mid'] },
    mockEquipment,
  );
  assert.ok(eudoraItems.some((i) => i.equipName === "Athena's Shield"));
  assert.ok(eudoraItems.some((i) => i.equipName === 'Tough Boots'));
});

test('buildHeroMatchupPayload structures win rates, counters, teammates, and items cleanly', () => {
  const rankRecord: HeroRankRecord = {
    data: {
      main_heroid: 60,
      main_hero_win_rate: 0.5348,
      main_hero_appearance_rate: 0.0291,
      main_hero_ban_rate: 0.0613,
      main_hero: { data: { name: 'Hanabi', head: 'https://example.com/hanabi.png' } },
    },
  };
  const counters: HeroRankRecord = {
    data: {
      main_heroid: 60,
      main_hero_win_rate: 0.5348,
      main_hero_appearance_rate: 0.0291,
      main_hero_ban_rate: 0.0613,
      main_hero: { data: { name: 'Hanabi', head: '' } },
      sub_hero: [{ heroid: 124, increase_win_rate: 0.0598 }],
    },
  };
  const heroNameMap = new Map<number, { name: string; head: string }>([
    [124, { name: 'Chip', head: '' }],
  ]);

  const detail: HeroDetailRecord = {
    data: {
      head: 'https://example.com/hanabi.png',
      hero: {
        data: {
          heroid: 60,
          name: 'Hanabi',
          speciality: ['Finisher', 'Damage'],
          heroskilllist: [
            {
              skilllist: [
                { skillname: 'Ninjutsu: Petal Barrage', skilldesc: 'Bouncing blades.', skillicon: '' },
                { skillname: 'Ninjutsu: Equinox', skilldesc: 'Control-immune shield.', skillicon: '', 'skillcd&cost': 'CD 12s' },
              ],
            },
          ],
        },
      },
    },
  };

  const payload = buildHeroMatchupPayload({
    heroId: 60,
    heroName: 'Hanabi',
    rankFilter: 'mythic',
    pos: { roles: ['marksman'], lanes: ['gold'] },
    detail,
    rankRecord,
    counters,
    compat: null,
    heroNameMap,
    equipmentList: mockEquipment,
  });

  assert.equal(payload.heroName, 'Hanabi');
  assert.equal(payload.winRatePct, 53.48);
  assert.equal(payload.pickRatePct, 2.91);
  assert.equal(payload.banRatePct, 6.13);
  assert.deepEqual(payload.strongAgainst, [{ name: 'Chip', winRateBoostPct: 5.98 }]);
  assert.ok(payload.counterItems.some((i) => i.equipName === 'Blade Armor'));
  assert.equal(payload.skills[0].slot, 'Passive');
  assert.equal(payload.skills[1].slot, 'Skill 1');

  const proContext = formatProTipsContext(payload);
  assert.ok(proContext.includes('Hero: Hanabi'));
  assert.ok(proContext.includes('[Skill 1] Ninjutsu: Equinox (CD 12s)'));
});

