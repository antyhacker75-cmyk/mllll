import { useMemo, useState } from 'react';
import { Award, Clock, Flame, Search, Swords, Trophy, Users } from 'lucide-react';
import { PLAYER_DIRECTORY } from '../data/playerDirectory';
import type { PlayerDossierData } from '../data/samplePlayer';
import type { RankRecord, StatHighlight } from '../types/mlbb';
import {
  formatBattleScore,
  formatKda,
  formatRelativeTime,
  formatWinRate,
  getLaneLabel,
  resolveRankFromLevel,
} from '../utils/mlbb';
import { findPlayerInDirectory, searchPlayerDirectory } from '../utils/playerSearch';
import { SafeImage } from './SafeImage';

interface PlayerDossierViewProps {
  dossier: PlayerDossierData;
  selectedSeason: number;
  onSelectSeason: (sid: number) => void;
  rankRecords: RankRecord[];
  heroHeadMap: Map<number, string>;
  onOpenHero: (heroId: number) => void;
  onSelectDossier: (dossier: PlayerDossierData) => void;
  onResetAccount: () => void;
  loadingSeasonData?: boolean;
}

export function PlayerDossierView({
  dossier,
  selectedSeason,
  onSelectSeason,
  rankRecords,
  heroHeadMap,
  onOpenHero,
  onSelectDossier,
  onResetAccount,
  loadingSeasonData = false,
}: PlayerDossierViewProps) {
  const { info, stats, seasons, matchesBySeason, frequentBySeason, friends } = dossier;
  const currentRank = resolveRankFromLevel(info.rank_level, rankRecords);
  const peakRank = resolveRankFromLevel(info.history_rank_level, rankRecords);
  const [switchQuery, setSwitchQuery] = useState('');

  const otherAccounts = useMemo(() => {
    const filtered = searchPlayerDirectory(PLAYER_DIRECTORY, switchQuery).filter(
      (entry) => entry.info.roleId !== info.roleId,
    );
    return switchQuery.trim() ? filtered.slice(0, 6) : filtered.slice(0, 4);
  }, [switchQuery, info.roleId]);

  const matches = matchesBySeason[selectedSeason] || [];
  const frequentHeroes = frequentBySeason[selectedSeason] || [];
  const winRate = formatWinRate(stats.wc, stats.tc);
  const mvpRate = formatWinRate(stats.mvpc, stats.tc);
  const avgScore = formatBattleScore(stats.as);

  const highlights: Array<{ label: string; item?: StatHighlight; formatValue: (v: number) => string }> = [
    { label: 'Highest Kills', item: stats.hk, formatValue: (v) => `${v} kills` },
    { label: 'Most Assists', item: stats.ma, formatValue: (v) => `${v} assists` },
    { label: 'Top Match Score', item: stats.ms, formatValue: (v) => `${formatBattleScore(v)} rating` },
    { label: 'Most Gold Earned', item: stats.mg, formatValue: (v) => `${v.toLocaleString()} gold` },
    { label: 'Highest Hero Damage', item: stats.mtd, formatValue: (v) => `${v.toLocaleString()} dmg` },
    { label: 'Most Damage Taken', item: stats.mdt, formatValue: (v) => `${v.toLocaleString()} tanked` },
  ];

  const modeLabel =
    dossier.mode === 'sample'
      ? 'Sample Dossier Preview'
      : dossier.mode === 'directory'
        ? 'Scouted Player Profile'
        : 'Verified Player Account';

  const topHeroEntry =
    frequentHeroes[0] ||
    (seasons[0] ? frequentBySeason[seasons[0]]?.[0] : undefined);
  const primaryAvatar =
    info.avatar ||
    (topHeroEntry ? heroHeadMap.get(topHeroEntry.hid) || topHeroEntry.hid_e?.ix : undefined);

  return (
    <div className="space-y-8" data-testid="player-dossier">
      {/* Inline Search Another Account Bar */}
      <section
        data-testid="dossier-account-switcher"
        className="rounded-xl border border-slate-800/80 bg-[#0F1521] p-4 space-y-3"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search another player account"
              placeholder="Search another account by name, ID, region, or hero..."
              value={switchQuery}
              onChange={(e) => setSwitchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 mr-1">
              {switchQuery.trim() ? 'Matching accounts:' : 'Quick scout:'}
            </span>
            {otherAccounts.length === 0 ? (
              <span className="text-xs text-slate-400">
                No matching scouted profile.
              </span>
            ) : (
              otherAccounts.map((acc) => {
                const topHero = acc.frequentBySeason[acc.seasons[0]]?.[0];
                const topHead = topHero
                  ? heroHeadMap.get(topHero.hid) || topHero.hid_e?.ix
                  : undefined;
                return (
                  <button
                    key={acc.info.roleId}
                    type="button"
                    onClick={() => {
                      onSelectDossier(acc);
                      setSwitchQuery('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-[#111827] hover:border-amber-400/70 hover:text-amber-300 transition-colors inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer"
                  >
                    <SafeImage
                      src={topHead}
                      alt={acc.info.name}
                      fallbackText={acc.info.name}
                      size="sm"
                      className="w-5 h-5 rounded"
                    />
                    <span className="font-medium">{acc.info.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {acc.info.reg_country}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Player Identity & Rank Header */}
      <section className="rounded-xl border border-slate-800/90 bg-[#111827] p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <SafeImage
              src={primaryAvatar}
              alt={`${info.name} avatar`}
              fallbackText={info.name}
              size="lg"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-slate-700"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{modeLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  ID {info.roleId} ({info.zoneId})
                </span>
                <span aria-hidden="true">·</span>
                <span>Region {info.reg_country || 'Global'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Lv. {info.level}</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 mt-1 truncate">
                {info.name}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-800">
            {/* Current Rank */}
            <div className="flex items-center gap-3">
              <SafeImage
                src={currentRank.icon}
                alt={currentRank.fullLabel}
                fallbackText={currentRank.tierName}
                className="w-12 h-12 rounded-lg"
              />
              <div>
                <div className="text-xs text-slate-400">Current Rank</div>
                <div className="font-display text-base font-semibold text-amber-300">
                  {currentRank.fullLabel}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-300">
                  {currentRank.stars !== null ? `${currentRank.stars} Stars` : `Level ${info.rank_level}`}
                </div>
              </div>
            </div>

            <div className="hidden sm:block h-10 w-px bg-slate-800" aria-hidden="true" />

            {/* Peak Rank */}
            <div className="flex items-center gap-3">
              <SafeImage
                src={peakRank.icon}
                alt={peakRank.fullLabel}
                fallbackText={peakRank.tierName}
                className="w-10 h-10 rounded-lg opacity-90"
              />
              <div>
                <div className="text-xs text-slate-400">Peak Historical</div>
                <div className="text-sm font-semibold text-slate-100">
                  {peakRank.fullLabel}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-400">
                  {peakRank.stars !== null ? `${peakRank.stars} Stars` : `Level ${info.history_rank_level}`}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onResetAccount}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Change Account
            </button>
          </div>
        </div>

        {/* 4-column Career KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-slate-400" />
              Career Matches
            </div>
            <div className="font-mono tabular-nums text-2xl font-semibold text-slate-50 mt-1">
              {stats.tc.toLocaleString()}
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">
              {stats.wc.toLocaleString()} wins · {(stats.tc - stats.wc).toLocaleString()} losses
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Overall Win Rate
            </div>
            <div className="font-mono tabular-nums text-2xl font-semibold text-emerald-400 mt-1">
              {winRate}
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">
              Avg rating {avgScore} / 10
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              MVP Honors
            </div>
            <div className="font-mono tabular-nums text-2xl font-semibold text-slate-50 mt-1">
              {stats.mvpc.toLocaleString()}
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">
              {mvpRate} MVP rate
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Best Win Streak
            </div>
            <div className="font-mono tabular-nums text-2xl font-semibold text-slate-50 mt-1">
              {stats.wsc}
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {stats.gt.toLocaleString()}h played
            </div>
          </div>
        </div>
      </section>

      {/* Career Hero Highlights */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-display text-lg font-semibold text-slate-100">
            Career Single-Match Records
          </h3>
          <span className="text-xs text-slate-400">
            Click any hero to inspect full meta stats
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {highlights
            .filter((h) => Boolean(h.item))
            .map(({ label, item, formatValue }) => {
              const rec = item!;
              const portrait = heroHeadMap.get(rec.hid) || rec.ix;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onOpenHero(rec.hid)}
                  className="text-left p-4 rounded-xl border border-slate-800/80 bg-[#111827] hover:border-slate-700 hover:bg-[#151D2E] transition-colors flex items-center gap-3.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <SafeImage
                    src={portrait}
                    alt={rec.n}
                    fallbackText={rec.n}
                    className="w-12 h-12 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-400">{label}</div>
                    <div className="font-mono tabular-nums text-base font-semibold text-slate-50 mt-0.5">
                      {formatValue(rec.v)}
                    </div>
                    <div className="text-xs text-amber-300/90 mt-0.5 truncate">
                      {rec.n}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </section>

      {/* Season Filter Header */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-100">
              Season Performance Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Frequent hero MMR and recent match history filtered by ranked season.
            </p>
          </div>

          <div
            role="group"
            aria-label="Season selector"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-slate-800 self-start"
          >
            {seasons.map((sid) => {
              const active = sid === selectedSeason;
              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => onSelectSeason(sid)}
                  className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/70'
                  }`}
                >
                  Season {sid}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Frequent Heroes Table */}
          <div className="xl:col-span-5 rounded-xl border border-slate-800/80 bg-[#111827] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <h4 className="font-display text-sm font-semibold text-slate-100">
                Top Heroes · Season {selectedSeason}
              </h4>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {frequentHeroes.length} heroes
              </span>
            </div>

            {loadingSeasonData ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 rounded bg-slate-800/60 animate-pulse" />
                ))}
              </div>
            ) : frequentHeroes.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No frequent hero records logged for Season {selectedSeason}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-[11px] font-medium text-slate-400">
                      <th className="py-2.5 px-4">Hero</th>
                      <th className="py-2.5 px-3 text-right">Matches</th>
                      <th className="py-2.5 px-3 text-right">Win Rate</th>
                      <th className="py-2.5 px-4 text-right">MMR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {frequentHeroes.map((h) => {
                      const heroName = h.hid_e?.n || `Hero #${h.hid}`;
                      const portrait = heroHeadMap.get(h.hid) || h.hid_e?.ix;
                      const wr = h.tc > 0 ? (h.wc / h.tc) * 100 : 0;
                      return (
                        <tr
                          key={h.hid}
                          onClick={() => onOpenHero(h.hid)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <SafeImage
                                src={portrait}
                                alt={heroName}
                                fallbackText={heroName}
                                size="sm"
                                className="w-8 h-8 rounded-md"
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-100 truncate">
                                  {heroName}
                                </div>
                                <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                  Avg {formatBattleScore(h.bs)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                            {h.tc}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono tabular-nums font-medium ${
                              wr >= 55
                                ? 'text-emerald-400'
                                : wr < 48
                                  ? 'text-rose-400'
                                  : 'text-slate-200'
                            }`}
                          >
                            {wr.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-300">
                            {h.p.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Match History Table */}
          <div className="xl:col-span-7 rounded-xl border border-slate-800/80 bg-[#111827] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <h4 className="font-display text-sm font-semibold text-slate-100">
                Recent Match Log · Season {selectedSeason}
              </h4>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {matches.length} matches
              </span>
            </div>

            {loadingSeasonData ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 rounded bg-slate-800/60 animate-pulse" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No recent matches found for Season {selectedSeason}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-[11px] font-medium text-slate-400">
                      <th className="py-2.5 px-4">Result</th>
                      <th className="py-2.5 px-3">Hero & Lane</th>
                      <th className="py-2.5 px-3 text-right">K / D / A</th>
                      <th className="py-2.5 px-3 text-right">Score</th>
                      <th className="py-2.5 px-4 text-right">Played</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {matches.map((m) => {
                      const heroName = m.hid_e?.n || `Hero #${m.hid}`;
                      const portrait = heroHeadMap.get(m.hid) || m.hid_e?.ix;
                      const isWin = m.res === 1;
                      const { kdaText, ratio } = formatKda(m.k, m.d, m.a);
                      return (
                        <tr
                          key={m.bid_s || m.bid}
                          onClick={() => onOpenHero(m.hid)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span
                              className={`font-mono text-xs font-semibold ${
                                isWin ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isWin ? 'WIN' : 'LOSS'}
                            </span>
                            {m.mvp === 1 && (
                              <span className="ml-2 text-[11px] font-semibold text-amber-300">
                                MVP
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <SafeImage
                                src={portrait}
                                alt={heroName}
                                fallbackText={heroName}
                                size="sm"
                                className="w-8 h-8 rounded-md"
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-100 truncate">
                                  {heroName}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {getLaneLabel(m.lid)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <div className="text-slate-100">{kdaText}</div>
                            <div className="text-[11px] text-slate-400">{ratio} KDA</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                            {formatBattleScore(m.s)}
                          </td>
                          <td className="py-2.5 px-4 text-right text-xs text-slate-400 whitespace-nowrap">
                            {formatRelativeTime(m.ts)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Duo & Squad Synergy */}
      {friends.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <h3 className="font-display text-lg font-semibold text-slate-100">
              Frequent Squad Teammates
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {friends.slice(0, 6).map((fr) => {
              const name = fr.f?.n || `Player ${fr.frid}`;
              const duoWr = formatWinRate(fr.twc, fr.tbc);
              const matchedProfile = findPlayerInDirectory(PLAYER_DIRECTORY, {
                roleId: fr.frid,
                name,
              });
              const topTeammateHero = matchedProfile
                ? matchedProfile.frequentBySeason[matchedProfile.seasons[0]]?.[0]
                : undefined;
              const teammateAvatar =
                fr.f?.ax ||
                (topTeammateHero
                  ? heroHeadMap.get(topTeammateHero.hid) || topTeammateHero.hid_e?.ix
                  : undefined);

              if (matchedProfile) {
                return (
                  <button
                    key={`${fr.frid}-${fr.fzid}`}
                    type="button"
                    onClick={() => onSelectDossier(matchedProfile)}
                    className="w-full text-left p-4 rounded-xl border border-slate-800/80 bg-[#111827] hover:border-amber-400/70 hover:bg-[#151D2E] transition-colors flex items-center justify-between gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SafeImage
                        src={teammateAvatar}
                        alt={name}
                        fallbackText={name}
                        size="sm"
                        className="w-10 h-10 rounded-lg"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-100 truncate">
                          {name}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-slate-400">
                          ID {fr.frid} · View Stats
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-sm font-semibold text-emerald-400">
                        {duoWr}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        {fr.tbc} games
                      </div>
                    </div>
                  </button>
                );
              }

              return (
                <div
                  key={`${fr.frid}-${fr.fzid}`}
                  className="p-4 rounded-xl border border-slate-800/80 bg-[#111827] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SafeImage
                      src={teammateAvatar}
                      alt={name}
                      fallbackText={name}
                      size="sm"
                      className="w-10 h-10 rounded-lg"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-slate-100 truncate">
                        {name}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-400">
                        ID {fr.frid} · Lv. {fr.cl || fr.l || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums text-sm font-semibold text-emerald-400">
                      {duoWr}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400">
                      {fr.tbc} games
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
