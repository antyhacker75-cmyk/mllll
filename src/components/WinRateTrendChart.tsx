import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { DaysFilter, RankFilter } from '../types/mlbb';
import { formatPercent } from '../utils/mlbb';
import type { HeroWinRateTrendResult } from '../utils/heroTrends';
import { SafeImage } from './SafeImage';

interface WinRateTrendChartProps {
  trend: HeroWinRateTrendResult;
  rankFilter: RankFilter;
  daysFilter: DaysFilter;
  loading: boolean;
  heroCountLabel?: string;
  onOpenHero: (heroId: number) => void;
}

const RANK_LABELS: Record<RankFilter, string> = {
  all: 'All Tiers',
  epic: 'Epic',
  legend: 'Legend',
  mythic: 'Mythic',
  honor: 'Mythical Honor',
  glory: 'Mythical Glory',
};

interface CustomTooltipPayloadItem {
  dataKey?: string;
  name?: string;
  value?: number | string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
}

function CustomTrendTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const sorted = [...payload]
    .filter((item) => typeof item.value === 'number')
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));

  return (
    <div className="rounded-lg border border-slate-700/90 bg-[#0B0F17]/95 px-3.5 py-2.5 shadow-xl min-w-[190px]">
      <div className="text-[11px] font-mono font-semibold text-slate-300 pb-1.5 mb-1.5 border-b border-slate-800">
        {label === '1D' ? 'Past 24 Hours (1D)' : `Rolling ${label} Window`}
      </div>
      <div className="space-y-1">
        {sorted.map((entry) => (
          <div
            key={String(entry.dataKey)}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || '#F59E0B' }}
              />
              <span className="text-slate-200 truncate">{entry.name}</span>
            </div>
            <span className="font-mono tabular-nums font-semibold text-slate-50">
              {Number(entry.value).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WinRateTrendChart({
  trend,
  rankFilter,
  daysFilter,
  loading,
  heroCountLabel,
  onOpenHero,
}: WinRateTrendChartProps) {
  const [hoveredHeroId, setHoveredHeroId] = useState<number | null>(null);

  const windowSpanText =
    trend.windows.length >= 2
      ? `${trend.windows[0]}D → ${trend.windows[trend.windows.length - 1]}D`
      : `${daysFilter}D`;

  return (
    <section
      aria-label="Top 5 most popular heroes win rate trend"
      data-testid="win-rate-trend-chart"
      className="rounded-xl border border-slate-800/80 bg-[#111827] p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h2 className="font-display text-base sm:text-lg font-semibold text-slate-100">
              Win Rate Trend · Top 5 Most Popular Heroes
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {RANK_LABELS[rankFilter]} · {windowSpanText} rolling windows · Ranked by pick rate
            {heroCountLabel ? ` · ${heroCountLabel}` : ''}
          </p>
        </div>

        {loading && (
          <span className="text-xs font-mono text-amber-300/90">
            Updating trend windows…
          </span>
        )}
      </div>

      {trend.series.length === 0 ? (
        <div className="h-[250px] rounded-lg border border-slate-800/70 bg-[#0B0F17]/50 flex items-center justify-center text-sm text-slate-400">
          {loading
            ? 'Loading popularity and win rate curves…'
            : 'No matching heroes to plot for the current filter.'}
        </div>
      ) : (
        <>
          <div className="h-[260px] sm:h-[290px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={220}>
              <LineChart
                data={trend.dataPoints}
                margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  stroke="#1E293B"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="#64748B"
                  tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                <YAxis
                  domain={trend.yDomain}
                  stroke="#64748B"
                  width={48}
                  tickFormatter={(val: number) => `${val}%`}
                  tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTrendTooltip />}
                  cursor={{ stroke: '#475569', strokeDasharray: '3 3' }}
                />
                {trend.series.map((s) => {
                  const isDimmed = hoveredHeroId !== null && hoveredHeroId !== s.heroId;
                  const isHighlighted = hoveredHeroId === s.heroId;
                  return (
                    <Line
                      key={s.dataKey}
                      type="monotone"
                      dataKey={s.dataKey}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={isHighlighted ? 3.5 : 2.25}
                      strokeOpacity={isDimmed ? 0.25 : 1}
                      dot={{
                        r: isHighlighted ? 4.5 : 3.5,
                        fill: s.color,
                        stroke: '#0B0F17',
                        strokeWidth: 1.5,
                      }}
                      activeDot={{
                        r: 5.5,
                        fill: s.color,
                        stroke: '#F8FAFC',
                        strokeWidth: 1.5,
                      }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Top-5 Hero Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
            {trend.series.map((s) => {
              const deltaPositive = s.deltaWinRate > 0.005;
              const deltaNegative = s.deltaWinRate < -0.005;
              const deltaText = `${s.deltaWinRate > 0 ? '+' : ''}${s.deltaWinRate.toFixed(2)}%`;

              return (
                <button
                  key={s.heroId}
                  type="button"
                  onMouseEnter={() => setHoveredHeroId(s.heroId)}
                  onMouseLeave={() => setHoveredHeroId(null)}
                  onFocus={() => setHoveredHeroId(s.heroId)}
                  onBlur={() => setHoveredHeroId(null)}
                  onClick={() => onOpenHero(s.heroId)}
                  className={`text-left rounded-lg border p-2.5 flex items-center gap-2.5 transition-colors cursor-pointer ${
                    hoveredHeroId === s.heroId
                      ? 'border-slate-600 bg-slate-800/70'
                      : 'border-slate-800/90 bg-[#0B0F17]/75 hover:border-slate-700'
                  }`}
                >
                  <span
                    className="w-1 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden="true"
                  />
                  <SafeImage
                    src={s.head}
                    alt={s.name}
                    fallbackText={s.name}
                    size="sm"
                    className="w-8 h-8 rounded-md shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {s.name}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums mt-0.5">
                      <span className="text-slate-200 font-medium">
                        {s.latestWinRate.toFixed(2)}%
                      </span>
                      <span
                        className={
                          deltaPositive
                            ? 'text-emerald-400'
                            : deltaNegative
                              ? 'text-rose-400'
                              : 'text-slate-500'
                        }
                      >
                        {deltaText}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono tabular-nums text-slate-400">
                      Pick {formatPercent(s.pickRate)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
