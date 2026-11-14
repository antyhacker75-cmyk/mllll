import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Bookmark,
  Check,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import type {
  FavoriteHeroLineup,
  HeroRankRecord,
  RoleFilter,
} from '../types/mlbb';
import { MAX_LINEUP_SIZE } from '../utils/favoriteLineup';
import type { HeroMetadataSummary } from '../utils/mlbb';
import { predictTeamWinProbability } from '../utils/winPredictor';
import { SafeImage } from './SafeImage';
import { WinProbabilityGauge } from './WinProbabilityGauge';
import { WinRateCalculatorView } from './WinRateCalculatorView';

interface WinPredictorViewProps {
  allyHeroIds: Array<number | null>;
  enemyHeroIds: Array<number | null>;
  onChangeAllyHeroIds: (next: Array<number | null>) => void;
  onChangeEnemyHeroIds: (next: Array<number | null>) => void;
  savedLineups: FavoriteHeroLineup[];
  heroRanks: HeroRankRecord[];
  heroRanksLoading: boolean;
  positionMap: Map<number, HeroMetadataSummary>;
  heroNameMap: Map<number, { name: string; head: string }>;
  onOpenHero: (heroId: number) => void;
}

type PredictorMode = 'predictor' | 'streak';
type PickerTarget = { side: 'ally' | 'enemy'; index: number };

const ROLE_FILTERS: Array<{ id: RoleFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tank', label: 'Tank' },
  { id: 'fighter', label: 'Fighter' },
  { id: 'assassin', label: 'Assassin' },
  { id: 'mage', label: 'Mage' },
  { id: 'marksman', label: 'Marksman' },
  { id: 'support', label: 'Support' },
];

export function WinPredictorView({
  allyHeroIds,
  enemyHeroIds,
  onChangeAllyHeroIds,
  onChangeEnemyHeroIds,
  savedLineups,
  heroRanks,
  heroRanksLoading,
  positionMap,
  heroNameMap,
  onOpenHero,
}: WinPredictorViewProps) {
  const [mode, setMode] = useState<PredictorMode>('predictor');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerRole, setPickerRole] = useState<RoleFilter>('all');

  const rankById = useMemo(() => {
    const map = new Map<number, HeroRankRecord>();
    for (const rec of heroRanks) {
      if (rec.data?.main_heroid) {
        map.set(rec.data.main_heroid, rec);
      }
    }
    return map;
  }, [heroRanks]);

  const roster = useMemo(() => {
    const list: Array<{
      id: number;
      name: string;
      head: string;
      roles: string[];
      winRatePct: number | null;
    }> = [];
    const seen = new Set<number>();

    for (const rec of heroRanks) {
      const id = rec.data.main_heroid;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const pos = positionMap.get(id);
      const wr = rec.data.main_hero_win_rate;
      list.push({
        id,
        name: rec.data.main_hero?.data?.name || `Hero #${id}`,
        head: rec.data.main_hero?.data?.head || pos?.smallmap || '',
        roles: pos?.roles || [],
        winRatePct: Number.isFinite(wr) && wr > 0 ? Math.round(wr * 10000) / 100 : null,
      });
    }

    for (const [id, info] of heroNameMap.entries()) {
      if (seen.has(id)) continue;
      seen.add(id);
      const pos = positionMap.get(id);
      list.push({
        id,
        name: info.name,
        head: info.head || pos?.smallmap || '',
        roles: pos?.roles || [],
        winRatePct: null,
      });
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [heroRanks, heroNameMap, positionMap]);

  const pickedIds = useMemo(() => {
    const set = new Set<number>();
    for (const id of allyHeroIds) if (id) set.add(id);
    for (const id of enemyHeroIds) if (id) set.add(id);
    return set;
  }, [allyHeroIds, enemyHeroIds]);

  const filteredRoster = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return roster.filter((h) => {
      if (q && !h.name.toLowerCase().includes(q) && String(h.id) !== q) {
        return false;
      }
      if (pickerRole !== 'all' && !h.roles.some((r) => r.includes(pickerRole))) {
        return false;
      }
      return true;
    });
  }, [roster, pickerQuery, pickerRole]);

  const activeAllies = useMemo(
    () => allyHeroIds.filter((id): id is number => id !== null),
    [allyHeroIds],
  );
  const activeEnemies = useMemo(
    () => enemyHeroIds.filter((id): id is number => id !== null),
    [enemyHeroIds],
  );

  const prediction = useMemo(
    () =>
      predictTeamWinProbability({
        allyHeroIds: activeAllies,
        enemyHeroIds: activeEnemies,
        heroRanks,
        positionMap,
        heroNameMap,
      }),
    [activeAllies, activeEnemies, heroRanks, positionMap, heroNameMap],
  );

  function findHeroIdByName(name: string): number | null {
    const match = roster.find((h) => h.name.toLowerCase() === name.toLowerCase());
    return match ? match.id : null;
  }

  function handleLoadSampleMatchup() {
    const sampleAllies = [
      findHeroIdByName('Khufra'),
      findHeroIdByName('Ling'),
      findHeroIdByName('Xavier'),
      findHeroIdByName('Beatrix'),
      findHeroIdByName('Yu Zhong'),
    ];
    const sampleEnemies = [
      findHeroIdByName('Gloo'),
      findHeroIdByName('Hayabusa'),
      findHeroIdByName('Yve'),
      findHeroIdByName('Layla'),
      findHeroIdByName('Estes'),
    ];

    // Fallback to top roster heroes if API hasn't returned named entries yet
    const fallbackAllies = sampleAllies.every((id) => id !== null)
      ? sampleAllies
      : roster.slice(0, 5).map((r) => r.id);
    const fallbackEnemies = sampleEnemies.every((id) => id !== null)
      ? sampleEnemies
      : roster.slice(5, 10).map((r) => r.id);

    onChangeAllyHeroIds([
      fallbackAllies[0] ?? null,
      fallbackAllies[1] ?? null,
      fallbackAllies[2] ?? null,
      fallbackAllies[3] ?? null,
      fallbackAllies[4] ?? null,
    ]);
    onChangeEnemyHeroIds([
      fallbackEnemies[0] ?? null,
      fallbackEnemies[1] ?? null,
      fallbackEnemies[2] ?? null,
      fallbackEnemies[3] ?? null,
      fallbackEnemies[4] ?? null,
    ]);
  }

  function handleSwapSides() {
    const prevAllies = [...allyHeroIds];
    const prevEnemies = [...enemyHeroIds];
    onChangeAllyHeroIds(prevEnemies);
    onChangeEnemyHeroIds(prevAllies);
  }

  function handleClearAll() {
    onChangeAllyHeroIds([null, null, null, null, null]);
    onChangeEnemyHeroIds([null, null, null, null, null]);
  }

  function handleApplySavedLineup(lineupId: string) {
    const found = savedLineups.find((l) => l.id === lineupId);
    if (!found) return;
    const padded: Array<number | null> = [null, null, null, null, null];
    for (let i = 0; i < MAX_LINEUP_SIZE; i++) {
      const candidate = found.heroIds[i] ?? null;
      // Avoid picking a hero already in enemy lineup
      if (candidate && !enemyHeroIds.includes(candidate)) {
        padded[i] = candidate;
      }
    }
    onChangeAllyHeroIds(padded);
  }

  function handlePickHero(heroId: number) {
    if (!pickerTarget) return;
    if (pickerTarget.side === 'ally') {
      const next = [...allyHeroIds];
      next[pickerTarget.index] = heroId;
      onChangeAllyHeroIds(next);
    } else {
      const next = [...enemyHeroIds];
      next[pickerTarget.index] = heroId;
      onChangeEnemyHeroIds(next);
    }
    setPickerTarget(null);
    setPickerQuery('');
    setPickerRole('all');
  }

  function renderTeamSlot(
    heroId: number | null,
    side: 'ally' | 'enemy',
    index: number,
  ) {
    const info = heroId ? heroNameMap.get(heroId) : undefined;
    const pos = heroId ? positionMap.get(heroId) : undefined;
    const rankRec = heroId ? rankById.get(heroId) : undefined;
    const wrPct =
      rankRec && Number.isFinite(rankRec.data.main_hero_win_rate)
        ? rankRec.data.main_hero_win_rate * 100
        : null;
    const slotLabel = side === 'ally' ? `Ally Slot ${index + 1}` : `Opponent Slot ${index + 1}`;

    return (
      <div
        key={`${side}-${index}`}
        className="py-2.5 flex items-center justify-between gap-2.5"
      >
        {heroId && info ? (
          <>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setPickerTarget({ side, index })}
                aria-label={`Change ${slotLabel}: ${info.name}`}
                className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
              >
                <SafeImage
                  src={info.head || pos?.smallmap}
                  alt={info.name}
                  fallbackText={info.name}
                  size="sm"
                  className="w-10 h-10 rounded-lg border border-slate-700"
                />
              </button>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenHero(heroId)}
                  className="text-sm font-medium text-slate-100 hover:text-amber-300 transition-colors truncate block text-left cursor-pointer"
                >
                  {info.name}
                </button>
                <div className="text-[11px] text-slate-400 capitalize truncate">
                  {[pos?.roles?.[0] || 'Flex', pos?.lanes?.[0] || null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span
                className={`font-mono tabular-nums text-xs font-semibold ${
                  wrPct === null
                    ? 'text-slate-400'
                    : wrPct >= 50
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                }`}
              >
                {wrPct !== null ? `${wrPct.toFixed(1)}%` : '—'}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (side === 'ally') {
                    const next = [...allyHeroIds];
                    next[index] = null;
                    onChangeAllyHeroIds(next);
                  } else {
                    const next = [...enemyHeroIds];
                    next[index] = null;
                    onChangeEnemyHeroIds(next);
                  }
                }}
                aria-label={`Remove ${info.name} from ${side === 'ally' ? 'Your Team' : 'Opponent Lineup'}`}
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPickerTarget({ side, index })}
            aria-label={`Select hero for ${slotLabel}`}
            className="w-full flex items-center gap-3 text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg py-0.5"
          >
            <span className="w-10 h-10 rounded-lg border border-dashed border-slate-700/90 bg-[#0B0F17]/70 group-hover:border-amber-400/70 flex items-center justify-center shrink-0 transition-colors">
              <Plus className="w-4 h-4 text-slate-500 group-hover:text-amber-300" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-300 group-hover:text-slate-100 transition-colors">
                {slotLabel}
              </div>
              <div className="text-[11px] text-slate-500">
                Click to pick hero
              </div>
            </div>
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-6" data-testid="win-predictor-view">
      {/* Header + Sub-mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 [text-wrap:balance]">
            {mode === 'predictor'
              ? 'Team Matchup Win Probability Predictor'
              : 'Target Win-Rate Streak Calculator'}
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            {mode === 'predictor'
              ? 'Compare your selected team composition against an opponent lineup using live Rone Arena win rates, direct hero counters, kit synergy, and role balance.'
              : 'Calculate how many consecutive wins without a loss are required to reach your target hero or account win rate.'}
          </p>
        </div>

        <div
          role="group"
          aria-label="Calculator tool mode"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-slate-800 self-start lg:self-auto shrink-0"
        >
          <button
            type="button"
            onClick={() => setMode('predictor')}
            aria-pressed={mode === 'predictor'}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'predictor'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
            }`}
          >
            Team Win Predictor
          </button>
          <button
            type="button"
            onClick={() => setMode('streak')}
            aria-pressed={mode === 'streak'}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'streak'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
            }`}
          >
            Streak WR Calculator
          </button>
        </div>
      </div>

      {mode === 'streak' ? (
        <WinRateCalculatorView />
      ) : (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleLoadSampleMatchup}
                disabled={heroRanksLoading && roster.length === 0}
                className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Load Sample 5v5 Matchup
              </button>

              <button
                type="button"
                onClick={handleSwapSides}
                disabled={!prediction.hasTeams}
                className="px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                Swap Sides
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                disabled={!prediction.hasTeams}
                className="px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Clear
              </button>
            </div>

            {savedLineups.length > 0 && (
              <div className="flex items-center gap-2">
                <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                <label htmlFor="saved-lineup-import" className="text-xs text-slate-400 whitespace-nowrap">
                  Load Saved Team:
                </label>
                <select
                  id="saved-lineup-import"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleApplySavedLineup(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-[#111827] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="" disabled>
                    Choose saved lineup...
                  </option>
                  {savedLineups.map((lineup) => (
                    <option key={lineup.id} value={lineup.id}>
                      {lineup.name} ({lineup.heroIds.length} heroes)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Main 3-Column Draft & Gauge Arena (Single-Elevation Workspace) */}
          <div className="rounded-xl border border-slate-800/90 bg-[#111827] grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-slate-800/80">
            {/* Left: Your Team (5 Slots) */}
            <div className="xl:col-span-4 p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-slate-100">
                    Your Team
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-amber-300">
                    {activeAllies.length} / {MAX_LINEUP_SIZE} heroes
                  </span>
                </div>

                <div
                  className="divide-y divide-slate-800/70 border-y border-slate-800/70"
                  data-testid="predictor-ally-slots"
                >
                  {allyHeroIds.map((heroId, idx) => renderTeamSlot(heroId, 'ally', idx))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <div className="text-[11px] text-slate-400">Avg WR</div>
                  <div className="font-mono tabular-nums text-sm font-semibold text-slate-100 mt-0.5">
                    {prediction.allyProfile.averageWinRatePct !== null
                      ? `${prediction.allyProfile.averageWinRatePct.toFixed(2)}%`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Damage Split</div>
                  <div className="font-mono tabular-nums text-sm text-slate-200 mt-0.5">
                    {prediction.allyProfile.physicalCount}P · {prediction.allyProfile.magicCount}M
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Balance</div>
                  <div className="font-mono tabular-nums text-sm font-semibold text-slate-100 mt-0.5">
                    {activeAllies.length > 0
                      ? `${prediction.allyProfile.balanceScore.toFixed(1)} / 10`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Win Probability Gauge (placed first on mobile for immediate visibility) */}
            <div className="order-first xl:order-none xl:col-span-4 p-5 sm:p-6 bg-[#0E1420]/70 flex flex-col justify-between gap-5">
              <WinProbabilityGauge
                winProbabilityPct={prediction.winProbabilityPct}
                opponentProbabilityPct={prediction.opponentProbabilityPct}
                verdict={prediction.verdict}
                edgePct={prediction.edgePct}
                hasTeams={prediction.hasTeams}
                allyCount={activeAllies.length}
                enemyCount={activeEnemies.length}
              />

              {prediction.hasTeams ? (
                <div className="space-y-2 pt-3 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Draft Completeness</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {prediction.isFullFiveVsFive
                        ? 'Full 5v5 Lineup'
                        : `Partial (${activeAllies.length}v${activeEnemies.length})`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Direct Counters Found</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {prediction.matchupEdges.length} interaction{prediction.matchupEdges.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center pt-2 border-t border-slate-800/80">
                  Pick heroes on both sides or load the sample 5v5 draft to compute live win probability.
                </p>
              )}
            </div>

            {/* Right: Opponent Lineup (5 Slots) */}
            <div className="xl:col-span-4 p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-slate-100">
                    Opponent Lineup
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-rose-300">
                    {activeEnemies.length} / {MAX_LINEUP_SIZE} heroes
                  </span>
                </div>

                <div
                  className="divide-y divide-slate-800/70 border-y border-slate-800/70"
                  data-testid="predictor-enemy-slots"
                >
                  {enemyHeroIds.map((heroId, idx) => renderTeamSlot(heroId, 'enemy', idx))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <div className="text-[11px] text-slate-400">Avg WR</div>
                  <div className="font-mono tabular-nums text-sm font-semibold text-slate-100 mt-0.5">
                    {prediction.enemyProfile.averageWinRatePct !== null
                      ? `${prediction.enemyProfile.averageWinRatePct.toFixed(2)}%`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Damage Split</div>
                  <div className="font-mono tabular-nums text-sm text-slate-200 mt-0.5">
                    {prediction.enemyProfile.physicalCount}P · {prediction.enemyProfile.magicCount}M
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Balance</div>
                  <div className="font-mono tabular-nums text-sm font-semibold text-slate-100 mt-0.5">
                    {activeEnemies.length > 0
                      ? `${prediction.enemyProfile.balanceScore.toFixed(1)} / 10`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Factor Breakdown & Tactical Matchup Notes */}
          {prediction.hasTeams && (
            <div className="rounded-xl border border-slate-800/90 bg-[#111827] grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
              {/* Prediction Factor Drivers */}
              <div className="lg:col-span-7 p-5 sm:p-6 space-y-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-slate-100">
                    Probability Drivers
                  </h2>
                  <span className="text-xs text-slate-400">
                    Your Team vs Opponent
                  </span>
                </div>

                <div className="divide-y divide-slate-800/70 border-t border-slate-800/70">
                  {prediction.factors.map((factor) => {
                    const edgeColor =
                      factor.edgePoints > 0.25
                        ? 'text-emerald-400'
                        : factor.edgePoints < -0.25
                          ? 'text-rose-400'
                          : 'text-amber-300';

                    return (
                      <div key={factor.id} className="py-3.5 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-100">
                            {factor.label}
                          </span>
                          <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                            <span className={edgeColor}>{factor.allyDisplay}</span>
                            <span className="text-slate-600">vs</span>
                            <span className="text-slate-300">{factor.enemyDisplay}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {factor.summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Direct Matchup Edges & Tactical Win Conditions */}
              <div className="lg:col-span-5 p-5 sm:p-6 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    <h2 className="font-display text-base font-semibold text-slate-100">
                      Key Draft Interactions
                    </h2>
                  </div>

                  {prediction.matchupEdges.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No direct 1v1 hard-counter flags between selected heroes — match outcome hinges on role balance and teamfight execution.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-800/70 border-t border-slate-800/70">
                      {prediction.matchupEdges.map((edge, idx) => (
                        <li key={idx} className="py-2.5 text-xs flex items-start justify-between gap-3">
                          <span className="text-slate-300 leading-relaxed">
                            {edge.reason}
                          </span>
                          <span
                            className={`font-medium whitespace-nowrap shrink-0 ${
                              edge.favoredSide === 'ally' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {edge.favoredSide === 'ally' ? 'Advantage' : 'Threat'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2.5 pt-4 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    <h3 className="font-display text-sm font-semibold text-slate-100">
                      Tactical Win Conditions
                    </h3>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                    {prediction.tacticalNotes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-slate-500" aria-hidden="true">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hero Picker Modal */}
      {pickerTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Select hero for prediction slot"
          onClick={() => setPickerTarget(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0D131E] overflow-hidden flex flex-col max-h-[82vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-100">
                  Select {pickerTarget.side === 'ally' ? 'Your Team' : 'Opponent'} Hero
                </h2>
                <p className="text-xs text-slate-400">
                  Slot {pickerTarget.index + 1} · Choose from {roster.length} Mobile Legends heroes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerTarget(null)}
                aria-label="Close hero selector"
                className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 space-y-3">
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  autoFocus
                  aria-label="Search hero to pick"
                  placeholder="Search hero name..."
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter heroes by role">
                {ROLE_FILTERS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPickerRole(r.id)}
                    aria-pressed={pickerRole === r.id}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      pickerRole === r.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {filteredRoster.map((hero) => {
                const alreadyPicked = pickedIds.has(hero.id);
                return (
                  <button
                    key={hero.id}
                    type="button"
                    disabled={alreadyPicked}
                    onClick={() => handlePickHero(hero.id)}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2.5 transition-colors ${
                      alreadyPicked
                        ? 'border-slate-800/50 bg-slate-900/40 opacity-45 cursor-not-allowed'
                        : 'border-slate-800 bg-[#111827] hover:border-amber-400/70 hover:bg-slate-800/70 cursor-pointer'
                    }`}
                  >
                    <SafeImage
                      src={hero.head}
                      alt={hero.name}
                      fallbackText={hero.name}
                      size="sm"
                      className="w-9 h-9 rounded-md shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-100 truncate">
                        {hero.name}
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                        <span className="capitalize truncate">{hero.roles[0] || 'Hero'}</span>
                        {hero.winRatePct !== null && (
                          <span className="font-mono tabular-nums text-slate-300 shrink-0">
                            {hero.winRatePct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {alreadyPicked && (
                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
