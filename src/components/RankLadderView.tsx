import { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw, Search } from 'lucide-react';
import { PLAYER_DIRECTORY } from '../data/playerDirectory';
import type { PlayerDossierData } from '../data/samplePlayer';
import { TOP_TIER_LEADERBOARD } from '../data/topPlayers';
import type { RankRecord } from '../types/mlbb';
import { filterLeaderboardPlayers, resolveRankFromLevel } from '../utils/mlbb';
import { findPlayerInDirectory } from '../utils/playerSearch';
import { SafeImage } from './SafeImage';

interface RankLadderViewProps {
  rankRecords: RankRecord[];
  heroHeadMap: Map<number, string>;
  loading: boolean;
  onOpenHero: (heroId: number) => void;
  onSelectPlayerDossier?: (dossier: PlayerDossierData) => void;
}

const REGION_OPTIONS = [
  { id: 'all', label: 'All Regions' },
  { id: 'PH', label: 'PH · Philippines' },
  { id: 'ID', label: 'ID · Indonesia' },
  { id: 'MY', label: 'MY · Malaysia' },
  { id: 'SG', label: 'SG · Singapore' },
  { id: 'KH', label: 'KH · Cambodia' },
  { id: 'BR', label: 'BR · Brazil' },
  { id: 'EU', label: 'EU · Europe' },
];

export function RankLadderView({
  rankRecords,
  heroHeadMap,
  loading,
  onOpenHero,
  onSelectPlayerDossier,
}: RankLadderViewProps) {
  const [lookupLevel, setLookupLevel] = useState('204');
  const [leaderboardQuery, setLeaderboardQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');

  const parsedLevel = Math.max(1, Math.min(9999, Number(lookupLevel) || 1));
  const resolved = resolveRankFromLevel(parsedLevel, rankRecords);

  const filteredPlayers = useMemo(
    () => filterLeaderboardPlayers(TOP_TIER_LEADERBOARD, leaderboardQuery, regionFilter),
    [leaderboardQuery, regionFilter],
  );

  return (
    <section className="space-y-10" data-testid="rank-ladder-view">
      {/* Top-Tier Leaderboard Section with Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
              Rank Ladder & Top-Tier Leaderboard
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Filter top-tier Mythical Immortal players by player name, region, or signature hero, and inspect official rank star tiers.
            </p>
          </div>

          {/* Interactive Rank ID Inspector */}
          <div className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-800 bg-[#111827] self-start lg:self-auto">
            <div>
              <label
                htmlFor="rank-level-lookup"
                className="block text-[11px] font-medium text-slate-400 mb-1"
              >
                Inspect Rank Level ID
              </label>
              <input
                id="rank-level-lookup"
                type="number"
                min={1}
                max={9999}
                value={lookupLevel}
                onChange={(e) => setLookupLevel(e.target.value)}
                className="w-28 px-3 py-1.5 text-sm font-mono tabular-nums rounded-lg bg-[#0B0F17] border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <SafeImage
                src={resolved.icon}
                alt={resolved.fullLabel}
                fallbackText={resolved.tierName}
                className="w-10 h-10 rounded-lg"
              />
              <div>
                <div className="text-sm font-semibold text-amber-300">
                  {resolved.fullLabel}
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-400">
                  {resolved.stars !== null ? `${resolved.stars} Stars` : `Level ${parsedLevel}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Search Bar & Region Filter */}
        <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Filter leaderboard by player name or region"
              placeholder="Search player name, region (PH, ID, MY), or hero..."
              value={leaderboardQuery}
              onChange={(e) => setLeaderboardQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <div>
              <label htmlFor="leaderboard-region-select" className="sr-only">
                Filter by Region
              </label>
              <select
                id="leaderboard-region-select"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700/80 text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap">
              {filteredPlayers.length} players
            </span>
          </div>
        </div>

        {/* Top-Tier Leaderboard Table */}
        <div className="rounded-xl border border-slate-800/80 bg-[#111827] overflow-hidden">
          {filteredPlayers.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-slate-300">
                No top-tier players match your search or region filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLeaderboardQuery('');
                  setRegionFilter('all');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Leaderboard Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/90 text-xs font-medium text-slate-400">
                    <th className="py-3 px-4 w-12 text-right">#</th>
                    <th className="py-3 px-4">Player & Region</th>
                    <th className="py-3 px-4">Rank & Stars</th>
                    <th className="py-3 px-4">Signature Hero</th>
                    <th className="py-3 px-4 text-right hidden sm:table-cell">Win Rate</th>
                    <th className="py-3 px-4 text-right hidden md:table-cell">Peak MMR</th>
                    <th className="py-3 px-4 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredPlayers.map((player) => {
                    const playerRank = resolveRankFromLevel(player.rankLevel, rankRecords);
                    const heroHead = heroHeadMap.get(player.mainHeroId);
                    const playerProfile = findPlayerInDirectory(PLAYER_DIRECTORY, {
                      name: player.playerName,
                    });
                    return (
                      <tr
                        key={`${player.rank}-${player.playerName}`}
                        onClick={() => setLookupLevel(String(player.rankLevel))}
                        className="hover:bg-slate-800/45 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-slate-400">
                          {player.rank}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-100">
                            {player.playerName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {player.region} · {player.regionLabel}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <SafeImage
                              src={playerRank.icon}
                              alt={playerRank.fullLabel}
                              fallbackText={playerRank.tierName}
                              size="sm"
                              className="w-7 h-7 rounded-md"
                            />
                            <div>
                              <div className="text-xs font-medium text-amber-300">
                                {playerRank.fullLabel}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                {playerRank.stars} Stars
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenHero(player.mainHeroId);
                            }}
                            className="inline-flex items-center gap-2 text-left hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            <SafeImage
                              src={heroHead}
                              alt={player.mainHeroName}
                              fallbackText={player.mainHeroName}
                              size="sm"
                              className="w-7 h-7 rounded-md"
                            />
                            <span className="text-xs font-medium text-slate-200">
                              {player.mainHeroName}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-400 hidden sm:table-cell">
                          {player.winRate.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-300 hidden md:table-cell">
                          {player.mmr.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {playerProfile && onSelectPlayerDossier ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPlayerDossier(playerProfile);
                              }}
                              className="px-2.5 py-1 rounded-md border border-slate-700 bg-[#0B0F17] hover:border-amber-400/70 hover:text-amber-300 text-xs font-medium text-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Stats</span>
                              <ArrowRight className="w-3 h-3" aria-hidden="true" />
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
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

      {/* Official 29-Tier Rank Progression */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-100">
            Official Rank Tier Progression
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any tier to inspect its exact Rank ID range and star mapping.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rankRecords.map((rec) => {
              const labelInfo = resolveRankFromLevel(rec.data.rankid_start, rankRecords);
              const isMatched =
                parsedLevel >= rec.data.rankid_start && parsedLevel <= rec.data.rankid_end;
              const isMythic = rec.data.rankid_start >= 136;
              const rangeText = isMythic
                ? rec.data.rankid_end >= 9999
                  ? `${rec.data.rankid_start - 136}+ Stars`
                  : `${rec.data.rankid_start - 136}–${rec.data.rankid_end - 136} Stars`
                : `Rank ID ${rec.data.rankid_start}–${rec.data.rankid_end}`;

              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setLookupLevel(String(rec.data.rankid_start))}
                  className={`text-left p-4 rounded-xl border transition-colors flex items-center gap-3.5 cursor-pointer ${
                    isMatched
                      ? 'border-amber-400/80 bg-amber-500/10'
                      : 'border-slate-800/80 bg-[#111827] hover:border-slate-700'
                  }`}
                >
                  <SafeImage
                    src={rec.data.icon}
                    alt={labelInfo.fullLabel}
                    fallbackText={labelInfo.tierName}
                    className="w-12 h-12 rounded-lg"
                  />
                  <div className="min-w-0">
                    <div className="font-display text-sm font-semibold text-slate-100 truncate">
                      {labelInfo.fullLabel}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-amber-300/90 mt-0.5">
                      {rangeText}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                      ID {rec.data.rankid_start}–{rec.data.rankid_end}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
