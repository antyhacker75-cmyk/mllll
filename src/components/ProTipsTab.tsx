import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Compass, Layers, RotateCw, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import { fetchAiProTips } from '../services/roneApi';
import type { AiProTips, HeroMatchupPayload, HeroSkill } from '../types/mlbb';
import { SafeImage } from './SafeImage';

interface ProTipsTabProps {
  payload: HeroMatchupPayload;
  skills: HeroSkill[];
}

export function ProTipsTab({ payload, skills }: ProTipsTabProps) {
  const [proTips, setProTips] = useState<AiProTips | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProTips = useCallback(
    (forceRefresh: boolean) => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      if (forceRefresh) {
        setProTips(null);
      }

      fetchAiProTips(payload, forceRefresh)
        .then((res) => {
          if (!cancelled) {
            setProTips(res);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : 'Unable to generate AI Pro Tips.',
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
    const cancel = loadProTips(false);
    return cancel;
  }, [payload.heroId, payload.rankTier]); // eslint-disable-line react-hooks/exhaustive-deps

  function findSkillIcon(skillName: string, slot: string): string | undefined {
    const clean = skillName.trim().toLowerCase();
    const byName = skills.find(
      (s) => s.skillname.trim().toLowerCase() === clean || s.skillname.toLowerCase().includes(clean),
    );
    if (byName?.skillicon) return byName.skillicon;

    const s = slot.toLowerCase();
    if (s.includes('passive')) return skills[0]?.skillicon;
    if (s.includes('1')) return skills[1]?.skillicon;
    if (s.includes('2')) return skills[2]?.skillicon;
    if (s.includes('ult') || s.includes('3')) return skills[3]?.skillicon;
    return undefined;
  }

  return (
    <div data-testid="pro-tips-tab" className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 sm:p-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h3 className="font-display text-sm sm:text-base font-semibold text-slate-100">
              Pro Tips · Piloting {payload.heroName}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 capitalize">
            Ability leveling priority, combo execution, and positioning · {payload.rankTier} meta
            {payload.winRatePct !== null ? ` · ${payload.winRatePct.toFixed(1)}% WR` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadProTips(true)}
          disabled={loading}
          aria-label={`Refresh pro tips for ${payload.heroName}`}
          className="px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Generating…' : 'Refresh'}</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-24 rounded-xl bg-slate-800/50 animate-pulse" />
          <div className="h-44 rounded-xl bg-slate-800/50 animate-pulse" />
          <div className="h-32 rounded-xl bg-slate-800/50 animate-pulse" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-900/70 bg-rose-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadProTips(true)}
            className="px-3 py-1.5 rounded-md bg-rose-900/50 hover:bg-rose-900/80 text-xs font-medium text-rose-100 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Retry Pro Tips
          </button>
        </div>
      ) : proTips ? (
        <>
          {/* Playstyle Overview */}
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">
              Core Win Condition
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              {proTips.playstyleSummary}
            </p>
          </div>

          {/* Ability Leveling Priority */}
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                <h4 className="font-display text-sm font-semibold text-slate-100">
                  Ability Leveling Order
                </h4>
              </div>
              <span className="font-mono text-xs font-semibold text-amber-300">
                {proTips.skillPriority.orderLabel}
              </span>
            </div>

            <div className="divide-y divide-slate-800/70 rounded-lg border border-slate-800/80 bg-[#0B0F17]/70">
              {proTips.skillPriority.skillsToPrioritize.map((item, idx) => {
                const icon = findSkillIcon(item.skillName, item.slot);
                return (
                  <div
                    key={`${item.slot}-${idx}`}
                    className="p-3.5 flex items-start gap-3"
                  >
                    <SafeImage
                      src={icon}
                      alt={item.skillName}
                      fallbackText={item.slot}
                      size="sm"
                      className="w-9 h-9 rounded-lg border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-100">
                          {item.skillName}
                        </span>
                        <span className="text-[11px] font-mono text-amber-300/90 shrink-0">
                          {item.slot}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                        {item.reason}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommended Skill Combos */}
          {Array.isArray(proTips.recommendedCombos) && proTips.recommendedCombos.length > 0 && (
            <div
              data-testid="recommended-skill-combos"
              className="rounded-xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <h4 className="font-display text-sm font-semibold text-slate-100">
                    Recommended Skill Combos
                  </h4>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {proTips.recommendedCombos.length} sequences
                </span>
              </div>

              <div className="space-y-3">
                {proTips.recommendedCombos.map((combo, cIdx) => (
                  <div
                    key={`${combo.title}-${cIdx}`}
                    className="rounded-lg border border-slate-800/80 bg-[#0B0F17]/80 p-3.5 space-y-2.5"
                  >
                    <div className="text-xs font-semibold text-amber-300">
                      {combo.title}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {combo.sequence.map((step, sIdx) => {
                        const icon = findSkillIcon(step.label, step.slot);
                        return (
                          <div
                            key={`${step.slot}-${sIdx}`}
                            className="flex items-center gap-2"
                          >
                            <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-[#111827] px-2.5 py-1.5">
                              {icon ? (
                                <SafeImage
                                  src={icon}
                                  alt={step.label}
                                  fallbackText={step.slot}
                                  size="sm"
                                  className="w-6 h-6 rounded border border-slate-700 shrink-0"
                                />
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] font-semibold text-slate-300 shrink-0">
                                  {step.slot}
                                </span>
                              )}
                              <div className="min-w-0">
                                <div className="text-[11px] font-medium text-slate-100 whitespace-nowrap">
                                  {step.label}
                                </div>
                                {icon && (
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {step.slot}
                                  </div>
                                )}
                              </div>
                            </div>

                            {sIdx < combo.sequence.length - 1 && (
                              <ArrowRight
                                className="w-3.5 h-3.5 text-slate-500 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {combo.whenToUse}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teamfight Positioning */}
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <h4 className="font-display text-sm font-semibold text-slate-100">
                Teamfight Positioning
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {proTips.teamfightPositioning}
            </p>
          </div>

          {/* Combo & Execution + Power Spikes */}
          <div className="grid grid-cols-1 gap-4">
            {proTips.comboAndExecution.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <h4 className="font-display text-sm font-semibold text-slate-100">
                    Combo & Laning Execution
                  </h4>
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {proTips.comboAndExecution.map((tip, idx) => (
                    <li key={idx}>• {tip}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 sm:p-5 space-y-2">
              <h4 className="font-display text-sm font-semibold text-slate-100">
                Power Spikes & Macro Synergy
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {proTips.powerSpikesAndMacro}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
