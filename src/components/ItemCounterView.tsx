import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, RotateCcw, Search, ShieldAlert, Sparkles, Swords, Users, X } from 'lucide-react';
import { fetchHeroCompatibility } from '../services/roneApi';
import type {
  EquipmentRecord,
  HeroRankRecord,
  RecommendationCategory,
  RoleFilter,
} from '../types/mlbb';
import { buildTeamComboRecommendations } from '../utils/comboEngine';
import { analyzeDraftAndRecommendItems } from '../utils/counterEngine';
import type { HeroMetadataSummary } from '../utils/mlbb';
import { SafeImage } from './SafeImage';

interface ItemCounterViewProps {
  heroRanks: HeroRankRecord[];
  positionMap: Map<number, HeroMetadataSummary>;
  heroNameMap: Map<number, { name: string; head: string }>;
  equipmentList: EquipmentRecord[];
  equipmentLoading: boolean;
}

type SlotTarget =
  | { team: 'me' }
  | { team: 'ally'; index: number }
  | { team: 'enemy'; index: number };

const CATEGORY_TABS: Array<{ id: 'all' | RecommendationCategory; label: string }> = [
  { id: 'all', label: 'All Recommendations' },
  { id: 'counter', label: 'Anti-Heal & Counter' },
  { id: 'sustain', label: 'Sustain' },
  { id: 'damage', label: 'Damage' },
  { id: 'defense', label: 'Defense' },
];

const PICKER_ROLES: Array<{ id: RoleFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tank', label: 'Tank' },
  { id: 'fighter', label: 'Fighter' },
  { id: 'assassin', label: 'Assassin' },
  { id: 'mage', label: 'Mage' },
  { id: 'marksman', label: 'Marksman' },
  { id: 'support', label: 'Support' },
];

export function ItemCounterView({
  heroRanks,
  positionMap,
  heroNameMap,
  equipmentList,
  equipmentLoading,
}: ItemCounterViewProps) {
  const [myHeroId, setMyHeroId] = useState<number | null>(null);
  const [allyHeroIds, setAllyHeroIds] = useState<Array<number | null>>([null, null, null, null]);
  const [enemyHeroIds, setEnemyHeroIds] = useState<Array<number | null>>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const [activeCategory, setActiveCategory] = useState<'all' | RecommendationCategory>('all');
  const [pickerTarget, setPickerTarget] = useState<SlotTarget | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerRole, setPickerRole] = useState<RoleFilter>('all');
  const [compatRecord, setCompatRecord] = useState<HeroRankRecord | null>(null);
  const [compatLoading, setCompatLoading] = useState(false);
  const compatCacheRef = useRef<Map<number, HeroRankRecord | null>>(new Map());

  // Build unified sortable roster from heroNameMap + positionMap
  const roster = useMemo(() => {
    const list: Array<{ id: number; name: string; head: string; roles: string[] }> = [];
    for (const [id, info] of heroNameMap.entries()) {
      const pos = positionMap.get(id);
      list.push({
        id,
        name: info.name,
        head: info.head,
        roles: pos?.roles || [],
      });
    }
    if (list.length === 0) {
      for (const rec of heroRanks) {
        const id = rec.data.main_heroid;
        list.push({
          id,
          name: rec.data.main_hero?.data?.name || `Hero #${id}`,
          head: rec.data.main_hero?.data?.head || '',
          roles: positionMap.get(id)?.roles || [],
        });
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [heroNameMap, heroRanks, positionMap]);

  const pickedIds = useMemo(() => {
    const set = new Set<number>();
    if (myHeroId) set.add(myHeroId);
    for (const id of allyHeroIds) if (id) set.add(id);
    for (const id of enemyHeroIds) if (id) set.add(id);
    return set;
  }, [myHeroId, allyHeroIds, enemyHeroIds]);

  const filteredRoster = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return roster.filter((h) => {
      if (q && !h.name.toLowerCase().includes(q)) return false;
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

  const analysis = useMemo(
    () =>
      analyzeDraftAndRecommendItems({
        myHeroId,
        allyHeroIds: activeAllies,
        enemyHeroIds: activeEnemies,
        positionMap,
        heroNameMap,
        equipmentList,
      }),
    [myHeroId, activeAllies, activeEnemies, positionMap, heroNameMap, equipmentList],
  );

  const visibleRecommendations = useMemo(() => {
    if (activeCategory === 'all') return analysis.recommendations;
    return analysis.recommendations.filter((r) => r.category === activeCategory);
  }, [analysis.recommendations, activeCategory]);

  useEffect(() => {
    if (!myHeroId) {
      setCompatRecord(null);
      setCompatLoading(false);
      return;
    }

    if (compatCacheRef.current.has(myHeroId)) {
      setCompatRecord(compatCacheRef.current.get(myHeroId) ?? null);
      setCompatLoading(false);
      return;
    }

    let cancelled = false;
    setCompatLoading(true);
    fetchHeroCompatibility(myHeroId)
      .then((rec) => {
        compatCacheRef.current.set(myHeroId, rec);
        if (!cancelled) {
          setCompatRecord(rec);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompatRecord(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompatLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [myHeroId]);

  const teamCombos = useMemo(
    () =>
      buildTeamComboRecommendations({
        myHeroId,
        allyHeroIds: activeAllies,
        compatRecord,
        heroNameMap,
        positionMap,
        limit: 4,
      }),
    [myHeroId, activeAllies, compatRecord, heroNameMap, positionMap],
  );

  const hasOpenAllySlot = allyHeroIds.some((id) => id === null);

  function handleAddRecommendedAlly(partnerHeroId: number) {
    setAllyHeroIds((prev) => {
      if (prev.includes(partnerHeroId)) return prev;
      const openIdx = prev.findIndex((id) => id === null);
      if (openIdx === -1) return prev;
      const next = [...prev];
      next[openIdx] = partnerHeroId;
      return next;
    });
  }

  function findHeroIdByName(name: string): number | null {
    const match = roster.find((h) => h.name.toLowerCase() === name.toLowerCase());
    return match ? match.id : null;
  }

  function handleLoadSampleDraft() {
    setMyHeroId(findHeroIdByName('Miya') ?? roster[0]?.id ?? null);
    setAllyHeroIds([
      findHeroIdByName('Tigreal'),
      findHeroIdByName('Angela'),
      findHeroIdByName('Cecilion'),
      findHeroIdByName('Yu Zhong'),
    ]);
    setEnemyHeroIds([
      findHeroIdByName('Estes'),
      findHeroIdByName('Eudora'),
      findHeroIdByName('Gloo'),
      findHeroIdByName('Hayabusa'),
      findHeroIdByName('Layla'),
    ]);
    setActiveCategory('all');
  }

  function handleClearDraft() {
    setMyHeroId(null);
    setAllyHeroIds([null, null, null, null]);
    setEnemyHeroIds([null, null, null, null, null]);
    setActiveCategory('all');
  }

  function handlePickHero(heroId: number) {
    if (!pickerTarget) return;
    if (pickerTarget.team === 'me') {
      setMyHeroId(heroId);
    } else if (pickerTarget.team === 'ally') {
      setAllyHeroIds((prev) => {
        const next = [...prev];
        next[pickerTarget.index] = heroId;
        return next;
      });
    } else {
      setEnemyHeroIds((prev) => {
        const next = [...prev];
        next[pickerTarget.index] = heroId;
        return next;
      });
    }
    setPickerTarget(null);
    setPickerQuery('');
    setPickerRole('all');
  }

  function renderHeroSlot(
    heroId: number | null,
    label: string,
    target: SlotTarget,
    onClear: () => void,
    tone: 'gold' | 'ally' | 'enemy',
  ) {
    const info = heroId ? heroNameMap.get(heroId) : undefined;
    const pos = heroId ? positionMap.get(heroId) : undefined;
    const borderClass =
      tone === 'gold'
        ? 'border-amber-500/70 bg-amber-500/5'
        : tone === 'enemy'
          ? 'border-rose-900/70 bg-[#111827]'
          : 'border-slate-800 bg-[#111827]';

    return (
      <div className={`relative rounded-xl border p-3 flex items-center gap-3 ${borderClass}`}>
        <button
          type="button"
          onClick={() => setPickerTarget(target)}
          aria-label={info ? `Change ${label}: ${info.name}` : `Select ${label}`}
          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
        >
          {info ? (
            <SafeImage
              src={info.head}
              alt={info.name}
              fallbackText={info.name}
              size="sm"
              className="w-10 h-10 rounded-lg"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg border border-dashed border-slate-700 bg-[#0B0F17] flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-slate-500" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-slate-400">{label}</div>
            <div className="text-sm font-medium text-slate-100 truncate">
              {info ? info.name : 'Select Hero'}
            </div>
            {pos?.roles?.length ? (
              <div className="text-[11px] text-slate-400 capitalize truncate">
                {pos.roles.join(' / ')}
              </div>
            ) : null}
          </div>
        </button>

        {heroId !== null && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remove ${info?.name || label}`}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  const hasDraft = Boolean(myHeroId || activeAllies.length > 0 || activeEnemies.length > 0);

  return (
    <section className="space-y-8" data-testid="item-counter-view">
      {/* Header & Sample / Clear Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            5v5 Draft Counter & Build Recommender
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Select your hero, up to 4 allied teammates, and 5 enemy heroes to generate live MLBB counter-items across Sustain, Damage, and Defense.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleLoadSampleDraft}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Load Sample 5v5 Draft
          </button>
          {hasDraft && (
            <button
              type="button"
              onClick={handleClearDraft}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Draft
            </button>
          )}
        </div>
      </div>

      {/* Draft Composition Grid: Your Hero + 4 Allies vs 5 Enemies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Your Hero + 4 Allied Heroes */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800/90 bg-[#0F1521] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-100">
              Your Team ({(myHeroId ? 1 : 0) + activeAllies.length}/5)
            </h2>
            <span className="text-xs text-slate-400">Your Hero + 4 Allies</span>
          </div>

          <div className="space-y-3">
            {renderHeroSlot(
              myHeroId,
              'Your Hero',
              { team: 'me' },
              () => setMyHeroId(null),
              'gold',
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allyHeroIds.map((id, idx) =>
                <div key={`ally-${idx}`}>
                  {renderHeroSlot(
                    id,
                    `Ally ${idx + 1}`,
                    { team: 'ally', index: idx },
                    () =>
                      setAllyHeroIds((prev) => {
                        const next = [...prev];
                        next[idx] = null;
                        return next;
                      }),
                    'ally',
                  )}
                </div>,
              )}
            </div>
          </div>
        </div>

        {/* Right: 5 Enemy Heroes */}
        <div className="lg:col-span-6 rounded-xl border border-rose-950/70 bg-[#0F1521] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-100">
              Enemy Team ({activeEnemies.length}/5)
            </h2>
            <span className="text-xs text-rose-300/90">Counter Targets</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {enemyHeroIds.map((id, idx) =>
              <div key={`enemy-${idx}`} className={idx === 4 ? 'sm:col-span-2' : ''}>
                {renderHeroSlot(
                  id,
                  `Enemy ${idx + 1}`,
                  { team: 'enemy', index: idx },
                  () =>
                    setEnemyHeroIds((prev) => {
                      const next = [...prev];
                      next[idx] = null;
                      return next;
                    }),
                  'enemy',
                )}
              </div>,
            )}
          </div>
        </div>
      </div>

      {/* Matchup Threat Summary & Recommendations */}
      {!hasDraft ? (
        <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-10 text-center space-y-3">
          <Swords className="w-7 h-7 text-amber-400 mx-auto" />
          <h3 className="font-display text-lg font-semibold text-slate-100">
            Select heroes above to generate counter-item recommendations
          </h3>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Pick your hero, your allied team, and up to 5 enemy threats to see targeted Anti-Heal, Sustain, Damage, and Defense items backed by Rone Arena equipment data.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Threat Breakdown Strip */}
          <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-slate-400">Enemy Damage Split</div>
                <div className="font-mono tabular-nums text-base font-semibold text-slate-100 mt-0.5">
                  {analysis.threats.physicalCount} Phys · {analysis.threats.magicCount} Magic
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Enemy Sustain / Heal</div>
                <div className="font-mono tabular-nums text-base font-semibold text-amber-300 mt-0.5">
                  {analysis.threats.healerCount} {analysis.threats.healerCount === 1 ? 'hero' : 'heroes'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Enemy Frontline Tanks</div>
                <div className="font-mono tabular-nums text-base font-semibold text-slate-100 mt-0.5">
                  {analysis.threats.tankCount} {analysis.threats.tankCount === 1 ? 'tank' : 'tanks'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Allied Support & Frontline</div>
                <div className="font-mono tabular-nums text-base font-semibold text-emerald-400 mt-0.5">
                  {analysis.threats.allyHealerCount} Heal · {analysis.threats.allyFrontlineCount} Tank
                </div>
              </div>
            </div>

            {analysis.threats.notes.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-slate-300">
                {analysis.threats.notes.map((note, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommended Team Synergy Combos */}
          {myHeroId !== null && (
            <div
              data-testid="team-combo-recommendations"
              className="rounded-xl border border-slate-800/80 bg-[#111827] p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <h2 className="font-display text-base font-semibold text-slate-100">
                    Recommended Team Combos for {heroNameMap.get(myHeroId)?.name || 'Your Hero'}
                  </h2>
                </div>
                <span className="text-xs text-slate-400">
                  Live win-rate synergy partners from Rone Arena
                </span>
              </div>

              {compatLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-lg bg-slate-800/50 animate-pulse" />
                  ))}
                </div>
              ) : teamCombos.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No duo synergy records returned for this hero in the current Mythic window.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teamCombos.map((combo) => {
                    const isEnemyPicked = enemyHeroIds.includes(combo.partnerHeroId);
                    return (
                      <div
                        key={combo.partnerHeroId}
                        className="rounded-lg border border-slate-800/80 bg-[#0B0F17]/80 p-3.5 flex items-start gap-3"
                      >
                        <SafeImage
                          src={combo.partnerHead}
                          alt={combo.partnerName}
                          fallbackText={combo.partnerName}
                          size="sm"
                          className="w-11 h-11 rounded-lg border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-medium text-sm text-slate-100">
                                {combo.partnerName}
                              </span>
                              <span className="text-[11px] text-slate-400 capitalize ml-2">
                                {combo.partnerRole}
                              </span>
                            </div>
                            {combo.winRateBoostPct !== null && (
                              <span className="font-mono tabular-nums text-xs font-semibold text-emerald-400 shrink-0">
                                +{combo.winRateBoostPct.toFixed(2)}% WR
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] font-medium text-amber-300">
                            {combo.synergyLabel}
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            {combo.comboNote}
                          </p>

                          <div className="pt-1">
                            {combo.alreadyInTeam ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                In Your Team
                              </span>
                            ) : isEnemyPicked ? (
                              <span className="text-[11px] text-rose-400">
                                Picked by Enemy
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={!hasOpenAllySlot}
                                onClick={() => handleAddRecommendedAlly(combo.partnerHeroId)}
                                className="px-2.5 py-1 rounded-md border border-slate-700 bg-slate-800/80 hover:border-amber-400/70 hover:text-amber-300 disabled:opacity-45 disabled:cursor-not-allowed text-[11px] font-medium text-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" aria-hidden="true" />
                                {hasOpenAllySlot ? 'Add to Allies' : 'Ally Slots Full'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Recommendation Category Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Build archetype filter"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#111827] border border-slate-800"
            >
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeCategory === tab.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-xs font-mono tabular-nums text-slate-400">
              {visibleRecommendations.length} recommended items
            </span>
          </div>

          {/* Item Recommendations Grid */}
          {equipmentLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : visibleRecommendations.length === 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-8 text-center text-sm text-slate-400">
              No items matched this specific category for the current draft. Try viewing All Recommendations or adding enemy heroes.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleRecommendations.map((rec) => {
                const priorityColor =
                  rec.priority === 'Core Counter'
                    ? 'text-amber-300'
                    : rec.priority === 'High'
                      ? 'text-emerald-400'
                      : 'text-slate-400';

                const catLabel =
                  rec.category === 'counter'
                    ? 'Counter'
                    : rec.category === 'sustain'
                      ? 'Sustain'
                      : rec.category === 'damage'
                        ? 'Damage'
                        : 'Defense';

                return (
                  <article
                    key={rec.equipName}
                    className="rounded-xl border border-slate-800/80 bg-[#111827] p-4 sm:p-5 flex gap-4"
                  >
                    <SafeImage
                      src={rec.icon}
                      alt={rec.equipName}
                      fallbackText={rec.equipName}
                      className="w-12 h-12 rounded-xl border border-slate-700"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-base font-semibold text-slate-100">
                          {rec.equipName}
                        </h3>
                        <span className={`text-xs font-semibold ${priorityColor}`}>
                          {rec.priority}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        <span>{catLabel}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{rec.typeLabel}</span>
                        {rec.statsSummary ? (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="text-slate-300">{rec.statsSummary}</span>
                          </>
                        ) : null}
                      </div>

                      <ul className="space-y-1 pt-1 text-xs text-slate-300 leading-relaxed">
                        {rec.reasons.map((reason, idx) => (
                          <li key={idx}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                );
              })}
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
          aria-label="Select hero for draft slot"
          onClick={() => setPickerTarget(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0D131E] overflow-hidden flex flex-col max-h-[82vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-100">
                  Select Hero
                </h2>
                <p className="text-xs text-slate-400">
                  Choose from {roster.length} Mobile Legends heroes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerTarget(null)}
                aria-label="Close hero selector"
                className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
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

              <div className="flex flex-wrap gap-1.5">
                {PICKER_ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPickerRole(r.id)}
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
                        ? 'border-slate-800/50 bg-slate-900/40 opacity-40 cursor-not-allowed'
                        : 'border-slate-800 bg-[#111827] hover:border-amber-400/70 hover:bg-slate-800/70 cursor-pointer'
                    }`}
                  >
                    <SafeImage
                      src={hero.head}
                      alt={hero.name}
                      fallbackText={hero.name}
                      size="sm"
                      className="w-9 h-9 rounded-md"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-100 truncate">
                        {hero.name}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize truncate">
                        {hero.roles[0] || 'Hero'}
                      </div>
                    </div>
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
