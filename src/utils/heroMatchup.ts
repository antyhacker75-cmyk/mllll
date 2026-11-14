import type {
  AiMatchupAnalysis,
  EquipmentRecord,
  HeroCounterBaselineItem,
  HeroDetailRecord,
  HeroMatchupPayload,
  HeroRankRecord,
  RankFilter,
} from '../types/mlbb';
import { classifyHeroProfile } from './counterEngine';
import { stripHtmlTags, type HeroMetadataSummary } from './mlbb';

function cleanEquipTips(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/·\s*$/, '')
    .trim();
}

export function buildHeroCounterItems(
  heroName: string,
  pos: HeroMetadataSummary | undefined,
  equipmentList: EquipmentRecord[],
): HeroCounterBaselineItem[] {
  const profile = classifyHeroProfile(heroName, pos);
  const equipByName = new Map<string, EquipmentRecord>();
  for (const eq of equipmentList) {
    const key = (eq.data?.equipname || '').trim().toLowerCase();
    if (key && !equipByName.has(key)) {
      equipByName.set(key, eq);
    }
  }

  const items: HeroCounterBaselineItem[] = [];
  const seen = new Set<string>();

  function pushItem(equipName: string, fallbackType: string, reason: string) {
    if (seen.has(equipName)) return;
    seen.add(equipName);
    const match = equipByName.get(equipName.toLowerCase());
    items.push({
      equipName: match?.data.equipname || equipName,
      icon: match?.data.equipicon,
      typeLabel: match?.data.equiptypename || fallbackType,
      statsSummary:
        cleanEquipTips(match?.data.equiptips) ||
        stripHtmlTags(match?.data.equipskilldesc || '').slice(0, 80),
      reason,
    });
  }

  if (profile.isHealerOrSustain) {
    pushItem(
      'Sea Halberd',
      'Attack',
      `Applies Lifebane (-50% shield and HP regen) to shut down ${heroName}'s sustain.`,
    );
    pushItem(
      'Dominance Ice',
      'Defense',
      `Aura reduces ${heroName}'s healing, shields, and attack speed in teamfights.`,
    );
    pushItem(
      'Glowing Wand',
      'Magic',
      `Magic-damage anti-heal burn keeps Lifebane active against ${heroName}.`,
    );
  }

  if (profile.damageType === 'magic') {
    pushItem(
      "Athena's Shield",
      'Defense',
      `Absorbs 25% magic burst damage for 3s when ${heroName} engages.`,
    );
    pushItem(
      'Radiant Armor',
      'Defense',
      `Stacks magic defense against sustained or multi-hit magic poke from ${heroName}.`,
    );
  }

  if (profile.isBasicAttackDps) {
    pushItem(
      'Blade Armor',
      'Defense',
      `Reflects basic attacks and lowers crit damage from ${heroName}.`,
    );
    pushItem(
      'Wind of Nature',
      'Attack',
      `2s physical immunity lets squishy carries survive ${heroName}'s DPS window.`,
    );
  }

  if (profile.damageType === 'physical' && profile.isBurst) {
    pushItem(
      'Antique Cuirass',
      'Defense',
      `Reduces ${heroName}'s physical attack by up to 18% when hit by skill combos.`,
    );
    pushItem(
      'Winter Crown',
      'Magic',
      `Stasis active dodges ${heroName}'s lethal burst dive combo.`,
    );
  }

  if (profile.hasHeavyCc) {
    pushItem(
      'Tough Boots',
      'Movement',
      `Reduces ${heroName}'s crowd-control duration by 30% for safer escapes.`,
    );
  }

  if (profile.isTanky) {
    pushItem(
      'Demon Hunter Sword',
      'Attack',
      `Shreds ${heroName}'s high HP pool with 8% current-HP on-hit physical damage.`,
    );
    pushItem(
      'Malefic Roar',
      'Attack',
      `Percentage physical penetration cuts through ${heroName}'s stacked armor.`,
    );
    pushItem(
      'Divine Glaive',
      'Magic',
      `Percentage magic penetration breaks through ${heroName}'s magic defense.`,
    );
  }

  // Ensure every hero always surfaces at least 3 targeted counter-items
  if (items.length < 3) {
    if (profile.damageType === 'magic') {
      pushItem(
        'Tough Boots',
        'Movement',
        `Early magic defense and 30% CC reduction in lane against ${heroName}.`,
      );
    } else {
      pushItem(
        'Antique Cuirass',
        'Defense',
        `Lowers ${heroName}'s physical damage output during extended skirmishes.`,
      );
      pushItem(
        'Dominance Ice',
        'Defense',
        `Adds physical defense and slows ${heroName}'s attack speed in close range.`,
      );
    }
  }

  return items.slice(0, 4);
}

export function buildHeroMatchupPayload(opts: {
  heroId: number;
  heroName: string;
  rankFilter: RankFilter;
  pos?: HeroMetadataSummary;
  detail: HeroDetailRecord | null;
  rankRecord?: HeroRankRecord;
  counters: HeroRankRecord | null;
  compat: HeroRankRecord | null;
  heroNameMap: Map<number, { name: string; head: string }>;
  equipmentList: EquipmentRecord[];
}): HeroMatchupPayload {
  const {
    heroId,
    heroName,
    rankFilter,
    pos,
    detail,
    rankRecord,
    counters,
    compat,
    heroNameMap,
    equipmentList,
  } = opts;

  const heroData = detail?.data?.hero?.data;
  const rankStat = rankRecord?.data;
  const rawSkills = heroData?.heroskilllist?.[0]?.skilllist || [];

  const strongAgainst = (counters?.data?.sub_hero || []).slice(0, 5).map((sub) => ({
    name: sub.hero?.data?.name || heroNameMap.get(sub.heroid)?.name || `Hero #${sub.heroid}`,
    winRateBoostPct: Number((sub.increase_win_rate * 100).toFixed(2)),
  }));

  const bestTeammates = (compat?.data?.sub_hero || []).slice(0, 5).map((sub) => ({
    name: sub.hero?.data?.name || heroNameMap.get(sub.heroid)?.name || `Hero #${sub.heroid}`,
    winRateBoostPct: Number((sub.increase_win_rate * 100).toFixed(2)),
  }));

  const slotLabels = ['Passive', 'Skill 1', 'Skill 2', 'Ultimate'];
  const skills = rawSkills.slice(0, 4).map((s, idx) => ({
    slot: slotLabels[idx] || `Skill ${idx}`,
    name: s.skillname,
    cooldownCost: s['skillcd&cost'] || '',
    summary: stripHtmlTags(s.skilldesc || '').slice(0, 160),
  }));

  return {
    heroId,
    heroName,
    rankTier: rankFilter === 'all' ? 'mythic' : rankFilter,
    roles: pos?.roles || [],
    lanes: pos?.lanes || [],
    speciality: heroData?.speciality || [],
    winRatePct: rankStat ? Number((rankStat.main_hero_win_rate * 100).toFixed(2)) : null,
    pickRatePct: rankStat ? Number((rankStat.main_hero_appearance_rate * 100).toFixed(2)) : null,
    banRatePct: rankStat ? Number((rankStat.main_hero_ban_rate * 100).toFixed(2)) : null,
    strongAgainst,
    bestTeammates,
    skills,
    counterItems: buildHeroCounterItems(heroName, pos, equipmentList),
  };
}

export function formatProTipsContext(payload: HeroMatchupPayload): string {
  return [
    `Hero: ${payload.heroName} (${payload.roles.join(' / ') || 'Unknown Role'}; Lanes: ${payload.lanes.join(', ') || 'Flex'}; Specialty: ${payload.speciality.join(', ') || 'N/A'})`,
    `Ranked Meta (${payload.rankTier}): Win Rate ${payload.winRatePct ?? 'N/A'}%, Pick Rate ${payload.pickRatePct ?? 'N/A'}%, Ban Rate ${payload.banRatePct ?? 'N/A'}%`,
    `Ability Kit:\n${
      payload.skills.length
        ? payload.skills
            .map(
              (k) =>
                `- [${k.slot || 'Skill'}] ${k.name}${k.cooldownCost ? ` (${k.cooldownCost})` : ''}: ${k.summary}`,
            )
            .join('\n')
        : '- Skill data unavailable'
    }`,
    `Strong Against (Win Rate Boost): ${
      payload.strongAgainst.length
        ? payload.strongAgainst.map((s) => `${s.name} (+${s.winRateBoostPct}%)`).join(', ')
        : 'None recorded'
    }`,
    `Best Allied Synergies: ${
      payload.bestTeammates.length
        ? payload.bestTeammates.map((t) => `${t.name} (+${t.winRateBoostPct}%)`).join(', ')
        : 'None recorded'
    }`,
  ].join('\n');
}

export function buildDeterministicMatchupAnalysis(payload: {
  heroName: string;
  rankTier?: string;
  roles?: string[];
  winRatePct?: number | null;
  banRatePct?: number | null;
  strongAgainst?: Array<{ name: string; winRateBoostPct: number }>;
  bestTeammates?: Array<{ name: string; winRateBoostPct: number }>;
  skills?: Array<{ name: string; summary: string }>;
  counterItems?: Array<{ equipName: string; typeLabel: string; reason: string }>;
}): AiMatchupAnalysis {
  const roleLabel = payload.roles?.length ? payload.roles.join(' / ') : 'flex';
  const wrText =
    payload.winRatePct != null ? `${payload.winRatePct.toFixed(1)}% win rate` : 'competitive presence';
  const ultSkill = payload.skills?.[3]?.name || payload.skills?.[2]?.name || 'signature ultimate';
  const topAlly = payload.bestTeammates?.[0]?.name;

  return {
    overview: `${payload.heroName} is a ${roleLabel} threat holding a ${wrText} in ${payload.rankTier || 'mythic'} play. Shutting down ${payload.heroName} requires punishing cooldown windows around ${ultSkill} and building targeted defensive or anti-sustain items early.`,
    counterStrategies: [
      `Track ${ultSkill} cooldown before grouping in tight river or Lord chokes.`,
      topAlly
        ? `Draft displacement or burst to separate ${payload.heroName} from high-synergy allies like ${topAlly}.`
        : `Force early lane trades before ${payload.heroName} hits Level 4 and core item spikes.`,
      `Prioritize wave management and brush vision so ${payload.heroName} cannot dictate engage angles.`,
    ],
    itemBuildAdvice: (payload.counterItems || []).slice(0, 3).map((item) => ({
      itemName: item.equipName,
      reason: item.reason,
    })),
    draftVerdict:
      payload.banRatePct != null && payload.banRatePct >= 15
        ? `High-priority draft threat (${payload.banRatePct.toFixed(1)}% ban rate) — answer early with hard crowd control and anti-heal.`
        : `Manageable ${roleLabel} matchup when your draft respects ${payload.heroName}'s power spikes and prioritizes early counter-items.`,
  };
}


