import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { fetchHeroRanks } from '../services/roneApi';
import type {
  DaysFilter,
  HeroRankRecord,
  HeroSortField,
  LaneFilter,
  RankFilter,
  RoleFilter,
  SortOrder,
} from '../types/mlbb';
import {
  buildWinRateTrendSeries,
  getTrendWindowsForRange,
  selectTopPopularHeroes,
} from '../utils/heroTrends';
import {
  filterAndSortHeroRanks,
  formatPercent,
  type HeroMetadataSummary,
} from '../utils/mlbb';
import { SafeImage } from './SafeImage';
import { WinRateTrendChart } from './WinRateTrendChart';

interface HeroMetaViewProps {
  heroRanks: HeroRankRecord[];
  positionMap: Map<number, HeroMetadataSummary>;
  loading: boolean;
  error: string | null;
  rankFilter: RankFilter;
  daysFilter: DaysFilter;
  onChangeRankFilter: (r: RankFilter) => void;
  onChangeDaysFilter: (d: DaysFilter) => void;
  onRetry: () => void;
  onOpenHero: (heroId: number) => void;
}

const RANK_TABS: Array<{ id: RankFilter; label: string }> = [
  { id: 'all', label: 'All Tiers' },
  { id: 'epic', label: 'Epic' },
  { id: 'legend', label: 'Legend' },
  { id: 'mythic', label: 'Mythic' },
  { id: 'honor', label: 'Honor' },
  { id: 'glory', label: 'Glory' },
];

const DAYS_OPTIONS: Array<{ id: DaysFilter; label: string }> = [
  { id: '1', label: '1D' },
  { id: '3', label: '3D' },
  { id: '7', label: '7D' },
  { id: '15', label: '15D' },
  { id: '30', label: '30D' },
];

const ROLE_OPTIONS: Array<{ id: RoleFilter; label: string }> = [
  { id: 'all', label: 'All Roles' },
  { id: 'tank', label: 'Tank' },
  { id: 'fighter', label: 'Fighter' },
  { id: 'assassin', label: 'Assassin' },
  { id: 'mage', label: 'Mage' },
  { id: 'marksman', label: 'Marksman' },
  { id: 'support', label: 'Support' },
];

const LANE_OPTIONS: Array<{ id: LaneFilter; label: string }> = [
  { id: 'all', label: 'All Lanes' },
  { id: 'exp', label: 'EXP Lane' },
  { id: 'mid', label: 'Mid Lane' },
  { id: 'roam', label: 'Roam' },
  { id: 'jungle', label: 'Jungle' },
  { id: 'gold', label: 'Gold Lane' },
];

export function HeroMetaView({
  heroRanks,
  positionMap,
  loading,
  error,
  rankFilter,
  daysFilter,
  onChangeRankFilter,
  onChangeDaysFilter,
  onRetry,
  onOpenHero,
}: HeroMetaViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [laneFilter, setLaneFilter] = useState<LaneFilter>('all');
  const [sortField, setSortField] = useState<HeroSortField>('win_rate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [trendSnapshots, setTrendSnapshots] = useState<Record<string, HeroRankRecord[]>>({});
  const [trendLoading, setTrendLoading] = useState(false);
  const snapshotsRef = useRef<Record<string, HeroRankRecord[]>>({});

  const trendWindows = useMemo(() => getTrendWindowsForRange(daysFilter), [daysFilter]);

  useEffect(() => {
    if (heroRanks.length === 0) return;
    const activeKey = `${rankFilter}:${daysFilter}`;
    if (snapshotsRef.current[activeKey] !== heroRanks) {
      snapshotsRef.current = { ...snapshotsRef.current, [activeKey]: heroRanks };
      setTrendSnapshots(snapshotsRef.current);
    }

    const missingWindows = trendWindows.filter(
      (w) => w !== daysFilter && !snapshotsRef.current[`${rankFilter}:${w}`],
    );
    if (missingWindows.length === 0) {
      setTrendLoading(false);
      return;
    }

    let cancelled = false;
    setTrendLoading(true);

    (async () => {
      for (const w of missingWindows) {
        if (cancelled) return;
        try {
          const res = await fetchHeroRanks({
            days: w,
            rank: rankFilter,
            sortField: 'win_rate',
            sortOrder: 'desc',
            size: 150,
          });
          if (cancelled) return;
          snapshotsRef.current = {
            ...snapshotsRef.current,
            [`${rankFilter}:${w}`]: res.records,
          };
          setTrendSnapshots(snapshotsRef.current);
        } catch {
          // Keep available snapshots if an individual window fetch fails
        }
      }
      if (!cancelled) {
        setTrendLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [heroRanks, rankFilter, daysFilter, trendWindows]);

  const roleLanePool = useMemo(
    () =>
      filterAndSortHeroRanks(
        heroRanks,
        '',
        roleFilter,
        laneFilter,
        positionMap,
        'pick_rate',
        'desc',
      ),
    [heroRanks, roleFilter, laneFilter, positionMap],
  );

  const trendData = useMemo(() => {
    const topPopular = selectTopPopularHeroes(roleLanePool, 5);
    const snapshotsByDay: Partial<Record<DaysFilter, HeroRankRecord[]>> = {};
    for (const w of trendWindows) {
      const snap = trendSnapshots[`${rankFilter}:${w}`];
      if (snap) {
        snapshotsByDay[w] = snap;
      } else if (w === daysFilter && heroRanks.length > 0) {
        snapshotsByDay[w] = heroRanks;
      }
    }
    return buildWinRateTrendSeries({
      topHeroes: topPopular,
      snapshotsByDay,
      windows: trendWindows,
    });
  }, [roleLanePool, trendWindows, trendSnapshots, rankFilter, daysFilter, heroRanks]);

  const filteredHeroes = useMemo(
    () =>
      filterAndSortHeroRanks(
        heroRanks,
        searchQuery,
        roleFilter,
        laneFilter,
        positionMap,
        sortField,
        sortOrder,
      ),
    [heroRanks, searchQuery, roleFilter, laneFilter, positionMap, sortField, sortOrder],
  );

  function toggleSort(field: HeroSortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }

  function resetClientFilters() {
    setSearchQuery('');
    setRoleFilter('all');
    setLaneFilter('all');
  }

  return (
    <section className="space-y-6" data-testid="hero-meta-view">
      {/* Header & Rank Tier Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            Hero Meta & Tier Standings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Live win, pick, and ban rates across Mobile Legends ranked tiers. Select any hero for skills and matchups.
          </p>
        </div>

        {/* Rank & Timeframe controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Rank tier filter"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#111827] border border-slate-800 max-w-full"
          >
            {RANK_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeRankFilter(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  rankFilter === t.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Time window filter"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-slate-800"
          >
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onChangeDaysFilter(d.id)}
                className={`px-2.5 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  daysFilter === d.id
                    ? 'bg-slate-700 text-slate-50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recharts Line Chart: Top 5 Most Popular Heroes Win Rate Trend */}
      <WinRateTrendChart
        trend={trendData}
        rankFilter={rankFilter}
        daysFilter={daysFilter}
        loading={loading || trendLoading}
        heroCountLabel={
          roleFilter !== 'all' || laneFilter !== 'all'
            ? [
                roleFilter !== 'all' ? ROLE_OPTIONS.find((r) => r.id === roleFilter)?.label : null,
                laneFilter !== 'all' ? LANE_OPTIONS.find((l) => l.id === laneFilter)?.label : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        onOpenHero={onOpenHero}
      />

      {/* Search, Role & Lane Filters */}
      <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search heroes"
            placeholder="Search hero by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="hero-role-select" className="sr-only">
              Filter by Role
            </label>
            <select
              id="hero-role-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="px-3 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700/80 text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="hero-lane-select" className="sr-only">
              Filter by Lane
            </label>
            <select
              id="hero-lane-select"
              value={laneFilter}
              onChange={(e) => setLaneFilter(e.target.value as LaneFilter)}
              className="px-3 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700/80 text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {LANE_OPTIONS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs font-mono tabular-nums text-slate-400 px-1">
            {filteredHeroes.length} heroes
          </span>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="rounded-xl border border-slate-800/80 bg-[#111827] overflow-hidden">
        {error ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-rose-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Retry Fetch
            </button>
          </div>
        ) : loading ? (
          <div className="divide-y divide-slate-800/60">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="w-28 h-3.5 rounded bg-slate-800 animate-pulse" />
                    <div className="w-20 h-2.5 rounded bg-slate-800/70 animate-pulse" />
                  </div>
                </div>
                <div className="w-40 h-3.5 rounded bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredHeroes.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-300">
              No heroes match your current search or role/lane filter.
            </p>
            <button
              type="button"
              onClick={resetClientFilters}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/90 text-xs font-medium text-slate-400">
                  <th className="py-3 px-4 w-12 text-right">#</th>
                  <th className="py-3 px-4">Hero & Position</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('win_rate')}
                      className={`inline-flex items-center gap-1 hover:text-slate-100 cursor-pointer ${
                        sortField === 'win_rate' ? 'text-amber-300' : ''
                      }`}
                    >
                      Win Rate
                      <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right hidden sm:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort('pick_rate')}
                      className={`inline-flex items-center gap-1 hover:text-slate-100 cursor-pointer ${
                        sortField === 'pick_rate' ? 'text-amber-300' : ''
                      }`}
                    >
                      Pick Rate
                      <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right hidden sm:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort('ban_rate')}
                      className={`inline-flex items-center gap-1 hover:text-slate-100 cursor-pointer ${
                        sortField === 'ban_rate' ? 'text-amber-300' : ''
                      }`}
                    >
                      Ban Rate
                      <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 hidden md:table-cell">Best Synergies</th>
                  <th className="py-3 px-3 w-10" aria-label="Details" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredHeroes.map((rec, index) => {
                  const d = rec.data;
                  const heroName = d.main_hero?.data?.name || `Hero #${d.main_heroid}`;
                  const heroHead = d.main_hero?.data?.head;
                  const pos = positionMap.get(d.main_heroid);
                  const wrPct = d.main_hero_win_rate * 100;
                  const roleText = pos?.roles?.length
                    ? pos.roles.map((r) => r[0].toUpperCase() + r.slice(1)).join(' / ')
                    : 'Hero';
                  const laneText = pos?.lanes?.length ? pos.lanes.join(' · ') : '';

                  return (
                    <tr
                      key={d.main_heroid}
                      onClick={() => onOpenHero(d.main_heroid)}
                      className="hover:bg-slate-800/45 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-500">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <SafeImage
                            src={heroHead}
                            alt={heroName}
                            fallbackText={heroName}
                            size="sm"
                            className="w-9 h-9 rounded-lg"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-100 group-hover:text-amber-300 transition-colors truncate">
                              {heroName}
                            </div>
                            <div className="text-xs text-slate-400 truncate capitalize">
                              {roleText}
                              {laneText ? ` · ${laneText}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        <div
                          className={`font-semibold ${
                            wrPct >= 53
                              ? 'text-emerald-400'
                              : wrPct < 48
                                ? 'text-rose-400'
                                : 'text-slate-100'
                          }`}
                        >
                          {formatPercent(d.main_hero_win_rate)}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-300 hidden sm:table-cell">
                        {formatPercent(d.main_hero_appearance_rate)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-300 hidden sm:table-cell">
                        {formatPercent(d.main_hero_ban_rate)}
                      </td>
                      <td className="py-2.5 px-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          {(d.sub_hero || []).slice(0, 3).map((sub) => (
                            <SafeImage
                              key={sub.heroid}
                              src={sub.hero?.data?.head}
                              alt={`Synergy hero ${sub.heroid}`}
                              fallbackText={String(sub.heroid)}
                              size="sm"
                              className="w-7 h-7 rounded-md border border-slate-700/80"
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          aria-label={`Inspect ${heroName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenHero(d.main_heroid);
                          }}
                          className="p-1.5 rounded-md text-slate-400 group-hover:text-amber-300 hover:bg-slate-700/50 transition-colors cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
