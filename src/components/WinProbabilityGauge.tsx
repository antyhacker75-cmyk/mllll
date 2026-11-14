import type { WinVerdict } from '../types/mlbb';

interface WinProbabilityGaugeProps {
  winProbabilityPct: number;
  opponentProbabilityPct: number;
  verdict: WinVerdict;
  edgePct: number;
  hasTeams: boolean;
  allyCount: number;
  enemyCount: number;
}

export function WinProbabilityGauge({
  winProbabilityPct,
  opponentProbabilityPct,
  verdict,
  edgePct,
  hasTeams,
  allyCount,
  enemyCount,
}: WinProbabilityGaugeProps) {
  const clampedPct = Math.max(0, Math.min(100, winProbabilityPct));
  const oppPct = Math.max(0, Math.min(100, opponentProbabilityPct));

  // 180-degree semi-circular arc geometry with generous headroom for tick labels
  const cx = 150;
  const cy = 148;
  const radius = 100;
  const arcLength = Math.PI * radius; // ~314.16
  const dashOffset = arcLength * (1 - clampedPct / 100);

  // Polar point on arc: 0% -> left (pi), 50% -> top (pi/2), 100% -> right (0)
  const theta = Math.PI * (1 - clampedPct / 100);
  const markerX = cx + radius * Math.cos(theta);
  const markerY = cy - radius * Math.sin(theta);

  const isOneSided = verdict === 'Pick Opponent' || verdict === 'Pick Your Team';

  const tone = !hasTeams
    ? {
        stroke: '#475569',
        text: 'text-slate-300',
        barLeft: 'bg-slate-600',
        edgeLabel: 'Awaiting selection',
      }
    : isOneSided
      ? {
          stroke: '#F59E0B',
          text: 'text-amber-300',
          barLeft: 'bg-amber-400',
          edgeLabel: 'Meta baseline',
        }
      : clampedPct >= 54
        ? {
            stroke: '#10B981',
            text: 'text-emerald-400',
            barLeft: 'bg-emerald-500',
            edgeLabel: `+${edgePct.toFixed(1)}% vs even`,
          }
        : clampedPct > 46
          ? {
              stroke: '#F59E0B',
              text: 'text-amber-300',
              barLeft: 'bg-amber-400',
              edgeLabel:
                edgePct === 0
                  ? '50.0% balanced'
                  : `${edgePct > 0 ? '+' : ''}${edgePct.toFixed(1)}% vs even`,
            }
          : {
              stroke: '#F43F5E',
              text: 'text-rose-400',
              barLeft: 'bg-rose-500',
              edgeLabel: `${edgePct.toFixed(1)}% vs even`,
            };

  const ticks = [0, 25, 50, 75, 100];

  return (
    <div
      className="flex flex-col items-center justify-between h-full"
      data-testid="win-probability-gauge"
    >
      <div className="text-center space-y-1">
        <div className="text-xs font-medium text-slate-400">
          Predicted Win Probability
        </div>
        <div className="text-[11px] font-mono tabular-nums text-slate-500">
          {allyCount}v{enemyCount} draft comparison
        </div>
      </div>

      {/* Precision SVG Arc Gauge */}
      <div
        role="meter"
        aria-label="Predicted team win probability"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(clampedPct.toFixed(1))}
        aria-valuetext={`${clampedPct.toFixed(1)}% — ${verdict}`}
        className="relative w-full max-w-[290px] mx-auto my-2"
      >
        <svg
          viewBox="0 0 300 176"
          className="w-full h-auto"
          aria-hidden="true"
        >
          {/* Calibrated tick marks along outer rim */}
          {ticks.map((tick) => {
            const tAngle = Math.PI * (1 - tick / 100);
            const innerR = radius + 8;
            const outerR = tick === 50 ? radius + 16 : radius + 13;
            const labelR = radius + 24;
            const x1 = cx + innerR * Math.cos(tAngle);
            const y1 = cy - innerR * Math.sin(tAngle);
            const x2 = cx + outerR * Math.cos(tAngle);
            const y2 = cy - outerR * Math.sin(tAngle);
            const lx = cx + labelR * Math.cos(tAngle);
            const ly = cy - labelR * Math.sin(tAngle);

            return (
              <g key={tick}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={tick === 50 ? '#94A3B8' : '#334155'}
                  strokeWidth={tick === 50 ? 2 : 1.25}
                  strokeLinecap="round"
                />
                <text
                  x={lx}
                  y={ly + 3}
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Background track arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#1E293B"
            strokeWidth={16}
            strokeLinecap="round"
          />

          {/* Active probability arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={tone.stroke}
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 280ms cubic-bezier(0.16, 1, 0.3, 1), stroke 200ms ease' }}
          />

          {/* Indicator marker on the arc */}
          <circle
            cx={markerX}
            cy={markerY}
            r={6}
            fill="#0B0F17"
            stroke={tone.stroke}
            strokeWidth={3}
            style={{ transition: 'cx 280ms cubic-bezier(0.16, 1, 0.3, 1), cy 280ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </svg>

        {/* Numeric Readout inside gauge arch */}
        <div className="absolute inset-x-0 bottom-3 flex flex-col items-center text-center pointer-events-none">
          <div
            data-testid="gauge-percentage-value"
            className={`font-mono tabular-nums text-4xl sm:text-[42px] font-bold leading-none tracking-tight ${tone.text}`}
          >
            {hasTeams ? `${clampedPct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-xs font-medium text-slate-300 mt-1.5">
            {verdict}
          </div>
        </div>
      </div>

      {/* Head-to-Head Split Bar & Explicit Text Summary */}
      <div className="w-full space-y-2.5 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-300 font-medium">
            <span>Your Team</span>
            <span className={`font-mono tabular-nums font-semibold ${tone.text}`}>
              {hasTeams ? `${clampedPct.toFixed(1)}%` : '50.0%'}
            </span>
          </span>
          <span className="text-[11px] font-mono tabular-nums text-slate-400">
            {tone.edgeLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-300 font-medium">
            <span className="font-mono tabular-nums font-semibold text-slate-200">
              {hasTeams ? `${oppPct.toFixed(1)}%` : '50.0%'}
            </span>
            <span>Opponent</span>
          </span>
        </div>

        <div
          className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex"
          aria-hidden="true"
        >
          <div
            className={`h-full ${tone.barLeft} transition-[width] duration-300 ease-out`}
            style={{ width: `${hasTeams ? clampedPct : 50}%` }}
          />
          <div className="h-full flex-1 bg-rose-500/45" />
        </div>
      </div>
    </div>
  );
}
