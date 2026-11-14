import { HERO_BASE_STATS_CATALOG } from '../data/heroBaseStats';
import type {
  HeroBaseStatsProfile,
  HeroSkill,
  HeroSkillUtilitySlot,
  SkillUtilitySummary,
} from '../types/mlbb';
import { stripHtmlTags } from './mlbb';

const ROLE_BASELINE: Record<string, Omit<HeroBaseStatsProfile, 'source'>> = {
  tank: {
    baseHp: 2740,
    hpGrowth: 215,
    basePhysAtk: 118,
    physAtkGrowth: 7.2,
    basePhysDef: 23,
    physDefGrowth: 4.4,
    baseMagicDef: 15,
    magicDefGrowth: 3.2,
    moveSpeed: 255,
    baseAtkSpeed: 0.81,
    atkSpeedGrowthPct: 1.2,
  },
  fighter: {
    baseHp: 2680,
    hpGrowth: 188,
    basePhysAtk: 123,
    physAtkGrowth: 9.8,
    basePhysDef: 22,
    physDefGrowth: 4.0,
    baseMagicDef: 15,
    magicDefGrowth: 3.0,
    moveSpeed: 255,
    baseAtkSpeed: 0.85,
    atkSpeedGrowthPct: 1.9,
  },
  assassin: {
    baseHp: 2500,
    hpGrowth: 146,
    basePhysAtk: 122,
    physAtkGrowth: 11.4,
    basePhysDef: 17,
    physDefGrowth: 3.3,
    baseMagicDef: 15,
    magicDefGrowth: 2.5,
    moveSpeed: 260,
    baseAtkSpeed: 0.86,
    atkSpeedGrowthPct: 2.2,
  },
  mage: {
    baseHp: 2520,
    hpGrowth: 136,
    basePhysAtk: 113,
    physAtkGrowth: 6.8,
    basePhysDef: 18,
    physDefGrowth: 3.2,
    baseMagicDef: 15,
    magicDefGrowth: 2.5,
    moveSpeed: 248,
    baseAtkSpeed: 0.8,
    atkSpeedGrowthPct: 1.1,
  },
  marksman: {
    baseHp: 2460,
    hpGrowth: 132,
    basePhysAtk: 108,
    physAtkGrowth: 13.0,
    basePhysDef: 16,
    physDefGrowth: 3.0,
    baseMagicDef: 15,
    magicDefGrowth: 2.5,
    moveSpeed: 242,
    baseAtkSpeed: 0.85,
    atkSpeedGrowthPct: 2.8,
  },
  support: {
    baseHp: 2440,
    hpGrowth: 145,
    basePhysAtk: 114,
    physAtkGrowth: 6.6,
    basePhysDef: 16,
    physDefGrowth: 3.2,
    baseMagicDef: 15,
    magicDefGrowth: 2.7,
    moveSpeed: 245,
    baseAtkSpeed: 0.8,
    atkSpeedGrowthPct: 1.1,
  },
};

export function getHeroBaseAndGrowthStats(
  heroName: string,
  roles: string[] = [],
  abilityShow: string[] = [],
): HeroBaseStatsProfile {
  const key = heroName.trim().toLowerCase();
  const catalog = HERO_BASE_STATS_CATALOG[key];
  if (catalog) {
    return { ...catalog, source: 'catalog' };
  }

  const primaryRole = (roles[0] || 'fighter').toLowerCase();
  const base = ROLE_BASELINE[primaryRole] || ROLE_BASELINE.fighter;

  // Calibrate subtly using live abilityshow ratings [Durability, Offense, Control, Difficulty]
  const durability = Math.min(100, Math.max(0, Number(abilityShow[0]) || 50));
  const offense = Math.min(100, Math.max(0, Number(abilityShow[1]) || 50));
  const durabilityOffset = (durability - 50) / 50; // -1..+1
  const offenseOffset = (offense - 50) / 50; // -1..+1

  return {
    baseHp: Math.round(base.baseHp + durabilityOffset * 140),
    hpGrowth: Math.round(base.hpGrowth + durabilityOffset * 18),
    basePhysAtk: Math.round(base.basePhysAtk + offenseOffset * 8),
    physAtkGrowth: Number((base.physAtkGrowth + offenseOffset * 1.1).toFixed(1)),
    basePhysDef: Math.max(12, Math.round(base.basePhysDef + durabilityOffset * 3)),
    physDefGrowth: Number((base.physDefGrowth + durabilityOffset * 0.4).toFixed(1)),
    baseMagicDef: base.baseMagicDef,
    magicDefGrowth: Number((base.magicDefGrowth + durabilityOffset * 0.2).toFixed(1)),
    moveSpeed: base.moveSpeed,
    baseAtkSpeed: base.baseAtkSpeed,
    atkSpeedGrowthPct: Number(
      Math.max(1.0, base.atkSpeedGrowthPct + offenseOffset * 0.3).toFixed(1),
    ),
    source: 'role-calibrated',
  };
}

export function projectStatAtLevel(base: number, perLevelGrowth: number, level: number): number {
  const safeLv = Math.min(15, Math.max(1, Math.floor(level)));
  return Number((base + perLevelGrowth * (safeLv - 1)).toFixed(1));
}

export function parseSkillCooldownAndCost(raw?: string): {
  cooldownSec: number | null;
  cooldownText: string;
  costText: string;
} {
  if (!raw || !raw.trim()) {
    return { cooldownSec: null, cooldownText: 'Passive', costText: 'None' };
  }

  const cdMatch = raw.match(/CD:\s*([\d.]+(?:\s*\/\s*[\d.]+)*)/i);
  const firstNum = cdMatch ? Number(cdMatch[1].split('/')[0].trim()) : NaN;
  const cooldownSec = Number.isFinite(firstNum) ? firstNum : null;
  const cooldownText = cdMatch ? `${cdMatch[1].replace(/\s+/g, '')}s CD` : '—';

  const costMatch = raw.match(/((?:Mana|Energy|HP|Rage|Stack)?\s*Cost:\s*[\d./\s]+)/i);
  const costText = costMatch ? costMatch[1].replace(/\s+/g, ' ').trim() : 'No Cost';

  return { cooldownSec, cooldownText, costText };
}

export function extractSkillUtilityProfile(skills: HeroSkill[]): SkillUtilitySummary {
  const slotLabels = ['Passive', 'Skill 1', 'Skill 2', 'Ultimate'];
  const utilityCounts = {
    cc: 0,
    mobility: 0,
    sustain: 0,
    burst: 0,
    buff: 0,
  };

  const activeCooldowns: number[] = [];
  let ultCdSec: number | null = null;

  const slots: HeroSkillUtilitySlot[] = skills.slice(0, 4).map((skill, idx) => {
    const slotLabel = slotLabels[idx] || `Skill ${idx}`;
    const tags = (skill.skilltag || [])
      .map((t) => t.tagname?.trim())
      .filter((t): t is string => Boolean(t));
    const summary = stripHtmlTags(skill.skilldesc || '');
    const lower = `${tags.join(' ')} ${summary}`.toLowerCase();

    if (/cc|stun|airborne|knock|slow|immobilize|freeze|suppress|taunt|pull|terrify/.test(lower)) {
      utilityCounts.cc += 1;
    }
    if (/mobility|dash|blink|teleport|leap|charge|speed up|movement speed/.test(lower)) {
      utilityCounts.mobility += 1;
    }
    if (/heal|regen|shield|restore|spell vamp|lifesteal|absorb/.test(lower)) {
      utilityCounts.sustain += 1;
    }
    if (/burst|damage|execute|crit|true damage/.test(lower)) {
      utilityCounts.burst += 1;
    }
    if (/buff|immunity|invisible|untargetable|attack speed|immune/.test(lower)) {
      utilityCounts.buff += 1;
    }

    const { cooldownSec, cooldownText, costText } = parseSkillCooldownAndCost(
      skill['skillcd&cost'],
    );
    if (idx > 0 && cooldownSec !== null && cooldownSec > 0) {
      activeCooldowns.push(cooldownSec);
      if (idx === 3 || slotLabel === 'Ultimate') {
        ultCdSec = cooldownSec;
      }
    }

    return {
      slotLabel,
      name: skill.skillname,
      icon: skill.skillicon,
      cooldownSec,
      cooldownText: idx === 0 && cooldownSec === null ? 'Passive' : cooldownText,
      costText,
      tags,
      summary,
    };
  });

  const avgActiveCdSec =
    activeCooldowns.length > 0
      ? Number(
          (activeCooldowns.reduce((a, b) => a + b, 0) / activeCooldowns.length).toFixed(1),
        )
      : null;

  return {
    slots,
    utilityCounts,
    avgActiveCdSec,
    ultCdSec,
  };
}
