import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, Repeat } from 'lucide-react';
import type { HeroDetailRecord, HeroRankRecord } from '../types/mlbb';
import {
  extractSkillUtilityProfile,
  getHeroBaseAndGrowthStats,
  projectStatAtLevel,
} from '../utils/heroCompare';
import { formatPercent, type HeroMetadataSummary } from '../utils/mlbb';
import { SafeImage } from './SafeImage';

interface HeroCompareHeroInput {
  id: number;
  name: string;
  portrait?: string;
  pos?: HeroMetadataSummary;
  detail: HeroDetailRecord | null;
  rankRecord?: HeroRankRecord;
}

interface HeroComparePanelProps {
  primaryHero: HeroCompareHeroInput;
  compareHero: HeroCompareHeroInput;
  loadingCompare: boolean;
  compareError: string | null;
  onChangeOpponent: () => void;
  onExitCompare: () => void;
}

function renderCompareCell(
  valA: number,
  valB: number,
  options?: {
    unit?: string;
    decimals?: number;
    higherIsBetter?: boolean;
    prefix?: string;
  },
) {
  const { unit = '', decimals = 0, higherIsBetter = true, prefix = '' } = options || {};
  const aBetter = higherIsBetter ? valA > valB : valA < valB;
  const bBetter = higherIsBetter ? valB > valA : valB < valA;

  const fmt = (v: number) =>
    `${prefix}${decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()}${unit}`;

  return {
    textA: fmt(valA),
    textB: fmt(valB),
    aBetter,
    bBetter,
  };
}

export function HeroComparePanel({
  primaryHero,
  compareHero,
  loadingCompare,
  compareError,
  onChangeOpponent,
  onExitCompare,
}: HeroComparePanelProps) {
  const [statLevel, setStatLevel] = useState<1 | 15>(1);

  const primaryData = primaryHero.detail?.data?.hero?.data;
  const compareData = compareHero.detail?.data?.hero?.data;

  const primaryStats = useMemo(
    () =>
      getHeroBaseAndGrowthStats(
        primaryHero.name,
        primaryHero.pos?.roles || [],
        primaryData?.abilityshow || [],
      ),
    [primaryHero.name, primaryHero.pos?.roles, primaryData?.abilityshow],
  );

  const compareStats = useMemo(
    () =>
      getHeroBaseAndGrowthStats(
        compareHero.name,
        compareHero.pos?.roles || [],
        compareData?.abilityshow || [],
      ),
    [compareHero.name, compareHero.pos?.roles, compareData?.abilityshow],
  );

  const primaryUtility = useMemo(
    () => extractSkillUtilityProfile(primaryData?.heroskilllist?.[0]?.skilllist || []),
    [primaryData?.heroskilllist],
  );

  const compareUtility = useMemo(
    () => extractSkillUtilityProfile(compareData?.heroskilllist?.[0]?.skilllist || []),
    [compareData?.heroskilllist],
  );

  const baseComparisonRows = useMemo(() => {
    const lv = statLevel;
    return [
      {
        label: lv === 1 ? 'Base HP (Lv. 1)' : 'Max HP (Lv. 15)',
        ...renderCompareCell(
          projectStatAtLevel(primaryStats.baseHp, primaryStats.hpGrowth, lv),
          projectStatAtLevel(compareStats.baseHp, compareStats.hpGrowth, lv),
        ),
      },
      {
        label: lv === 1 ? 'Base Attack (Lv. 1)' : 'Attack Power (Lv. 15)',
        ...renderCompareCell(
          projectStatAtLevel(primaryStats.basePhysAtk, primaryStats.physAtkGrowth, lv),
          projectStatAtLevel(compareStats.basePhysAtk, compareStats.physAtkGrowth, lv),
          { decimals: lv === 15 ? 1 : 0 },
        ),
      },
      {
        label: lv === 1 ? 'Physical Defense' : 'Physical Def (Lv. 15)',
        ...renderCompareCell(
          projectStatAtLevel(primaryStats.basePhysDef, primaryStats.physDefGrowth, lv),
          projectStatAtLevel(compareStats.basePhysDef, compareStats.physDefGrowth, lv),
          { decimals: lv === 15 ? 1 : 0 },
        ),
      },
      {
        label: lv === 1 ? 'Magic Defense' : 'Magic Def (Lv. 15)',
        ...renderCompareCell(
          projectStatAtLevel(primaryStats.baseMagicDef, primaryStats.magicDefGrowth, lv),
          projectStatAtLevel(compareStats.baseMagicDef, compareStats.magicDefGrowth, lv),
          { decimals: lv === 15 ? 1 : 0 },
        ),
      },
      {
        label: 'Attack Speed',
        ...renderCompareCell(
          lv === 1
            ? primaryStats.baseAtkSpeed
            : Number(
                (
                  primaryStats.baseAtkSpeed *
                  (1 + (primaryStats.atkSpeedGrowthPct * 14) / 100)
                ).toFixed(2),
              ),
          lv === 1
            ? compareStats.baseAtkSpeed
            : Number(
                (
                  compareStats.baseAtkSpeed *
                  (1 + (compareStats.atkSpeedGrowthPct * 14) / 100)
                ).toFixed(2),
              ),
          { decimals: 2 },
        ),
      },
      {
        label: 'Movement Speed',
        ...renderCompareCell(primaryStats.moveSpeed, compareStats.moveSpeed),
      },
    ];
  }, [statLevel, primaryStats, compareStats]);

  const growthRows = useMemo(
    () => [
      {
        label: 'HP Growth / Lv',
        ...renderCompareCell(primaryStats.hpGrowth, compareStats.hpGrowth, {
          prefix: '+',
        }),
      },
      {
        label: 'Attack Growth / Lv',
        ...renderCompareCell(primaryStats.physAtkGrowth, compareStats.physAtkGrowth, {
          prefix: '+',
          decimals: 1,
        }),
      },
      {
        label: 'Phys Def Growth / Lv',
        ...renderCompareCell(primaryStats.physDefGrowth, compareStats.physDefGrowth, {
          prefix: '+',
          decimals: 1,
        }),
      },
      {
        label: 'Magic Def Growth / Lv',
        ...renderCompareCell(primaryStats.magicDefGrowth, compareStats.magicDefGrowth, {
          prefix: '+',
          decimals: 1,
        }),
      },
      {
        label: 'Atk Speed Growth / Lv',
        ...renderCompareCell(
          primaryStats.atkSpeedGrowthPct,
          compareStats.atkSpeedGrowthPct,
          { prefix: '+', unit: '%', decimals: 1 },
        ),
      },
    ],
    [primaryStats, compareStats],
  );

  const ratingLabels = ['Durability', 'Offense', 'Control Effects', 'Difficulty'];
  const primaryAbilities = primaryData?.abilityshow || [];
  const compareAbilities = compareData?.abilityshow || [];

  const maxSlots = Math.max(primaryUtility.slots.length, compareUtility.slots.length);

  return (
    <div className="space-y-6" data-testid="hero-compare-panel">
      {/* Sticky/Top Compare Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExitCompare}
          className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to {primaryHero.name}</span>
        </button>

        <button
          type="button"
          onClick={onChangeOpponent}
          className="px-3 py-1.5 rounded-lg border border-amber-500/60 bg-amber-500/10 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Change Opponent</span>
        </button>
      </div>

      {/* Matchup Banner: Hero A vs Hero B */}
      <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-center rounded-xl border border-slate-800 bg-[#111827] p-4">
        <div className="sm:col-span-5 flex items-center gap-3 min-w-0">
          <SafeImage
            src={primaryHero.portrait}
            alt={primaryHero.name}
            fallbackText={primaryHero.name}
            size="sm"
            className="w-12 h-12 rounded-lg border border-amber-500/60 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-display text-base font-bold text-slate-50 truncate">
              {primaryHero.name}
            </div>
            <div className="text-xs text-slate-400 capitalize truncate">
              {primaryHero.pos?.roles?.join(' / ') || 'Hero'}
              {primaryHero.rankRecord
                ? ` · ${formatPercent(primaryHero.rankRecord.data.main_hero_win_rate)} WR`
                : ''}
            </div>
          </div>
        </div>

        <div className="sm:col-span-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-lg border border-slate-800 bg-[#0B0F17] flex items-center justify-center">
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          </div>
        </div>

        <div className="sm:col-span-5 flex items-center gap-3 min-w-0 sm:justify-end sm:text-right">
          <div className="min-w-0 order-2 sm:order-1">
            <div className="font-display text-base font-bold text-slate-50 truncate">
              {compareHero.name}
            </div>
            <div className="text-xs text-slate-400 capitalize truncate">
              {compareHero.pos?.roles?.join(' / ') || 'Hero'}
              {compareHero.rankRecord
                ? ` · ${formatPercent(compareHero.rankRecord.data.main_hero_win_rate)} WR`
                : ''}
            </div>
          </div>
          <SafeImage
            src={compareHero.portrait}
            alt={compareHero.name}
            fallbackText={compareHero.name}
            size="sm"
            className="w-12 h-12 rounded-lg border border-slate-700 shrink-0 order-1 sm:order-2"
          />
        </div>
      </div>

      {loadingCompare ? (
        <div className="space-y-4">
          <div className="h-44 rounded-xl bg-slate-800/60 animate-pulse" />
          <div className="h-36 rounded-xl bg-slate-800/60 animate-pulse" />
          <div className="h-48 rounded-xl bg-slate-800/60 animate-pulse" />
        </div>
      ) : compareError ? (
        <div className="rounded-xl border border-rose-900/70 bg-rose-950/30 p-4 text-xs text-rose-200">
          {compareError}
        </div>
      ) : (
        <>
          {/* Section 1: Base Stats & Lv.15 Projection */}
          <section className="rounded-xl border border-slate-800 bg-[#111827] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Base Stats & Official Ratings
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Toggle Level 1 starting stats or Level 15 full scaling ·{' '}
                  {primaryStats.source === 'catalog' && compareStats.source === 'catalog'
                    ? 'Catalog attribute data'
                    : 'Catalog & role-calibrated stats'}
                </p>
              </div>

              <div
                role="group"
                aria-label="Compare stat level"
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0B0F17] border border-slate-800 self-start sm:self-auto"
              >
                <button
                  type="button"
                  onClick={() => setStatLevel(1)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                    statLevel === 1
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-slate-100'
                  }`}
                >
                  Lv. 1 Base
                </button>
                <button
                  type="button"
                  onClick={() => setStatLevel(15)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                    statLevel === 15
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-slate-100'
                  }`}
                >
                  Lv. 15 Max
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {baseComparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="px-4 py-2.5 grid grid-cols-3 items-center gap-2 text-xs"
                >
                  <div
                    className={`font-mono tabular-nums text-left font-semibold ${
                      row.aBetter ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {row.textA}
                  </div>
                  <div className="text-center text-slate-400 font-medium">
                    {row.label}
                  </div>
                  <div
                    className={`font-mono tabular-nums text-right font-semibold ${
                      row.bBetter ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {row.textB}
                  </div>
                </div>
              ))}

              {/* Rone Arena Ratings */}
              {ratingLabels.map((label, idx) => {
                const vA = Number(primaryAbilities[idx]) || 0;
                const vB = Number(compareAbilities[idx]) || 0;
                return (
                  <div
                    key={label}
                    className="px-4 py-2.5 grid grid-cols-3 items-center gap-2 text-xs bg-[#0B0F17]/35"
                  >
                    <div
                      className={`font-mono tabular-nums text-left font-semibold ${
                        vA > vB ? 'text-amber-300' : 'text-slate-300'
                      }`}
                    >
                      {vA} / 100
                    </div>
                    <div className="text-center text-slate-400">{label}</div>
                    <div
                      className={`font-mono tabular-nums text-right font-semibold ${
                        vB > vA ? 'text-amber-300' : 'text-slate-300'
                      }`}
                    >
                      {vB} / 100
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 2: Per-Level Growth Rates */}
          <section className="rounded-xl border border-slate-800 bg-[#111827] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Growth Rates (Per Level Scaling)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                + gain per level
              </span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {growthRows.map((row) => (
                <div
                  key={row.label}
                  className="px-4 py-2.5 grid grid-cols-3 items-center gap-2 text-xs"
                >
                  <div
                    className={`font-mono tabular-nums text-left font-semibold ${
                      row.aBetter ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {row.textA}
                  </div>
                  <div className="text-center text-slate-400 font-medium">
                    {row.label}
                  </div>
                  <div
                    className={`font-mono tabular-nums text-right font-semibold ${
                      row.bBetter ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {row.textB}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Skill Utility & Cooldown Matrix */}
          <section className="rounded-xl border border-slate-800 bg-[#111827] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Skill Utility & Cooldown Profile
              </h3>
              <span className="text-[11px] text-slate-400">
                Parsed from live Rone Arena skill kits
              </span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {[
                {
                  label: 'Crowd Control Skills',
                  a: primaryUtility.utilityCounts.cc,
                  b: compareUtility.utilityCounts.cc,
                },
                {
                  label: 'Mobility / Dash Skills',
                  a: primaryUtility.utilityCounts.mobility,
                  b: compareUtility.utilityCounts.mobility,
                },
                {
                  label: 'Sustain / Shield Skills',
                  a: primaryUtility.utilityCounts.sustain,
                  b: compareUtility.utilityCounts.sustain,
                },
                {
                  label: 'Buff / Protection Skills',
                  a: primaryUtility.utilityCounts.buff,
                  b: compareUtility.utilityCounts.buff,
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="px-4 py-2.5 grid grid-cols-3 items-center gap-2 text-xs"
                >
                  <div
                    className={`font-mono tabular-nums text-left font-semibold ${
                      row.a > row.b ? 'text-amber-300' : 'text-slate-200'
                    }`}
                  >
                    {row.a} {row.a === 1 ? 'skill' : 'skills'}
                  </div>
                  <div className="text-center text-slate-400">{row.label}</div>
                  <div
                    className={`font-mono tabular-nums text-right font-semibold ${
                      row.b > row.a ? 'text-amber-300' : 'text-slate-200'
                    }`}
                  >
                    {row.b} {row.b === 1 ? 'skill' : 'skills'}
                  </div>
                </div>
              ))}

              <div className="px-4 py-2.5 grid grid-cols-3 items-center gap-2 text-xs bg-[#0B0F17]/35">
                <div
                  className={`font-mono tabular-nums text-left font-semibold ${
                    primaryUtility.avgActiveCdSec !== null &&
                    compareUtility.avgActiveCdSec !== null &&
                    primaryUtility.avgActiveCdSec < compareUtility.avgActiveCdSec
                      ? 'text-emerald-400'
                      : 'text-slate-200'
                  }`}
                >
                  {primaryUtility.avgActiveCdSec !== null
                    ? `${primaryUtility.avgActiveCdSec}s`
                    : '—'}
                </div>
                <div className="text-center text-slate-400">Avg Active Skill CD</div>
                <div
                  className={`font-mono tabular-nums text-right font-semibold ${
                    primaryUtility.avgActiveCdSec !== null &&
                    compareUtility.avgActiveCdSec !== null &&
                    compareUtility.avgActiveCdSec < primaryUtility.avgActiveCdSec
                      ? 'text-emerald-400'
                      : 'text-slate-200'
                  }`}
                >
                  {compareUtility.avgActiveCdSec !== null
                    ? `${compareUtility.avgActiveCdSec}s`
                    : '—'}
                </div>
              </div>

              <div className="px-4 py-2.5 grid grid-cols-3 items-center gap-2 text-xs bg-[#0B0F17]/35">
                <div
                  className={`font-mono tabular-nums text-left font-semibold ${
                    primaryUtility.ultCdSec !== null &&
                    compareUtility.ultCdSec !== null &&
                    primaryUtility.ultCdSec < compareUtility.ultCdSec
                      ? 'text-emerald-400'
                      : 'text-slate-200'
                  }`}
                >
                  {primaryUtility.ultCdSec !== null ? `${primaryUtility.ultCdSec}s` : '—'}
                </div>
                <div className="text-center text-slate-400">Base Ultimate CD</div>
                <div
                  className={`font-mono tabular-nums text-right font-semibold ${
                    primaryUtility.ultCdSec !== null &&
                    compareUtility.ultCdSec !== null &&
                    compareUtility.ultCdSec < primaryUtility.ultCdSec
                      ? 'text-emerald-400'
                      : 'text-slate-200'
                  }`}
                >
                  {compareUtility.ultCdSec !== null ? `${compareUtility.ultCdSec}s` : '—'}
                </div>
              </div>
            </div>

            {/* Slot-by-Slot Skill Utility Side-by-Side */}
            {maxSlots > 0 && (
              <div className="border-t border-slate-800 divide-y divide-slate-800/70">
                {Array.from({ length: maxSlots }).map((_, idx) => {
                  const sA = primaryUtility.slots[idx];
                  const sB = compareUtility.slots[idx];
                  const slotTitle = sA?.slotLabel || sB?.slotLabel || `Skill ${idx}`;
                  return (
                    <div key={slotTitle} className="p-4 space-y-2.5">
                      <div className="text-[11px] font-mono font-semibold text-amber-300/90">
                        {slotTitle}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {[sA, sB].map((slot, sideIdx) =>
                          slot ? (
                            <div
                              key={`${slotTitle}-${sideIdx}`}
                              className="rounded-lg border border-slate-800/80 bg-[#0B0F17]/70 p-3 space-y-1.5"
                            >
                              <div className="flex items-start gap-2.5">
                                <SafeImage
                                  src={slot.icon}
                                  alt={slot.name}
                                  fallbackText={slot.name}
                                  size="sm"
                                  className="w-8 h-8 rounded border border-slate-700 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-slate-100 truncate">
                                    {slot.name}
                                  </div>
                                  <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                    {slot.cooldownText}
                                    {slot.tags.length > 0 ? ` · ${slot.tags.join(', ')}` : ''}
                                  </div>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                                {slot.summary}
                              </p>
                            </div>
                          ) : (
                            <div
                              key={`${slotTitle}-${sideIdx}`}
                              className="rounded-lg border border-slate-800/50 bg-[#0B0F17]/40 p-3 text-xs text-slate-500"
                            >
                              No ability in this slot
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
