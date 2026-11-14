import { useCallback, useEffect, useState } from 'react';
import { RotateCw, ShieldAlert, Sparkles } from 'lucide-react';
import { fetchAiMatchupAnalysis } from '../services/roneApi';
import type {
  AiMatchupAnalysis,
  EquipmentRecord,
  HeroMatchupPayload,
} from '../types/mlbb';
import { SafeImage } from './SafeImage';

interface MatchupAnalysisSectionProps {
  payload: HeroMatchupPayload;
  equipmentList: EquipmentRecord[];
}

export function MatchupAnalysisSection({
  payload,
  equipmentList,
}: MatchupAnalysisSectionProps) {
  const [analysis, setAnalysis] = useState<AiMatchupAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(
    (forceRefresh: boolean) => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      if (forceRefresh) {
        setAnalysis(null);
      }

      fetchAiMatchupAnalysis(payload, forceRefresh)
        .then((res) => {
          if (!cancelled) {
            setAnalysis(res);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? err.message
                : 'Unable to generate AI Matchup Analysis.',
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    },
    [payload],
  );

  useEffect(() => {
    const cancel = runAnalysis(false);
    return cancel;
  }, [payload.heroId, payload.rankTier]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map equipment icon/type for AI item build advice when names align
  const equipLookup = new Map<string, EquipmentRecord>();
  for (const eq of equipmentList) {
    const k = (eq.data?.equipname || '').trim().toLowerCase();
    if (k) equipLookup.set(k, eq);
  }

  const displayItems =
    analysis?.itemBuildAdvice && analysis.itemBuildAdvice.length > 0
      ? analysis.itemBuildAdvice.map((advice) => {
          const baselineMatch = payload.counterItems.find(
            (b) => b.equipName.toLowerCase() === advice.itemName.toLowerCase(),
          );
          const equipMatch = equipLookup.get(advice.itemName.toLowerCase());
          return {
            equipName: equipMatch?.data.equipname || baselineMatch?.equipName || advice.itemName,
            icon: equipMatch?.data.equipicon || baselineMatch?.icon,
            typeLabel: equipMatch?.data.equiptypename || baselineMatch?.typeLabel || 'Counter',
            statsSummary: baselineMatch?.statsSummary || '',
            reason: advice.reason,
          };
        })
      : payload.counterItems;

  return (
    <section
      aria-label="Matchup Analysis"
      data-testid="matchup-analysis-section"
      className="rounded-xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h3 className="font-display text-sm sm:text-base font-semibold text-slate-100">
              Matchup Analysis
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 capitalize">
            Counterplay strategies vs {payload.heroName} · {payload.rankTier} tier
            {payload.winRatePct !== null ? ` · ${payload.winRatePct.toFixed(1)}% WR` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => runAnalysis(true)}
          disabled={loading}
          aria-label={`Refresh matchup analysis for ${payload.heroName}`}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Analyzing…' : 'Refresh'}</span>
        </button>
      </div>

      {/* AI Strategy Briefing */}
      {loading ? (
        <div className="space-y-2.5 rounded-lg border border-slate-800/80 bg-[#0B0F17]/70 p-3.5">
          <div className="h-3.5 w-3/4 rounded bg-slate-800 animate-pulse" />
          <div className="h-3.5 w-full rounded bg-slate-800 animate-pulse" />
          <div className="h-3.5 w-5/6 rounded bg-slate-800 animate-pulse" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-900/70 bg-rose-950/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => runAnalysis(true)}
            className="px-3 py-1.5 rounded-md bg-rose-900/50 hover:bg-rose-900/80 text-xs font-medium text-rose-100 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Retry Analysis
          </button>
        </div>
      ) : analysis ? (
        <div className="space-y-3 rounded-lg border border-slate-800/80 bg-[#0B0F17]/70 p-3.5">
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {analysis.overview}
          </p>

          {analysis.counterStrategies.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">
                Key Counterplay Tactics
              </div>
              <ul className="space-y-1 text-xs text-slate-300 leading-relaxed">
                {analysis.counterStrategies.map((tip, idx) => (
                  <li key={idx}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.draftVerdict && (
            <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400">
              <span className="font-medium text-slate-200">Draft Verdict: </span>
              {analysis.draftVerdict}
            </div>
          )}
        </div>
      ) : null}

      {/* Targeted Counter Items */}
      {displayItems.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-xs font-medium text-slate-300">
            Priority Counter Items vs {payload.heroName}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {displayItems.map((item) => (
              <div
                key={item.equipName}
                className="rounded-lg border border-slate-800/90 bg-[#0B0F17]/75 p-3 flex items-start gap-3"
              >
                <SafeImage
                  src={item.icon}
                  alt={item.equipName}
                  fallbackText={item.equipName}
                  size="sm"
                  className="w-9 h-9 rounded-lg border border-slate-700 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {item.equipName}
                    </span>
                    <span className="text-[11px] text-amber-300/90 shrink-0">
                      {item.typeLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug mt-1">
                    {item.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
