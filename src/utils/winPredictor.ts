import type {
  HeroRankRecord,
  TeamDraftProfile,
  WinPredictionFactor,
  WinPredictionMatchupEdge,
  WinPredictionResult,
  WinVerdict,
} from '../types/mlbb';
import { classifyHeroProfile } from './counterEngine';
import type { HeroMetadataSummary } from './mlbb';

interface HeroDraftEntry {
  heroId: number;
  name: string;
  head: string;
  winRatePct: number | null;
  roles: string[];
  lanes: string[];
  assistIds: number[];
  strongIds: number[];
  weakIds: number[];
  profile: ReturnType<typeof classifyHeroProfile>;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function resolveHeroDraftEntries(
  heroIds: number[],
  heroRanks: HeroRankRecord[],
  positionMap: Map<number, HeroMetadataSummary>,
  heroNameMap: Map<number, { name: string; head: string }>,
): HeroDraftEntry[] {
  const rankById = new Map<number, HeroRankRecord>();
  for (const rec of heroRanks) {
    if (rec.data?.main_heroid) {
      rankById.set(rec.data.main_heroid, rec);
    }
  }

  return heroIds
    .filter((id) => Number.isFinite(id) && id > 0)
    .map((heroId) => {
      const rankRec = rankById.get(heroId);
      const pos = positionMap.get(heroId);
      const nameEntry = heroNameMap.get(heroId);
      const name =
        rankRec?.data.main_hero?.data?.name || nameEntry?.name || `Hero #${heroId}`;
      const head =
        rankRec?.data.main_hero?.data?.head || nameEntry?.head || pos?.smallmap || '';
      const rawWr = rankRec?.data.main_hero_win_rate;
      const winRatePct =
        typeof rawWr === 'number' && Number.isFinite(rawWr) && rawWr > 0
          ? roundTwo(rawWr * 100)
          : null;

      return {
        heroId,
        name,
        head,
        winRatePct,
        roles: pos?.roles || [],
        lanes: pos?.lanes || [],
        assistIds: pos?.assistIds || [],
        strongIds: pos?.strongIds || [],
        weakIds: pos?.weakIds || [],
        profile: classifyHeroProfile(name, pos),
      };
    });
}

function analyzeTeamEntries(entries: HeroDraftEntry[]): {
  profile: TeamDraftProfile;
  synergyPoints: number;
} {
  const heroCount = entries.length;
  const rated = entries.filter(
    (e): e is HeroDraftEntry & { winRatePct: number } => e.winRatePct !== null,
  );
  const averageWinRatePct =
    rated.length > 0
      ? roundTwo(rated.reduce((sum, e) => sum + e.winRatePct, 0) / rated.length)
      : null;

  const physicalCount = entries.filter((e) => e.profile.damageType === 'physical').length;
  const magicCount = entries.filter((e) => e.profile.damageType === 'magic').length;
  const tankFrontlineCount = entries.filter((e) => e.profile.isTanky).length;
  const sustainCount = entries.filter((e) => e.profile.isHealerOrSustain).length;
  const ccCount = entries.filter((e) => e.profile.hasHeavyCc).length;
  const burstCount = entries.filter((e) => e.profile.isBurst).length;

  const roleSet = new Set<string>();
  let marksmanCount = 0;
  let mageCount = 0;
  let assassinCount = 0;
  let tankOrSupportCount = 0;
  let carryCount = 0;

  for (const entry of entries) {
    for (const r of entry.roles) {
      const clean = capitalizeWord(r.trim());
      if (clean) roleSet.add(clean);
    }
    if (entry.roles.some((r) => r.includes('marksman'))) marksmanCount++;
    if (entry.roles.some((r) => r.includes('mage'))) mageCount++;
    if (entry.roles.some((r) => r.includes('assassin'))) assassinCount++;
    if (entry.roles.some((r) => r.includes('tank') || r.includes('support'))) {
      tankOrSupportCount++;
    }
    if (entry.roles.some((r) => r.includes('marksman') || r.includes('mage'))) {
      carryCount++;
    }
  }

  // Allied relation synergy links (assistIds)
  const synergyPairs: Array<{ heroA: string; heroB: string }> = [];
  let synergyPoints = 0;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const linked =
        a.assistIds.includes(b.heroId) || b.assistIds.includes(a.heroId);
      if (linked) {
        synergyPairs.push({ heroA: a.name, heroB: b.name });
        synergyPoints += 1.4;
      }
    }
  }

  // Structural role synergy (frontline + backline carry)
  if (tankOrSupportCount >= 1 && carryCount >= 1) {
    synergyPoints += 1.0;
  }
  if (sustainCount >= 1 && tankFrontlineCount >= 1) {
    synergyPoints += 0.6;
  }

  // Composition Balance Score (0 - 10)
  let balanceScore = 0;
  if (heroCount > 0) {
    balanceScore = 3.0;
    if (tankFrontlineCount >= 1) balanceScore += 2.2;
    if (physicalCount >= 1 && magicCount >= 1) {
      balanceScore += 2.2;
    } else if (heroCount >= 3) {
      balanceScore -= 1.2;
    }

    if (ccCount >= 2) {
      balanceScore += 1.8;
    } else if (ccCount === 1) {
      balanceScore += 1.1;
    }

    if (sustainCount >= 1) balanceScore += 0.8;

    const targetRoles = Math.min(heroCount, 4);
    if (roleSet.size >= targetRoles && targetRoles > 1) {
      balanceScore += 0.9;
    }

    // Penalize excessive fragile role stacking
    if (marksmanCount >= 3) balanceScore -= (marksmanCount - 2) * 1.5;
    if (mageCount >= 3) balanceScore -= (mageCount - 2) * 1.3;
    if (assassinCount >= 3) balanceScore -= (assassinCount - 2) * 1.3;

    balanceScore = roundTwo(clamp(balanceScore, 0, 10));
  }

  return {
    profile: {
      heroCount,
      averageWinRatePct,
      physicalCount,
      magicCount,
      tankFrontlineCount,
      sustainCount,
      ccCount,
      burstCount,
      synergyPairs,
      roleCoverage: Array.from(roleSet),
      balanceScore,
    },
    synergyPoints: roundTwo(synergyPoints),
  };
}

function resolveVerdict(winProbabilityPct: number, hasTeams: boolean): WinVerdict {
  if (!hasTeams) return 'Awaiting Draft';
  if (winProbabilityPct >= 62) return 'Strong Advantage';
  if (winProbabilityPct >= 54) return 'Favored';
  if (winProbabilityPct > 46) return 'Even Matchup';
  if (winProbabilityPct > 38) return 'Underdog';
  return 'Tough Matchup';
}

export function predictTeamWinProbability(opts: {
  allyHeroIds: number[];
  enemyHeroIds: number[];
  heroRanks: HeroRankRecord[];
  positionMap: Map<number, HeroMetadataSummary>;
  heroNameMap: Map<number, { name: string; head: string }>;
}): WinPredictionResult {
  const allyEntries = resolveHeroDraftEntries(
    opts.allyHeroIds,
    opts.heroRanks,
    opts.positionMap,
    opts.heroNameMap,
  );
  const enemyEntries = resolveHeroDraftEntries(
    opts.enemyHeroIds,
    opts.heroRanks,
    opts.positionMap,
    opts.heroNameMap,
  );

  const allyAnalysis = analyzeTeamEntries(allyEntries);
  const enemyAnalysis = analyzeTeamEntries(enemyEntries);

  const hasTeams = allyEntries.length > 0 || enemyEntries.length > 0;
  const isFullFiveVsFive = allyEntries.length === 5 && enemyEntries.length === 5;

  if (!hasTeams) {
    return {
      hasTeams: false,
      isFullFiveVsFive: false,
      winProbabilityPct: 50,
      opponentProbabilityPct: 50,
      verdict: 'Awaiting Draft',
      edgePct: 0,
      allyProfile: allyAnalysis.profile,
      enemyProfile: enemyAnalysis.profile,
      factors: [],
      matchupEdges: [],
      tacticalNotes: [
        'Select heroes for Your Team and Opponent Lineup to calculate live matchup win probability.',
      ],
    };
  }

  const bothSidesReady = allyEntries.length > 0 && enemyEntries.length > 0;

  // 1. Meta Win Rate Differential
  const allyWr = allyAnalysis.profile.averageWinRatePct ?? 50;
  const enemyWr = enemyAnalysis.profile.averageWinRatePct ?? 50;
  const wrDiff = roundTwo(allyWr - enemyWr);
  const metaLogit = wrDiff * 0.14;

  // 2. Direct Hero-to-Hero Counters & Tactical Profile Counters
  const matchupEdges: WinPredictionMatchupEdge[] = [];
  let allyCounterHits = 0;
  let enemyCounterHits = 0;

  for (const ally of allyEntries) {
    for (const enemy of enemyEntries) {
      const allyStrongVsEnemy =
        ally.strongIds.includes(enemy.heroId) || enemy.weakIds.includes(ally.heroId);
      const enemyStrongVsAlly =
        enemy.strongIds.includes(ally.heroId) || ally.weakIds.includes(enemy.heroId);

      if (allyStrongVsEnemy && !enemyStrongVsAlly) {
        allyCounterHits += 1;
        matchupEdges.push({
          allyHeroName: ally.name,
          enemyHeroName: enemy.name,
          favoredSide: 'ally',
          reason: `${ally.name} holds a direct kit advantage against ${enemy.name}.`,
        });
      } else if (enemyStrongVsAlly && !allyStrongVsEnemy) {
        enemyCounterHits += 1;
        matchupEdges.push({
          allyHeroName: ally.name,
          enemyHeroName: enemy.name,
          favoredSide: 'enemy',
          reason: `${enemy.name} pressures ${ally.name} in lane and skirmishes.`,
        });
      }
    }
  }

  // Symmetric tactical profile counters (CC vs Dive Burst; Tank Frontline vs Burst)
  let tacticalCounterDiff = 0;
  if (bothSidesReady) {
    const allyLockdownVsEnemyDive = Math.min(
      allyAnalysis.profile.ccCount,
      enemyAnalysis.profile.burstCount,
    );
    const enemyLockdownVsAllyDive = Math.min(
      enemyAnalysis.profile.ccCount,
      allyAnalysis.profile.burstCount,
    );
    tacticalCounterDiff += (allyLockdownVsEnemyDive - enemyLockdownVsAllyDive) * 0.5;

    const allyFrontlineVsEnemyBurst =
      allyAnalysis.profile.tankFrontlineCount > 0 && enemyAnalysis.profile.tankFrontlineCount === 0
        ? 0.6
        : enemyAnalysis.profile.tankFrontlineCount > 0 && allyAnalysis.profile.tankFrontlineCount === 0
          ? -0.6
          : 0;
    tacticalCounterDiff += allyFrontlineVsEnemyBurst;
  }

  const netCounterEdge = roundTwo(allyCounterHits - enemyCounterHits + tacticalCounterDiff);
  const counterLogit = bothSidesReady ? Math.tanh(netCounterEdge / 3.0) * 0.55 : 0;

  // 3. Team Synergy Differential (only applied head-to-head when both sides have picks)
  const synergyDiff = roundTwo(allyAnalysis.synergyPoints - enemyAnalysis.synergyPoints);
  const synergyLogit = bothSidesReady ? Math.tanh(synergyDiff / 3.5) * 0.42 : 0;

  // 4. Draft Balance Differential (only applied head-to-head when both sides have picks)
  const allyBal = allyEntries.length > 0 ? allyAnalysis.profile.balanceScore : 5.0;
  const enemyBal = enemyEntries.length > 0 ? enemyAnalysis.profile.balanceScore : 5.0;
  const balanceDiff = roundTwo(allyBal - enemyBal);
  const balanceLogit = bothSidesReady ? balanceDiff * 0.11 : 0;

  const totalLogit = metaLogit + counterLogit + synergyLogit + balanceLogit;
  const rawProb = 100 / (1 + Math.exp(-totalLogit));
  const winProbabilityPct = clamp(roundTwo(rawProb), 5, 95);
  const opponentProbabilityPct = roundTwo(100 - winProbabilityPct);
  const edgePct = roundTwo(winProbabilityPct - 50);

  const verdict: WinVerdict = !bothSidesReady
    ? allyEntries.length > 0
      ? 'Pick Opponent'
      : 'Pick Your Team'
    : resolveVerdict(winProbabilityPct, hasTeams);

  const factors: WinPredictionFactor[] = [
    {
      id: 'meta',
      label: 'Hero Meta Win Rate',
      allyDisplay:
        allyAnalysis.profile.averageWinRatePct !== null
          ? `${allyAnalysis.profile.averageWinRatePct.toFixed(2)}%`
          : '50.00% est',
      enemyDisplay:
        enemyAnalysis.profile.averageWinRatePct !== null
          ? `${enemyAnalysis.profile.averageWinRatePct.toFixed(2)}%`
          : '50.00% est',
      edgePoints: wrDiff,
      summary:
        Math.abs(wrDiff) < 0.35
          ? 'Both lineups hold virtually identical ranked meta win rates.'
          : wrDiff > 0
            ? `Your heroes average +${wrDiff.toFixed(2)}% higher ranked win rate.`
            : `Opponent heroes average +${Math.abs(wrDiff).toFixed(2)}% higher ranked win rate.`,
    },
    {
      id: 'counters',
      label: 'Direct Matchup Counters',
      allyDisplay: `${allyCounterHits} counter${allyCounterHits === 1 ? '' : 's'}`,
      enemyDisplay: `${enemyCounterHits} counter${enemyCounterHits === 1 ? '' : 's'}`,
      edgePoints: netCounterEdge,
      summary:
        allyCounterHits === enemyCounterHits
          ? 'Balanced head-to-head counter pressure across lanes.'
          : allyCounterHits > enemyCounterHits
            ? `Your draft holds ${allyCounterHits} favorable kit counter${allyCounterHits === 1 ? '' : 's'} against enemy picks.`
            : `Opponent draft holds ${enemyCounterHits} direct counter${enemyCounterHits === 1 ? '' : 's'} into your lineup.`,
    },
    {
      id: 'synergy',
      label: 'Allied Kit Synergy',
      allyDisplay: `${allyAnalysis.profile.synergyPairs.length} duo link${allyAnalysis.profile.synergyPairs.length === 1 ? '' : 's'}`,
      enemyDisplay: `${enemyAnalysis.profile.synergyPairs.length} duo link${enemyAnalysis.profile.synergyPairs.length === 1 ? '' : 's'}`,
      edgePoints: synergyDiff,
      summary:
        allyAnalysis.profile.synergyPairs.length > enemyAnalysis.profile.synergyPairs.length
          ? `Stronger combo cohesion (${allyAnalysis.profile.synergyPairs.map((p) => `${p.heroA} + ${p.heroB}`).slice(0, 2).join(', ')}).`
          : enemyAnalysis.profile.synergyPairs.length > allyAnalysis.profile.synergyPairs.length
            ? `Opponent carries stronger assist combos (${enemyAnalysis.profile.synergyPairs.map((p) => `${p.heroA} + ${p.heroB}`).slice(0, 2).join(', ')}).`
            : 'Even allied synergy and engage follow-up potential.',
    },
    {
      id: 'balance',
      label: 'Draft Balance & Damage Split',
      allyDisplay: `${allyBal.toFixed(1)} / 10`,
      enemyDisplay: `${enemyBal.toFixed(1)} / 10`,
      edgePoints: balanceDiff,
      summary:
        Math.abs(balanceDiff) < 0.5
          ? 'Comparable frontline, crowd control, and damage diversity.'
          : balanceDiff > 0
            ? 'Better mixed damage, frontline peel, and crowd-control coverage.'
            : 'Opponent holds cleaner role balance or frontline protection.',
    },
  ];

  const tacticalNotes: string[] = [];
  if (allyEntries.length === 0 || enemyEntries.length === 0) {
    tacticalNotes.push(
      allyEntries.length === 0
        ? 'Your Team has no heroes yet — select heroes to evaluate against this opponent lineup.'
        : 'Opponent Lineup is empty — add enemy heroes to compute head-to-head counters.',
    );
  }
  if (allyEntries.length >= 2 && allyAnalysis.profile.tankFrontlineCount === 0) {
    tacticalNotes.push(
      'Your Team lacks a dedicated frontline tank — skirmishes will depend on flank timing and vision.',
    );
  }
  if (
    allyEntries.length >= 3 &&
    (allyAnalysis.profile.physicalCount === 0 || allyAnalysis.profile.magicCount === 0)
  ) {
    tacticalNotes.push(
      allyAnalysis.profile.magicCount === 0
        ? 'Your Team deals mostly Physical damage — enemies can stack Antique Cuirass / Dominance Ice efficiently.'
        : 'Your Team deals mostly Magic damage — watch for early Radiant Armor & Athena’s Shield.',
    );
  }
  if (enemyAnalysis.profile.sustainCount >= 1) {
    tacticalNotes.push(
      'Opponent has heavy heal/sustain — prioritize early Sea Halberd, Glowing Wand, or Dominance Ice.',
    );
  }
  if (allyAnalysis.profile.synergyPairs.length > 0) {
    const firstPair = allyAnalysis.profile.synergyPairs[0];
    tacticalNotes.push(
      `Look to group ${firstPair.heroA} and ${firstPair.heroB} around Turtle and Lord fights for peak combo synergy.`,
    );
  }
  if (tacticalNotes.length === 0) {
    tacticalNotes.push(
      winProbabilityPct >= 52
        ? 'Press your composition’s mid-game objective timing while protecting lane waves.'
        : 'Play around power spikes and avoid forced river fights before key ultimate cooldowns align.',
    );
  }

  return {
    hasTeams,
    isFullFiveVsFive,
    winProbabilityPct,
    opponentProbabilityPct,
    verdict,
    edgePct,
    allyProfile: allyAnalysis.profile,
    enemyProfile: enemyAnalysis.profile,
    factors,
    matchupEdges: matchupEdges.slice(0, 6),
    tacticalNotes: tacticalNotes.slice(0, 4),
  };
}
