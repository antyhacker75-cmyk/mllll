import { useState, FormEvent } from 'react';
import { Calculator } from 'lucide-react';
import { calculateConsecutiveWins } from '../services/roneApi';
import type { WinRateCalcResponse } from '../types/mlbb';

export function WinRateCalculatorView() {
  const [matchNow, setMatchNow] = useState('500');
  const [wrNow, setWrNow] = useState('52.5');
  const [wrFuture, setWrFuture] = useState('60');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WinRateCalcResponse | null>(null);

  async function runCalculation(m: number, now: number, target: number) {
    setError(null);
    if (!Number.isFinite(m) || m < 1) {
      setError('Current matches must be at least 1.');
      return;
    }
    if (!Number.isFinite(now) || now <= 0 || now >= 100) {
      setError('Current win rate must be between 0.1% and 99.9%.');
      return;
    }
    if (!Number.isFinite(target) || target <= now || target >= 100) {
      setError('Target win rate must be higher than current win rate and below 100%.');
      return;
    }

    setLoading(true);
    try {
      const res = await calculateConsecutiveWins(m, now, target);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to calculate win streak.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runCalculation(Number(matchNow), Number(wrNow), Number(wrFuture));
  }

  const currentWins = Math.round((Number(matchNow) || 0) * ((Number(wrNow) || 0) / 100));

  return (
    <section className="space-y-6" data-testid="wr-calculator-view">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
          Target Win-Rate Calculator
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Calculate how many consecutive wins without a loss are required to reach your target hero or account win rate.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-6 rounded-xl border border-slate-800/80 bg-[#111827] p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="calc-matches"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Current Matches
              </label>
              <input
                id="calc-matches"
                type="number"
                min={1}
                value={matchNow}
                onChange={(e) => setMatchNow(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg bg-[#0B0F17] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label
                htmlFor="calc-wr-now"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Current WR (%)
              </label>
              <input
                id="calc-wr-now"
                type="number"
                step="0.1"
                value={wrNow}
                onChange={(e) => setWrNow(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg bg-[#0B0F17] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label
                htmlFor="calc-wr-target"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Target WR (%)
              </label>
              <input
                id="calc-wr-target"
                type="number"
                step="0.1"
                value={wrFuture}
                onChange={(e) => setWrFuture(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg bg-[#0B0F17] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">Presets:</span>
            {[
              { label: '500 games · 52.5% → 60%', m: '500', n: '52.5', f: '60' },
              { label: '200 games · 48% → 55%', m: '200', n: '48', f: '55' },
              { label: '1000 games · 58% → 65%', m: '1000', n: '58', f: '65' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setMatchNow(p.m);
                  setWrNow(p.n);
                  setWrFuture(p.f);
                  runCalculation(Number(p.m), Number(p.n), Number(p.f));
                }}
                className="px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/70 text-xs text-rose-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Calculator className="w-4 h-4" />
            {loading ? 'Calculating...' : 'Calculate Required Wins'}
          </button>
        </form>

        {/* Output Panel */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800/80 bg-[#111827] p-6 space-y-5">
          {result ? (
            <>
              <div>
                <div className="text-xs text-slate-400">Consecutive Wins Required</div>
                <div className="font-mono tabular-nums text-4xl font-bold text-amber-300 mt-1">
                  {result.required_no_lose_matches.toLocaleString()} wins
                </div>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  {result.message}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-5 border-t border-slate-800/80">
                <div>
                  <div className="text-xs text-slate-400">Estimated Wins Now</div>
                  <div className="font-mono tabular-nums text-lg font-semibold text-slate-100 mt-0.5">
                    {currentWins.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Projected Total</div>
                  <div className="font-mono tabular-nums text-lg font-semibold text-slate-100 mt-0.5">
                    {(result.match_now + result.required_no_lose_matches).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Target Rate</div>
                  <div className="font-mono tabular-nums text-lg font-semibold text-emerald-400 mt-0.5">
                    {result.wr_future.toFixed(1)}%
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center space-y-2">
              <div className="text-sm font-medium text-slate-200">
                Enter your match count and win-rate goal
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Click Calculate Required Wins or pick a preset to query Rone Arena's live win-rate projection endpoint.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
