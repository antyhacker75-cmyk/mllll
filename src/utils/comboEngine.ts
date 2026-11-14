import type {
  AiProTips,
  HeroMatchupPayload,
  HeroRankRecord,
  RecommendedSkillCombo,
  TeamComboRecommendation,
} from '../types/mlbb';
import type { HeroMetadataSummary } from './mlbb';

function inferSynergyPair(
  myRoles: string[],
  partnerRoles: string[],
  myName: string,
  partnerName: string,
): { synergyLabel: string; comboNote: string } {
  const myTankOrSupport = myRoles.some((r) => r.includes('tank') || r.includes('support'));
  const myMage = myRoles.some((r) => r.includes('mage'));
  const myMm = myRoles.some((r) => r.includes('marksman'));
  const myAssnOrFight = myRoles.some((r) => r.includes('assassin') || r.includes('fighter'));

  const pTank = partnerRoles.some((r) => r.includes('tank'));
  const pSupport = partnerRoles.some((r) => r.includes('support'));
  const pMage = partnerRoles.some((r) => r.includes('mage'));
  const pMm = partnerRoles.some((r) => r.includes('marksman'));
  const pAssnOrFight = partnerRoles.some((r) => r.includes('assassin') || r.includes('fighter'));

  if ((myMm || myMage) && pTank) {
    return {
      synergyLabel: 'Frontline Set + Backline Follow-Up',
      comboNote: `${partnerName} absorbs enemy engage and groups targets with AoE CC so ${myName} can unload unobstructed DPS.`,
    };
  }
  if ((myAssnOrFight || myMm) && pSupport) {
    return {
      synergyLabel: 'Sustain Enable + Dive / Carry',
      comboNote: `${partnerName} provides healing, shields, or speed boosts that let ${myName} extend aggressive trades and survive counter-burst.`,
    };
  }
  if (myTankOrSupport && (pMm || pMage)) {
    return {
      synergyLabel: 'Engage Peel + Carry Follow-Up',
      comboNote: `Lock down key threats with ${myName}'s utility and create safe space for ${partnerName} to scale and clean up fights.`,
    };
  }
  if (myTankOrSupport && pAssnOrFight) {
    return {
      synergyLabel: 'Pick-Off Dive Combo',
      comboNote: `Coordinate ${myName}'s initiation with ${partnerName}'s dive mobility to delete isolated backline targets.`,
    };
  }
  if ((myMage && pAssnOrFight) || (myAssnOrFight && pMage)) {
    return {
      synergyLabel: 'Burst Layering Combo',
      comboNote: `Combine ${myName} and ${partnerName} to force enemy defensive items to split between magic and physical mitigation.`,
    };
  }
  return {
    synergyLabel: 'High-Win-Rate Meta Synergy',
    comboNote: `Pairing ${myName} with ${partnerName} strengthens mid-game objective skirmishes and lane priority.`,
  };
}

export function buildTeamComboRecommendations(opts: {
  myHeroId: number | null;
  allyHeroIds: number[];
  compatRecord: HeroRankRecord | null;
  heroNameMap: Map<number, { name: string; head: string }>;
  positionMap: Map<number, HeroMetadataSummary>;
  limit?: number;
}): TeamComboRecommendation[] {
  const {
    myHeroId,
    allyHeroIds,
    compatRecord,
    heroNameMap,
    positionMap,
    limit = 4,
  } = opts;

  if (!myHeroId) return [];

  const myInfo = heroNameMap.get(myHeroId);
  const myName = myInfo?.name || `Hero #${myHeroId}`;
  const myRoles = positionMap.get(myHeroId)?.roles || [];
  const allySet = new Set(allyHeroIds);

  const subHeroes = compatRecord?.data?.sub_hero || [];
  if (subHeroes.length === 0) return [];

  const results: TeamComboRecommendation[] = [];
  for (const sub of subHeroes) {
    if (!sub.heroid || sub.heroid === myHeroId) continue;
    const info = heroNameMap.get(sub.heroid);
    const partnerName = sub.hero?.data?.name || info?.name || `Hero #${sub.heroid}`;
    const partnerHead = sub.hero?.data?.head || info?.head || '';
    const partnerRoles = positionMap.get(sub.heroid)?.roles || [];
    const { synergyLabel, comboNote } = inferSynergyPair(
      myRoles,
      partnerRoles,
      myName,
      partnerName,
    );

    results.push({
      partnerHeroId: sub.heroid,
      partnerName,
      partnerHead,
      partnerRole: partnerRoles[0] || 'Flex',
      synergyLabel,
      winRateBoostPct: Number.isFinite(sub.increase_win_rate)
        ? Number((sub.increase_win_rate * 100).toFixed(2))
        : null,
      comboNote,
      alreadyInTeam: allySet.has(sub.heroid),
    });

    if (results.length >= limit) break;
  }

  return results;
}

export function buildDeterministicProTips(payload: {
  heroName: string;
  rankTier?: string;
  roles?: string[];
  lanes?: string[];
  speciality?: string[];
  winRatePct?: number | null;
  strongAgainst?: Array<{ name: string; winRateBoostPct: number }>;
  bestTeammates?: Array<{ name: string; winRateBoostPct: number }>;
  skills?: Array<{ slot?: string; name: string; cooldownCost?: string; summary: string }>;
}): AiProTips {
  const skills = payload.skills || [];
  const passive = skills.find((s) => (s.slot || '').toLowerCase().includes('passive')) || skills[0];
  const s1 =
    skills.find((s) => (s.slot || '').includes('1')) ||
    skills[1] ||
    { slot: 'Skill 1', name: 'Skill 1', summary: 'Primary damage and poke tool.' };
  const s2 =
    skills.find((s) => (s.slot || '').includes('2')) ||
    skills[2] ||
    { slot: 'Skill 2', name: 'Skill 2', summary: 'Mobility or crowd-control utility tool.' };
  const ult =
    skills.find((s) => (s.slot || '').toLowerCase().includes('ult')) ||
    skills[3] ||
    { slot: 'Ult', name: 'Ultimate', summary: 'Signature high-impact teamfight ability.' };

  const rolesLower = (payload.roles || []).map((r) => r.toLowerCase());
  const isSupportOrTank = rolesLower.some((r) => r.includes('tank') || r.includes('support'));
  const isMarksman = rolesLower.some((r) => r.includes('marksman'));
  const isAssassin = rolesLower.some((r) => r.includes('assassin'));

  const roleText = payload.roles?.length ? payload.roles.join(' / ') : 'Flex';
  const laneText = payload.lanes?.length ? payload.lanes.join(' or ') : 'Flex lane';
  const topAllyText = payload.bestTeammates?.[0]?.name
    ? `Pairs well with ${payload.bestTeammates[0].name} (+${payload.bestTeammates[0].winRateBoostPct}% WR synergy).`
    : 'Look for frontline engage or follow-up crowd control around objectives.';

  const orderLabel = isSupportOrTank ? 'Ult > Skill 2 > Skill 1' : 'Ult > Skill 1 > Skill 2';

  const recommendedCombos: RecommendedSkillCombo[] = isMarksman
    ? [
        {
          title: 'Ambush / All-In Burst',
          sequence: [
            { slot: ult.slot || 'Ult', label: ult.name },
            { slot: s2.slot || 'Skill 2', label: s2.name },
            { slot: s1.slot || 'Skill 1', label: s1.name },
            { slot: 'Basic Attack', label: 'Sustained DPS' },
          ],
          whenToUse:
            'Use when enemy crowd control is down to open from stealth or fog and stack attack speed immediately.',
        },
        {
          title: 'Safe Lane Trade',
          sequence: [
            { slot: s2.slot || 'Skill 2', label: s2.name },
            { slot: s1.slot || 'Skill 1', label: s1.name },
            { slot: 'Basic Attack', label: 'Kite Back' },
          ],
          whenToUse:
            'Zone the opposing laner first before activating your primary DPS steroid at max attack range.',
        },
      ]
    : isSupportOrTank
      ? [
          {
            title: 'Engage & Lockdown Chain',
            sequence: [
              { slot: s1.slot || 'Skill 1', label: s1.name },
              { slot: ult.slot || 'Ult', label: ult.name },
              { slot: s2.slot || 'Skill 2', label: s2.name },
            ],
            whenToUse:
              'Initiate on grouped carries when your team is in range to follow up immediately on the displacement.',
          },
          {
            title: 'Counter-Engage Peel',
            sequence: [
              { slot: s2.slot || 'Skill 2', label: s2.name },
              { slot: s1.slot || 'Skill 1', label: s1.name },
            ],
            whenToUse:
              'Save these defensive disruption windows whenever enemy assassins try to dash onto your backline.',
          },
        ]
      : [
          {
            title: 'Core Pick-Off Combo',
            sequence: [
              { slot: s1.slot || 'Skill 1', label: s1.name },
              { slot: s2.slot || 'Skill 2', label: s2.name },
              { slot: ult.slot || 'Ult', label: ult.name },
              ...(passive ? [{ slot: 'Basic Attack', label: 'Procs ' + passive.name }] : []),
            ],
            whenToUse:
              isAssassin
                ? 'Look for isolated backline targets once enemy hard crowd-control cooldowns have been forced.'
                : 'Thread abilities cleanly to maximize burst pressure before repositioning to safety.',
          },
          {
            title: 'Poke & Disengage Trade',
            sequence: [
              { slot: s1.slot || 'Skill 1', label: s1.name },
              { slot: s2.slot || 'Skill 2', label: s2.name },
            ],
            whenToUse:
              'Chunk waves or force enemy sustain potions without committing your Ultimate unnecessarily.',
          },
        ];

  return {
    playstyleSummary: `${payload.heroName} operates best as a ${roleText} in ${laneText}${
      payload.speciality?.length ? ` specializing in ${payload.speciality.join(', ')}` : ''
    }. Play around your cooldown windows and objective setups${
      payload.winRatePct != null ? ` to capitalize on ${payload.heroName}'s ${payload.winRatePct.toFixed(1)}% ranked win rate` : ''
    }.`,
    skillPriority: {
      orderLabel,
      skillsToPrioritize: [
        {
          slot: ult.slot || 'Ult',
          skillName: ult.name,
          reason: `${ult.name} spikes your fight impact whenever leveled—always prioritize points here at levels 4, 8, and 12.`,
        },
        {
          slot: s1.slot || 'Skill 1',
          skillName: s1.name,
          reason: `${s1.name} drives your primary lane trading, wave clear, and core rotation tempo.`,
        },
        {
          slot: s2.slot || 'Skill 2',
          skillName: s2.name,
          reason: `${s2.name} provides crucial mobility, utility, or secondary control during extended skirmishes.`,
        },
      ],
    },
    recommendedCombos,
    comboAndExecution: [
      `Track ${s2.name} and enemy Dash/Flicker cooldowns before committing to an all-in trade.`,
      passive
        ? `Weave basic attacks or rotations cleanly around ${passive.name} to avoid wasting passive procs.`
        : 'Keep wave priority cleanly managed before rotating into river skirmishes.',
      payload.strongAgainst?.[0]
        ? `Press early lane or invade tempo when facing favorable matchups like ${payload.strongAgainst[0].name}.`
        : 'Avoid overextending without minimap vision on the enemy jungler and roamer.',
    ],
    teamfightPositioning: isSupportOrTank
      ? `Anchor fog of war brushes ahead of Turtle and Lord setups to secure vision and force carries onto awkward angles while protecting backline allies.`
      : isMarksman
        ? `Stay behind your frontline engage line at maximum auto-attack range, hitting the safest high-priority target until enemy burst cooldowns are spent.`
        : `Play from flank brushes just outside initial vision and enter once primary enemy crowd-control spells are used on your frontline.`,
    powerSpikesAndMacro: `${payload.heroName} hits a decisive power spike at Level 4 and upon completing core item #1–2; convert picks directly into Turtle or outer turrets. ${topAllyText}`,
  };
}

