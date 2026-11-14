import test from 'node:test';
import assert from 'node:assert/strict';
import type { HeroSkill } from '../types/mlbb';
import {
  extractSkillUtilityProfile,
  getHeroBaseAndGrowthStats,
  parseSkillCooldownAndCost,
  projectStatAtLevel,
} from './heroCompare';

test('getHeroBaseAndGrowthStats resolves catalog stats and role-calibrated fallbacks accurately', () => {
  const hayabusa = getHeroBaseAndGrowthStats('Hayabusa', ['assassin'], ['40', '50', '10', '60']);
  assert.equal(hayabusa.source, 'catalog');
  assert.equal(hayabusa.baseHp, 2429);
  assert.equal(hayabusa.hpGrowth, 145);

  const tigreal = getHeroBaseAndGrowthStats('Tigreal', ['tank'], ['90', '20', '90', '20']);
  assert.equal(tigreal.source, 'catalog');
  assert.ok(tigreal.hpGrowth > hayabusa.hpGrowth);
  assert.ok(tigreal.basePhysDef > hayabusa.basePhysDef);

  // Level 15 projection: base + growth * 14
  assert.equal(projectStatAtLevel(2429, 145, 1), 2429);
  assert.equal(projectStatAtLevel(2429, 145, 15), 4459);

  // Uncataloged hero falls back cleanly using role + abilityshow
  const custom = getHeroBaseAndGrowthStats('UnlistedTank', ['tank'], ['80', '40', '80', '30']);
  assert.equal(custom.source, 'role-calibrated');
  assert.ok(custom.baseHp > 2740);
});

test('parseSkillCooldownAndCost and extractSkillUtilityProfile extract CD, cost, and utility counts', () => {
  const parsed = parseSkillCooldownAndCost('CD: 16 / 14 / 12   Energy Cost: 25');
  assert.equal(parsed.cooldownSec, 16);
  assert.equal(parsed.cooldownText, '16/14/12s CD');
  assert.equal(parsed.costText, 'Energy Cost: 25');

  const skills: HeroSkill[] = [
    {
      skillname: 'Shadow Mark',
      skilldesc: 'Applies mark buff.',
      skillicon: 'p.png',
      'skillcd&cost': '',
      skilltag: [{ tagname: 'Buff' }],
    },
    {
      skillname: 'Phantom Shuriken',
      skilldesc: 'Deals 220 Physical Damage and slows enemies by 35%.',
      skillicon: 's1.png',
      'skillcd&cost': 'CD: 4   Energy Cost: 30',
      skilltag: [{ tagname: 'Damage' }, { tagname: 'Buff' }],
    },
    {
      skillname: 'Quad Shadow',
      skilldesc: 'Dashes forward and teleports to shadow, slowing hit enemies.',
      skillicon: 's2.png',
      'skillcd&cost': 'CD: 16   Energy Cost: 25',
      skilltag: [{ tagname: 'Mobility' }],
    },
    {
      skillname: 'Shadow Kill',
      skilldesc: 'Turns untargetable and deals burst damage.',
      skillicon: 'ult.png',
      'skillcd&cost': 'CD: 40',
      skilltag: [{ tagname: 'Burst' }, { tagname: 'Damage' }],
    },
  ];

  const util = extractSkillUtilityProfile(skills);
  assert.equal(util.slots.length, 4);
  assert.equal(util.ultCdSec, 40);
  assert.equal(util.avgActiveCdSec, 20);
  assert.ok(util.utilityCounts.cc >= 2);
  assert.ok(util.utilityCounts.mobility >= 1);
  assert.ok(util.utilityCounts.buff >= 2);
});
