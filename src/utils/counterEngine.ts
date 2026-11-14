import type {
  DraftAnalysis,
  EquipmentRecord,
  ItemRecommendation,
  RecommendationCategory,
} from '../types/mlbb';
import { stripHtmlTags, type HeroMetadataSummary } from './mlbb';

interface HeroCombatProfile {
  damageType: 'physical' | 'magic' | 'hybrid';
  isHealerOrSustain: boolean;
  isBurst: boolean;
  isBasicAttackDps: boolean;
  isTanky: boolean;
  hasHeavyCc: boolean;
}

const HEALER_SUSTAIN_HEROES = new Set([
  'estes',
  'angela',
  'rafaela',
  'floryn',
  'uranus',
  'esmeralda',
  'ruby',
  'yu zhong',
  'alucard',
  'alpha',
  'alice',
  'thamuz',
  'lapu-lapu',
  'fredrinn',
  'minotaur',
  'mathilda',
  'cici',
  'lukas',
  'suyou',
]);

const MAGIC_BURST_HEROES = new Set([
  'eudora',
  'kagura',
  'kadita',
  'vale',
  'aurora',
  'gusion',
  'aamon',
  'harley',
  'selena',
  'lunox',
  'xavier',
  'pharsa',
  'cecilion',
  'valentina',
  'novaria',
  'vexana',
  'zhuxin',
]);

const MAGIC_DPS_HEROES = new Set([
  "chang'e",
  'kimmy',
  'yve',
  'zhask',
  'valir',
  'lylia',
  'natan',
  'harith',
  'odette',
  'cyclops',
  'gord',
  'alice',
  'guinevere',
  'julian',
]);

const CRIT_ATTACK_SPEED_HEROES = new Set([
  'miya',
  'layla',
  'moskov',
  'bruno',
  'irithel',
  'wanwan',
  'claude',
  'karrie',
  'melissa',
  'hanabi',
  'popol and kupa',
  'obsidia',
  'argus',
  'sun',
  'zilong',
  'freya',
  'aulus',
  'natan',
]);

const PHYSICAL_SKILL_BURST_HEROES = new Set([
  'saber',
  'hayabusa',
  'lancelot',
  'fanny',
  'ling',
  'fanny',
  'natalia',
  'helcurt',
  'nolans',
  'nolan',
  'brody',
  'granger',
  'lesley',
  'beatrix',
  'clint',
  'paquito',
  'chou',
  'dyrroth',
  'bene',
  'benedetta',
  'arlott',
  'khaleed',
  'martis',
]);

const HEAVY_CC_HEROES = new Set([
  'tigreal',
  'atlas',
  'khufra',
  'franco',
  'kaja',
  'chou',
  'ruby',
  'guinevere',
  'eudora',
  'aurora',
  'selena',
  'minsitthar',
  'edith',
  'gloo',
  'belerick',
  'lolita',
  'akashic',
  'marcel',
]);

export function classifyHeroProfile(
  heroName: string,
  pos?: HeroMetadataSummary,
): HeroCombatProfile {
  const n = heroName.trim().toLowerCase();
  const roles = pos?.roles || [];

  const isMage = roles.some((r) => r.includes('mage'));
  const isSupport = roles.some((r) => r.includes('support'));
  const isTank = roles.some((r) => r.includes('tank'));
  const isMarksman = roles.some((r) => r.includes('marksman'));
  const isAssassin = roles.some((r) => r.includes('assassin'));
  const isFighter = roles.some((r) => r.includes('fighter'));

  let damageType: 'physical' | 'magic' | 'hybrid' = 'physical';
  if (MAGIC_BURST_HEROES.has(n) || MAGIC_DPS_HEROES.has(n) || (isMage && !isMarksman)) {
    damageType = 'magic';
  } else if (n === 'julian' || n === 'guinevere' || n === 'edith' || n === 'esmeralda' || n === 'kaja' || n === 'silvanna' || n === 'natan') {
    damageType = 'magic';
  } else if (isSupport && !isFighter && !isTank) {
    damageType = 'magic';
  }

  const isHealerOrSustain = HEALER_SUSTAIN_HEROES.has(n) || isSupport;
  const isBurst =
    MAGIC_BURST_HEROES.has(n) ||
    PHYSICAL_SKILL_BURST_HEROES.has(n) ||
    isAssassin;
  const isBasicAttackDps = CRIT_ATTACK_SPEED_HEROES.has(n) || isMarksman;
  const isTanky = isTank || n === 'fredrinn' || n === 'yu zhong' || n === 'barats' || n === 'gatotkaca' || n === 'terizla' || n === 'hylos' || n === 'belerick' || n === 'gloo';
  const hasHeavyCc = HEAVY_CC_HEROES.has(n) || isTank;

  return {
    damageType,
    isHealerOrSustain,
    isBurst,
    isBasicAttackDps,
    isTanky,
    hasHeavyCc,
  };
}

function cleanEquipStats(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/·\s*$/, '')
    .trim();
}

export function analyzeDraftAndRecommendItems(opts: {
  myHeroId: number | null;
  allyHeroIds: number[];
  enemyHeroIds: number[];
  positionMap: Map<number, HeroMetadataSummary>;
  heroNameMap: Map<number, { name: string; head: string }>;
  equipmentList: EquipmentRecord[];
}): DraftAnalysis {
  const { myHeroId, allyHeroIds, enemyHeroIds, positionMap, heroNameMap, equipmentList } = opts;

  const equipByName = new Map<string, EquipmentRecord>();
  for (const eq of equipmentList) {
    const key = (eq.data?.equipname || '').trim().toLowerCase();
    if (key && !equipByName.has(key)) {
      equipByName.set(key, eq);
    }
  }

  const myInfo = myHeroId ? heroNameMap.get(myHeroId) : undefined;
  const myPos = myHeroId ? positionMap.get(myHeroId) : undefined;
  const myRoles = myPos?.roles || [];
  const myProfile = myInfo ? classifyHeroProfile(myInfo.name, myPos) : null;

  const isMyMage = myProfile?.damageType === 'magic';
  const isMyTankOrRoam =
    myRoles.some((r) => r.includes('tank') || r.includes('support')) ||
    myPos?.lanes?.some((l) => l.includes('roam'));
  const isMyMarksman = myRoles.some((r) => r.includes('marksman'));
  const isMyFighterOrAssassin = myRoles.some(
    (r) => r.includes('fighter') || r.includes('assassin'),
  );

  // Inspect enemies
  const enemyProfiles = enemyHeroIds
    .map((id) => {
      const name = heroNameMap.get(id)?.name || `Hero #${id}`;
      const pos = positionMap.get(id);
      return { id, name, pos, profile: classifyHeroProfile(name, pos) };
    });

  // Inspect allies
  const allyProfiles = allyHeroIds
    .map((id) => {
      const name = heroNameMap.get(id)?.name || `Hero #${id}`;
      const pos = positionMap.get(id);
      return { id, name, pos, profile: classifyHeroProfile(name, pos) };
    });

  const healers = enemyProfiles.filter((e) => e.profile.isHealerOrSustain);
  const magicBurstEnemies = enemyProfiles.filter(
    (e) => e.profile.damageType === 'magic' && (e.profile.isBurst || !MAGIC_DPS_HEROES.has(e.name.toLowerCase())),
  );
  const magicDpsEnemies = enemyProfiles.filter(
    (e) => e.profile.damageType === 'magic' && MAGIC_DPS_HEROES.has(e.name.toLowerCase()),
  );
  const magicAllEnemies = enemyProfiles.filter((e) => e.profile.damageType === 'magic');
  const physicalBurstEnemies = enemyProfiles.filter(
    (e) => e.profile.damageType === 'physical' && e.profile.isBurst,
  );
  const basicAttackEnemies = enemyProfiles.filter((e) => e.profile.isBasicAttackDps);
  const tankEnemies = enemyProfiles.filter((e) => e.profile.isTanky);
  const ccEnemies = enemyProfiles.filter((e) => e.profile.hasHeavyCc);

  const allyHealers = allyProfiles.filter((a) => a.profile.isHealerOrSustain);
  const allyTanks = allyProfiles.filter((a) => a.profile.isTanky);

  const notes: string[] = [];
  if (healers.length > 0) {
    notes.push(
      `Anti-heal needed against ${healers.map((h) => h.name).slice(0, 3).join(', ')}.`,
    );
  }
  if (magicAllEnemies.length >= 2) {
    notes.push(
      `Heavy magic threat (${magicAllEnemies.map((m) => m.name).slice(0, 3).join(', ')}) — prioritize magic defense.`,
    );
  }
  if (tankEnemies.length >= 2) {
    notes.push(
      `High enemy frontline armor (${tankEnemies.map((t) => t.name).slice(0, 3).join(', ')}) — add % penetration.`,
    );
  }
  if (allyHealers.length > 0) {
    notes.push(
      `Allied sustain from ${allyHealers.map((a) => a.name).slice(0, 2).join(', ')} boosts Oracle & shield value.`,
    );
  }
  if (myHeroId && allyTanks.length === 0 && !isMyTankOrRoam) {
    notes.push('Allied draft lacks a primary tank — include defensive survivability items.');
  }

  const recs = new Map<string, ItemRecommendation>();

  function addRec(
    equipName: string,
    category: RecommendationCategory,
    priority: 'Core Counter' | 'High' | 'Situational',
    score: number,
    reason: string,
  ) {
    const existing = recs.get(equipName);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      existing.score = Math.max(existing.score, score);
      if (priority === 'Core Counter') existing.priority = 'Core Counter';
      return;
    }
    const found = equipByName.get(equipName.toLowerCase());
    recs.set(equipName, {
      equipName: found?.data.equipname || equipName,
      equipId: found?.data.equipid,
      icon: found?.data.equipicon,
      typeLabel:
        found?.data.equiptypename ||
        (category === 'damage'
          ? 'Attack'
          : category === 'sustain'
            ? 'Sustain'
            : category === 'counter'
              ? 'Counter'
              : 'Defense'),
      category,
      priority,
      statsSummary:
        cleanEquipStats(found?.data.equiptips) ||
        stripHtmlTags(found?.data.equipskilldesc || '').slice(0, 90),
      reasons: [reason],
      score,
    });
  }

  // 1. Anti-Heal Counter Logic
  if (healers.length > 0) {
    const names = healers.map((h) => h.name).slice(0, 3).join(', ');
    if (isMyMage) {
      addRec(
        'Glowing Wand',
        'counter',
        'Core Counter',
        98,
        `Cuts HP regen & shields on ${names} by 50% with Lifebane burn.`,
      );
    } else if (isMyTankOrRoam) {
      addRec(
        'Dominance Ice',
        'counter',
        'Core Counter',
        98,
        `Reduces healing & attack speed of ${names} nearby while adding hybrid armor.`,
      );
    } else {
      addRec(
        'Sea Halberd',
        'counter',
        'Core Counter',
        98,
        `Applies Lifebane (-50% shield/regen) against ${names} and deals bonus damage to higher-HP targets.`,
      );
      if (isMyFighterOrAssassin) {
        addRec(
          'Dominance Ice',
          'counter',
          'High',
          84,
          `Alternative frontline anti-heal aura if diving directly into ${names}.`,
        );
      }
    }
  }

  // 2. Magic Threat Counter Logic
  if (magicDpsEnemies.length > 0) {
    const names = magicDpsEnemies.map((m) => m.name).slice(0, 2).join(', ');
    addRec(
      'Radiant Armor',
      'defense',
      'Core Counter',
      92,
      `Stacks continuous magic damage reduction against multi-hit poke from ${names}.`,
    );
  }
  if (magicBurstEnemies.length > 0) {
    const names = magicBurstEnemies.map((m) => m.name).slice(0, 2).join(', ');
    if (isMyMarksman || isMyFighterOrAssassin) {
      addRec(
        'Rose Gold Meteor',
        'sustain',
        'High',
        88,
        `Triggers a clutch lifeline shield + lifesteal against burst combos from ${names}.`,
      );
    }
    addRec(
      "Athena's Shield",
      'defense',
      magicBurstEnemies.length >= 2 ? 'Core Counter' : 'High',
      90,
      `Absorbs 25% magic burst damage for 3s when engaged by ${names}.`,
    );
  }

  // 3. Physical Threat & Basic Attack Counter Logic
  if (basicAttackEnemies.length > 0) {
    const names = basicAttackEnemies.map((b) => b.name).slice(0, 2).join(', ');
    if (isMyTankOrRoam || isMyFighterOrAssassin) {
      addRec(
        'Blade Armor',
        'counter',
        'High',
        87,
        `Reflects basic attack damage and reduces critical damage from ${names}.`,
      );
    }
    if (isMyMarksman) {
      addRec(
        'Wind of Nature',
        'counter',
        'Core Counter',
        94,
        `Active physical damage immunity (2s) blocks dives and duels against ${names}.`,
      );
    }
  }

  if (physicalBurstEnemies.length > 0) {
    const names = physicalBurstEnemies.map((p) => p.name).slice(0, 2).join(', ');
    addRec(
      'Antique Cuirass',
      'defense',
      'High',
      89,
      `Reduces enemy physical attack by up to 18% when hit by ${names}'s skills.`,
    );
    if (isMyMage) {
      addRec(
        'Winter Crown',
        'counter',
        'Core Counter',
        93,
        `Freeze stasis dodges lethal assassin dives from ${names}.`,
      );
    }
  }

  // 4. Heavy CC Boots Recommendation
  if (ccEnemies.length >= 2) {
    addRec(
      'Tough Boots',
      'defense',
      'High',
      85,
      `30% crowd-control duration reduction against ${ccEnemies.map((c) => c.name).slice(0, 3).join(', ')}.`,
    );
  } else if (basicAttackEnemies.length >= 2) {
    addRec(
      'Warrior Boots',
      'defense',
      'Situational',
      74,
      `Stacks physical defense against early lane pressure from ${basicAttackEnemies.map((b) => b.name).slice(0, 2).join(', ')}.`,
    );
  }

  // 5. Damage & Armor/Magic Penetration Recommendations
  if (isMyMage) {
    if (tankEnemies.length >= 1) {
      addRec(
        'Divine Glaive',
        'damage',
        tankEnemies.length >= 2 ? 'Core Counter' : 'High',
        91,
        `Pierces high magic defense built by ${tankEnemies.map((t) => t.name).slice(0, 2).join(', ')}.`,
      );
      addRec(
        'Wishing Lantern',
        'damage',
        'High',
        84,
        `Deals % current HP magic damage to melt high-HP frontliners.`,
      );
    }
    addRec(
      'Holy Crystal',
      'damage',
      'High',
      82,
      `Core magic power multiplier to maximize burst and teamfight DPS.`,
    );
  } else if (!isMyTankOrRoam) {
    if (tankEnemies.length >= 1) {
      addRec(
        'Malefic Roar',
        'damage',
        tankEnemies.length >= 2 ? 'Core Counter' : 'High',
        91,
        `Armor penetration shreds frontline defense on ${tankEnemies.map((t) => t.name).slice(0, 2).join(', ')}.`,
      );
      addRec(
        'Demon Hunter Sword',
        'damage',
        'High',
        86,
        `Deals 8% target current HP on-hit plus lifesteal sustain against tanky targets.`,
      );
    }
    addRec(
      'Blade of Despair',
      'damage',
      'High',
      81,
      `High raw physical attack spike to finish low-HP targets.`,
    );
  } else {
    // Tank / Roam damage-utility hybrid option
    addRec(
      'Thunder Belt',
      'damage',
      'High',
      80,
      `Scales hybrid defense with true-damage slow procs for extended skirmishes.`,
    );
  }

  // 6. Sustain & Survivability Recommendations (adapts to hero & allied healers)
  if (isMyMage) {
    addRec(
      'Concentrated Energy',
      'sustain',
      'High',
      83,
      `Grants 20% hybrid lifesteal and stacking magic power during prolonged teamfights.`,
    );
  } else if (isMyMarksman) {
    addRec(
      "Haas' Claws",
      'sustain',
      'High',
      83,
      `25% lifesteal + crit attack speed boost keeps marksmen healthy through poke.`,
    );
  } else if (isMyTankOrRoam || isMyFighterOrAssassin) {
    addRec(
      'Oracle',
      'sustain',
      allyHealers.length > 0 ? 'Core Counter' : 'High',
      allyHealers.length > 0 ? 90 : 80,
      allyHealers.length > 0
        ? `Amplifies shields and healing received from ${allyHealers.map((a) => a.name).join(', ')} by 30%.`
        : `Boosts personal regen/shields by 30% alongside hybrid defense and CDR.`,
    );
    addRec(
      "Queen's Wings",
      'sustain',
      'High',
      82,
      `Reduces incoming damage by 30% below 40% HP with spell vamp sustain.`,
    );
  }

  addRec(
    'Immortality',
    'sustain',
    'Situational',
    76,
    `Late-game resurrection passive protects against decisive teamfight wipes.`,
  );

  const sorted = Array.from(recs.values()).sort((a, b) => b.score - a.score);

  return {
    threats: {
      physicalCount: enemyProfiles.filter((e) => e.profile.damageType === 'physical').length,
      magicCount: magicAllEnemies.length,
      healerCount: healers.length,
      tankCount: tankEnemies.length,
      burstCount: physicalBurstEnemies.length + magicBurstEnemies.length,
      ccCount: ccEnemies.length,
      allyHealerCount: allyHealers.length,
      allyFrontlineCount: allyTanks.length,
      notes,
    },
    recommendations: sorted,
  };
}
