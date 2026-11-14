import { useMemo, useState, FormEvent } from 'react';
import { ArrowRight, KeyRound, Search, UserCheck, Users } from 'lucide-react';
import { PLAYER_DIRECTORY } from '../data/playerDirectory';
import type { PlayerDossierData } from '../data/samplePlayer';
import type { HeroRankRecord, RankRecord } from '../types/mlbb';
import {
  type HeroMetadataSummary,
  formatWinRate,
  resolveRankFromLevel,
  validateAccountCredentials,
} from '../utils/mlbb';
import { searchPlayerDirectory } from '../utils/playerSearch';
import { FavoriteLineupPanel } from './FavoriteLineupPanel';
import { SafeImage } from './SafeImage';

interface AccountSearchSectionProps {
  gameVersion: string | null;
  rankRecords: RankRecord[];
  heroHeadMap: Map<number, string>;
  heroRanks: HeroRankRecord[];
  heroRanksLoading: boolean;
  positionMap: Map<number, HeroMetadataSummary>;
  onSendCode: (roleId: number, zoneId: number) => Promise<void>;
  onLogin: (roleId: number, zoneId: number, vc: number) => Promise<void>;
  onLoadSample: () => void;
  onSelectDossier: (dossier: PlayerDossierData) => void;
  onExploreMeta: () => void;
  onOpenHero: (heroId: number) => void;
}

export function AccountSearchSection({
  gameVersion,
  rankRecords,
  heroHeadMap,
  heroRanks,
  heroRanksLoading,
  positionMap,
  onSendCode,
  onLogin,
  onLoadSample,
  onSelectDossier,
  onExploreMeta,
  onOpenHero,
}: AccountSearchSectionProps) {
  const [roleId, setRoleId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [vc, setVc] = useState('');
  const [step, setStep] = useState<'credentials' | 'verify'>('credentials');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    roleId?: string;
    zoneId?: string;
    vc?: string;
  }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [accountQuery, setAccountQuery] = useState('');

  const matchingAccounts = useMemo(
    () => searchPlayerDirectory(PLAYER_DIRECTORY, accountQuery),
    [accountQuery],
  );

  const visibleAccounts = accountQuery.trim()
    ? matchingAccounts
    : matchingAccounts.slice(0, 8);

  const numericQueryMatch = accountQuery.trim().match(/^\d{4,12}$/)
    ? accountQuery.trim()
    : null;

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    setStatusMessage(null);

    const check = validateAccountCredentials(roleId, zoneId, '', false);
    if (!check.valid) {
      setFieldErrors({ roleId: check.roleIdError, zoneId: check.zoneIdError });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSendCode(Number(roleId.trim()), Number(zoneId.trim()));
      setStep('verify');
      setStatusMessage(
        'Verification code sent to your MLBB in-game mailbox. Enter the code below within 5 minutes.',
      );
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : 'Could not send verification code. Confirm your Game ID and Server ID.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyLogin(e: FormEvent) {
    e.preventDefault();
    setApiError(null);

    const check = validateAccountCredentials(roleId, zoneId, vc, true);
    if (!check.valid) {
      setFieldErrors({
        roleId: check.roleIdError,
        zoneId: check.zoneIdError,
        vc: check.vcError,
      });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await onLogin(Number(roleId.trim()), Number(zoneId.trim()), Number(vc.trim()));
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : 'Verification failed. Check the code in your in-game mail and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrefillId(idStr: string) {
    setRoleId(idStr);
    setStep('credentials');
    setApiError(null);
    setFieldErrors({});
    const zoneInput = document.getElementById('mlbb-zone-id');
    if (zoneInput instanceof HTMLInputElement) {
      zoneInput.focus();
      zoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-xl border border-slate-800/90 bg-[#111827]">
        {/* Generated arena backdrop with measured contrast scrim */}
        <img
          src="/src/assets/images/arena_crest_backdrop_1794669936975.jpg"
          alt="Obsidian arena architecture backdrop"
          className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none select-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0B0F17]/95 via-[#0B0F17]/88 to-[#0B0F17]/75"
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-10 items-stretch">
          {/* Left: Editorial headline & direct sample/meta actions */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>Mobile Legends: Bang Bang</span>
                <span aria-hidden="true">·</span>
                <span>Rone Arena Data</span>
                {gameVersion && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      Patch {gameVersion}
                    </span>
                  </>
                )}
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-50 leading-[1.12] max-w-2xl [text-wrap:balance]">
                Search any Mobile Legends player dossier
              </h1>

              <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                Look up verified career win rates, Mythic star progression, season match logs,
                frequent hero MMR, and duo squad synergy directly from Rone Arena.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onLoadSample}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-slate-800/90 text-slate-100 border border-slate-700 hover:bg-slate-700/80 hover:border-slate-600 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <UserCheck className="w-4 h-4 text-amber-400" />
                Load Sample Account
              </button>

              <button
                type="button"
                onClick={onExploreMeta}
                className="px-4 py-2.5 text-sm font-medium rounded-lg text-slate-300 hover:text-slate-50 hover:bg-slate-800/60 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Browse Hero Meta
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Real 2-step Account Verification Form */}
          <div className="lg:col-span-5 flex flex-col justify-center bg-[#0D131E]/90 border border-slate-800 rounded-xl p-6">
            <div className="mb-5">
              <h2 className="font-display text-lg font-semibold text-slate-100">
                {step === 'credentials' ? 'Player Account Verification' : 'Enter Verification Code'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {step === 'credentials'
                  ? 'Enter your Game ID and Server ID to receive a 1-time code in MLBB mail.'
                  : `Code dispatched to Game ID ${roleId} (Server ${zoneId}).`}
              </p>
            </div>

            {step === 'credentials' ? (
              <form onSubmit={handleSendCode} noValidate className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="mlbb-role-id"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Game ID (Role ID)
                    </label>
                    <input
                      id="mlbb-role-id"
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 184920312"
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.roleId)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg bg-[#0B0F17] border border-slate-700/90 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    {fieldErrors.roleId && (
                      <p role="alert" className="mt-1.5 text-xs text-rose-400">
                        {fieldErrors.roleId}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="mlbb-zone-id"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Server ID
                    </label>
                    <input
                      id="mlbb-zone-id"
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 2418"
                      value={zoneId}
                      onChange={(e) => setZoneId(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.zoneId)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg bg-[#0B0F17] border border-slate-700/90 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    {fieldErrors.zoneId && (
                      <p role="alert" className="mt-1.5 text-xs text-rose-400">
                        {fieldErrors.zoneId}
                      </p>
                    )}
                  </div>
                </div>

                {apiError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/70 text-xs text-rose-200"
                  >
                    {apiError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  <Search className="w-4 h-4" />
                  {submitting ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyLogin} noValidate className="space-y-4">
                {statusMessage && (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200">
                    {statusMessage}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="mlbb-vc-code"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    In-Game Verification Code
                  </label>
                  <input
                    id="mlbb-vc-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter 4-digit code"
                    value={vc}
                    onChange={(e) => setVc(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.vc)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg bg-[#0B0F17] border border-slate-700/90 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                  {fieldErrors.vc && (
                    <p role="alert" className="mt-1.5 text-xs text-rose-400">
                      {fieldErrors.vc}
                    </p>
                  )}
                </div>

                {apiError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/70 text-xs text-rose-200"
                  >
                    {apiError}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    {submitting ? 'Verifying...' : 'Verify & Load Stats'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setVc('');
                      setApiError(null);
                      setFieldErrors({});
                    }}
                    className="px-3.5 py-2.5 text-sm font-medium rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Edit ID
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Scouted Player Account Directory Search */}
      <section className="space-y-4" data-testid="account-directory-search">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <h2 className="font-display text-lg font-semibold text-slate-100">
                Search Player Accounts
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Search scouted players by IGN, Game ID, region (PH, ID, MY, SG), or main hero to inspect their career stats and match history.
            </p>
          </div>

          <div className="relative w-full sm:w-96">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search player accounts"
              placeholder="Search IGN, Game ID, region, or hero..."
              value={accountQuery}
              onChange={(e) => setAccountQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm rounded-lg bg-[#111827] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>
        </div>

        {visibleAccounts.length === 0 ? (
          <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-slate-200">
                No scouted profile matched "{accountQuery.trim()}".
              </p>
              <p className="text-xs text-slate-400">
                Personal or unlisted accounts can still be verified with a 1-time code via the MLBB in-game mailbox form above.
              </p>
            </div>
            {numericQueryMatch && (
              <button
                type="button"
                onClick={() => handlePrefillId(numericQueryMatch)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Verify Game ID {numericQueryMatch} via Mail
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleAccounts.map((entry) => {
              const rankInfo = resolveRankFromLevel(entry.info.rank_level, rankRecords);
              const wr = formatWinRate(entry.stats.wc, entry.stats.tc);
              const latestSeason = entry.seasons[0];
              const topHero = latestSeason
                ? entry.frequentBySeason[latestSeason]?.[0]
                : undefined;
              const topHeroPortrait = topHero
                ? heroHeadMap.get(topHero.hid) || topHero.hid_e?.ix
                : undefined;

              return (
                <div
                  key={`${entry.info.roleId}-${entry.info.zoneId}`}
                  className="rounded-xl border border-slate-800/80 bg-[#111827] p-4 flex flex-col justify-between gap-3.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <SafeImage
                        src={topHeroPortrait}
                        alt={entry.info.name}
                        fallbackText={entry.info.name}
                        size="sm"
                        className="w-10 h-10 rounded-lg border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-display font-semibold text-sm text-slate-100 truncate">
                          {entry.info.name}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400 truncate">
                          ID {entry.info.roleId} · {entry.info.reg_country}
                        </div>
                      </div>
                    </div>

                    <SafeImage
                      src={rankInfo.icon}
                      alt={rankInfo.fullLabel}
                      fallbackText={rankInfo.tierName}
                      size="sm"
                      className="w-7 h-7 rounded shrink-0"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/70 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500">Win Rate</div>
                      <div className="font-mono tabular-nums font-semibold text-emerald-400">
                        {wr}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Matches</div>
                      <div className="font-mono tabular-nums text-slate-200">
                        {entry.stats.tc.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Top Hero</div>
                      <div className="text-slate-200 truncate">
                        {topHero?.hid_e?.n || 'Flex'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectDossier(entry)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-700/80 bg-[#0B0F17] text-slate-100 hover:border-amber-400/70 hover:text-amber-300 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>View Stats</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <FavoriteLineupPanel
        heroRanks={heroRanks}
        heroRanksLoading={heroRanksLoading}
        positionMap={positionMap}
        onOpenHero={onOpenHero}
      />
    </div>
  );
}

