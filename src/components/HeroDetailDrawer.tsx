import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Search, X } from 'lucide-react';
import {
  fetchHeroCompatibility,
  fetchHeroCounters,
  fetchHeroDetail,
} from '../services/roneApi';
import type {
  EquipmentRecord,
  HeroDetailRecord,
  HeroRankRecord,
  RankFilter,
  RoleFilter,
} from '../types/mlbb';
import { buildHeroMatchupPayload } from '../utils/heroMatchup';
import { formatPercent, stripHtmlTags, type HeroMetadataSummary } from '../utils/mlbb';
import { HeroComparePanel } from './HeroComparePanel';
import { MatchupAnalysisSection } from './MatchupAnalysisSection';
import { ProTipsTab } from './ProTipsTab';
import { SafeImage } from './SafeImage';

interface HeroDetailDrawerProps {
  heroId: number | null;
  rankFilter: RankFilter;
  positionMap: Map<number, HeroMetadataSummary>;
  heroRankMap: Map<number, HeroRankRecord>;
  heroNameMap: Map<number, { name: string; head: string }>;
  equipmentList: EquipmentRecord[];
  onSelectHero: (heroId: number) => void;
  onClose: () => void;
}

const ABILITY_LABELS = ['Durability', 'Offense', 'Control', 'Difficulty'];

const COMPARE_ROLES: Array<{ id: RoleFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tank', label: 'Tank' },
  { id: 'fighter', label: 'Fighter' },
  { id: 'assassin', label: 'Assassin' },
  { id: 'mage', label: 'Mage' },
  { id: 'marksman', label: 'Marksman' },
  { id: 'support', label: 'Support' },
];

export function HeroDetailDrawer({
  heroId,
  rankFilter,
  positionMap,
  heroRankMap,
  heroNameMap,
  equipmentList,
  onSelectHero,
  onClose,
}: HeroDetailDrawerProps) {
  const [detail, setDetail] = useState<HeroDetailRecord | null>(null);
  const [counters, setCounters] = useState<HeroRankRecord | null>(null);
  const [compat, setCompat] = useState<HeroRankRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'pro-tips'>('overview');

  // Compare state
  const [compareMode, setCompareMode] = useState<'off' | 'picking' | 'comparing'>('off');
  const [compareHeroId, setCompareHeroId] = useState<number | null>(null);
  const [compareDetail, setCompareDetail] = useState<HeroDetailRecord | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareQuery, setCompareQuery] = useState('');
  const [compareRole, setCompareRole] = useState<RoleFilter>('all');

  useEffect(() => {
    setDrawerTab('overview');
    setCompareMode('off');
    setCompareHeroId(null);
    setCompareDetail(null);
    setCompareError(null);
    setCompareQuery('');
    setCompareRole('all');
  }, [heroId]);

  useEffect(() => {
    if (!heroId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const apiRank: RankFilter = rankFilter === 'all' ? 'mythic' : rankFilter;

    Promise.all([
      fetchHeroDetail(heroId),
      fetchHeroCounters(heroId, apiRank).catch(() => null),
      fetchHeroCompatibility(heroId, apiRank).catch(() => null),
    ])
      .then(([d, c, comp]) => {
        if (cancelled) return;
        setDetail(d);
        setCounters(c);
        setCompat(comp);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load hero profile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [heroId, rankFilter]);

  useEffect(() => {
    if (!compareHeroId || compareMode !== 'comparing') return;
    let cancelled = false;
    setCompareLoading(true);
    setCompareError(null);

    fetchHeroDetail(compareHeroId)
      .then((d) => {
        if (!cancelled) setCompareDetail(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setCompareError(
            err instanceof Error ? err.message : 'Unable to load comparison hero profile.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [compareHeroId, compareMode]);

  useEffect(() => {
    if (!heroId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [heroId, onClose]);

  const heroData = detail?.data?.hero?.data;
  const fallbackInfo = heroId ? heroNameMap.get(heroId) : undefined;
  const heroName = heroData?.name || fallbackInfo?.name || (heroId ? `Hero #${heroId}` : '');
  const heroPortrait = detail?.data?.head || heroData?.painting || fallbackInfo?.head;
  const pos = heroId ? positionMap.get(heroId) : undefined;
  const rankRecord = heroId ? heroRankMap.get(heroId) : undefined;
  const rankStat = rankRecord?.data;
  const skills = heroData?.heroskilllist?.[0]?.skilllist || [];
  const abilities = heroData?.abilityshow || [];

  const compareRoster = useMemo(() => {
    const q = compareQuery.trim().toLowerCase();
    const list: Array<{ id: number; name: string; head: string; roles: string[] }> = [];
    for (const [id, info] of heroNameMap.entries()) {
      if (id === heroId) continue;
      const p = positionMap.get(id);
      const roles = p?.roles || [];
      if (q && !info.name.toLowerCase().includes(q)) continue;
      if (compareRole !== 'all' && !roles.some((r) => r.includes(compareRole))) continue;
      list.push({ id, name: info.name, head: info.head, roles });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [heroNameMap, positionMap, heroId, compareQuery, compareRole]);

  const compareFallbackInfo = compareHeroId ? heroNameMap.get(compareHeroId) : undefined;
  const compareHeroData = compareDetail?.data?.hero?.data;
  const compareHeroName =
    compareHeroData?.name ||
    compareFallbackInfo?.name ||
    (compareHeroId ? `Hero #${compareHeroId}` : '');
  const compareHeroPortrait =
    compareDetail?.data?.head || compareHeroData?.painting || compareFallbackInfo?.head;

  const matchupPayload = useMemo(() => {
    if (!heroId) return null;
    return buildHeroMatchupPayload({
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
    });
  }, [heroId, heroName, rankFilter, pos, detail, rankRecord, counters, compat, heroNameMap, equipmentList]);

  if (!heroId || !matchupPayload) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-label={`${heroName} details`}
      onClick={onClose}
    >
      <div
        className={`w-full ${
          compareMode === 'comparing' ? 'max-w-3xl' : 'max-w-2xl'
        } bg-[#0D131E] border-l border-slate-800 h-full overflow-y-auto p-6 sm:p-8 space-y-6 transition-[max-width] duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-4 min-w-0">
            <SafeImage
              src={heroPortrait}
              alt={heroName}
              fallbackText={heroName}
              size="lg"
              className="w-16 h-16 rounded-xl border border-slate-700 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs text-slate-400 capitalize truncate">
                {pos?.roles?.join(' / ') || 'Hero'}
                {pos?.lanes?.length ? ` · ${pos.lanes.join(' · ')}` : ''}
                {heroData?.speciality?.length ? ` · ${heroData.speciality.join(', ')}` : ''}
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-50 mt-0.5 truncate">
                {heroName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (compareMode === 'off') {
                  setCompareMode(compareHeroId ? 'comparing' : 'picking');
                } else {
                  setCompareMode('off');
                }
              }}
              aria-pressed={compareMode !== 'off'}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                compareMode !== 'off'
                  ? 'border-amber-400 bg-amber-500 text-slate-950'
                  : 'border-slate-700 text-slate-200 hover:border-amber-400/70 hover:text-amber-300 bg-[#111827]'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Compare</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close hero details"
              className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="h-24 rounded-xl bg-slate-800/60 animate-pulse" />
            <div className="h-44 rounded-xl bg-slate-800/60 animate-pulse" />
            <div className="h-36 rounded-xl bg-slate-800/60 animate-pulse" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/70 text-sm text-rose-200">
            {error}
          </div>
        ) : compareMode === 'picking' ? (
          <div className="space-y-4" data-testid="compare-hero-picker">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-100">
                  Select a Hero to Compare with {heroName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Compare Lv. 1 & Lv. 15 base stats, per-level growth rates, and skill utility side by side.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompareMode(compareHeroId ? 'comparing' : 'off')}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800 bg-[#111827] p-4">
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  autoFocus
                  aria-label="Search hero to compare"
                  placeholder="Search hero name..."
                  value={compareQuery}
                  onChange={(e) => setCompareQuery(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {COMPARE_ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setCompareRole(r.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      compareRole === r.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {compareRoster.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center text-xs text-slate-400">
                No heroes match your search or role filter.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {compareRoster.map((hero) => (
                  <button
                    key={hero.id}
                    type="button"
                    onClick={() => {
                      setCompareHeroId(hero.id);
                      setCompareMode('comparing');
                      setCompareQuery('');
                      setCompareRole('all');
                    }}
                    className="p-2.5 rounded-lg border border-slate-800 bg-[#111827] hover:border-amber-400/70 hover:bg-slate-800/70 transition-colors flex items-center gap-2.5 text-left cursor-pointer"
                  >
                    <SafeImage
                      src={hero.head}
                      alt={hero.name}
                      fallbackText={hero.name}
                      size="sm"
                      className="w-9 h-9 rounded-md shrink-0"
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
                ))}
              </div>
            )}
          </div>
        ) : compareMode === 'comparing' && compareHeroId ? (
          <HeroComparePanel
            primaryHero={{
              id: heroId,
              name: heroName,
              portrait: heroPortrait,
              pos,
              detail,
              rankRecord,
            }}
            compareHero={{
              id: compareHeroId,
              name: compareHeroName,
              portrait: compareHeroPortrait,
              pos: positionMap.get(compareHeroId),
              detail: compareDetail,
              rankRecord: heroRankMap.get(compareHeroId),
            }}
            loadingCompare={compareLoading}
            compareError={compareError}
            onChangeOpponent={() => setCompareMode('picking')}
            onExitCompare={() => setCompareMode('off')}
          />
        ) : (
          <>
            {/* Drawer View Tabs */}
            <div
              role="tablist"
              aria-label="Hero detail sections"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-slate-800"
            >
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === 'overview'}
                onClick={() => setDrawerTab('overview')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  drawerTab === 'overview'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={drawerTab === 'pro-tips'}
                onClick={() => setDrawerTab('pro-tips')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  drawerTab === 'pro-tips'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                Pro Tips
              </button>
            </div>

            {drawerTab === 'pro-tips' ? (
              <ProTipsTab
                key={`pro-${heroId}-${rankFilter}`}
                payload={matchupPayload}
                skills={skills}
              />
            ) : (
              <>
                {/* Live Win/Pick/Ban strip */}
            {rankStat && (
              <div className="grid grid-cols-3 gap-4 p-4 rounded-xl border border-slate-800 bg-[#111827]">
                <div>
                  <div className="text-xs text-slate-400">Win Rate</div>
                  <div className="font-mono tabular-nums text-xl font-semibold text-emerald-400 mt-0.5">
                    {formatPercent(rankStat.main_hero_win_rate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Pick Rate</div>
                  <div className="font-mono tabular-nums text-xl font-semibold text-slate-100 mt-0.5">
                    {formatPercent(rankStat.main_hero_appearance_rate)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Ban Rate</div>
                  <div className="font-mono tabular-nums text-xl font-semibold text-amber-300 mt-0.5">
                    {formatPercent(rankStat.main_hero_ban_rate)}
                  </div>
                </div>
              </div>
            )}

            {/* AI Matchup Analysis & Counter Strategy */}
            <MatchupAnalysisSection
              key={`${heroId}-${rankFilter}`}
              payload={matchupPayload}
              equipmentList={equipmentList}
            />

            {/* Lore & Ability Ratings */}
            {(heroData?.story || abilities.length > 0) && (
              <div className="space-y-4">
                {heroData?.story && (
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {stripHtmlTags(heroData.story)}
                  </p>
                )}

                {abilities.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    {abilities.slice(0, 4).map((val, idx) => {
                      const num = Math.min(100, Math.max(0, Number(val) || 0));
                      return (
                        <div key={ABILITY_LABELS[idx]} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">{ABILITY_LABELS[idx]}</span>
                            <span className="font-mono tabular-nums text-slate-200">{num}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-amber-400"
                              style={{ width: `${num}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Skills Breakdown */}
            {skills.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Skill Kit
                </h3>
                <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800 bg-[#111827]">
                  {skills.map((skill, idx) => (
                    <div key={`${skill.skillname}-${idx}`} className="p-4 flex gap-3.5">
                      <SafeImage
                        src={skill.skillicon}
                        alt={skill.skillname}
                        fallbackText={skill.skillname}
                        size="sm"
                        className="w-11 h-11 rounded-lg border border-slate-700"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="font-medium text-sm text-slate-100">
                            {skill.skillname}
                          </div>
                          {skill['skillcd&cost'] && (
                            <span className="text-[11px] font-mono tabular-nums text-amber-300/90">
                              {skill['skillcd&cost']}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {stripHtmlTags(skill.skilldesc || '')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Counters & Compatibility */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {counters?.data?.sub_hero && counters.data.sub_hero.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 space-y-3">
                  <h3 className="font-display text-sm font-semibold text-slate-100">
                    Strong Against
                  </h3>
                  <div className="space-y-2.5">
                    {counters.data.sub_hero.slice(0, 5).map((sub) => {
                      const info = heroNameMap.get(sub.heroid);
                      const label = sub.hero?.data?.name || info?.name || `Hero #${sub.heroid}`;
                      return (
                        <button
                          key={sub.heroid}
                          type="button"
                          onClick={() => onSelectHero(sub.heroid)}
                          className="w-full flex items-center justify-between gap-2 text-left hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SafeImage
                              src={sub.hero?.data?.head || info?.head}
                              alt={label}
                              fallbackText={label}
                              size="sm"
                              className="w-8 h-8 rounded-md"
                            />
                            <span className="text-xs font-medium text-slate-200 truncate">
                              {label}
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-emerald-400 shrink-0">
                            +{formatPercent(sub.increase_win_rate)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {compat?.data?.sub_hero && compat.data.sub_hero.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 space-y-3">
                  <h3 className="font-display text-sm font-semibold text-slate-100">
                    Best Teammates
                  </h3>
                  <div className="space-y-2.5">
                    {compat.data.sub_hero.slice(0, 5).map((sub) => {
                      const info = heroNameMap.get(sub.heroid);
                      const label = sub.hero?.data?.name || info?.name || `Hero #${sub.heroid}`;
                      return (
                        <button
                          key={sub.heroid}
                          type="button"
                          onClick={() => onSelectHero(sub.heroid)}
                          className="w-full flex items-center justify-between gap-2 text-left hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SafeImage
                              src={sub.hero?.data?.head || info?.head}
                              alt={label}
                              fallbackText={label}
                              size="sm"
                              className="w-8 h-8 rounded-md"
                            />
                            <span className="text-xs font-medium text-slate-200 truncate">
                              {label}
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-amber-300 shrink-0">
                            +{formatPercent(sub.increase_win_rate)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
