import { useMemo, useState, FormEvent } from 'react';
import { ArrowRight, BookmarkPlus, Check, Layers, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import type {
  FavoriteHeroLineup,
  HeroRankRecord,
  RoleFilter,
} from '../types/mlbb';
import {
  MAX_LINEUP_SIZE,
  addHeroToLineup,
  buildHeroRosterForLineup,
  calculateLineupWinRate,
  createSavedLineup,
  filterHeroRosterForLineup,
  loadSavedLineupsFromStorage,
  persistSavedLineupsToStorage,
  removeHeroFromLineup,
  resolveLineupHeroes,
  validateLineupForSave,
} from '../utils/favoriteLineup';
import type { HeroMetadataSummary } from '../utils/mlbb';
import { SafeImage } from './SafeImage';

interface FavoriteLineupPanelProps {
  heroRanks: HeroRankRecord[];
  heroRanksLoading: boolean;
  positionMap: Map<number, HeroMetadataSummary>;
  onOpenHero: (heroId: number) => void;
  draftHeroIds?: number[];
  onChangeDraftHeroIds?: (next: number[]) => void;
  savedLineups?: FavoriteHeroLineup[];
  onChangeSavedLineups?: (next: FavoriteHeroLineup[]) => void;
  onPredictMatchup?: (heroIds: number[]) => void;
}

const ROLE_FILTERS: Array<{ id: RoleFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tank', label: 'Tank' },
  { id: 'fighter', label: 'Fighter' },
  { id: 'assassin', label: 'Assassin' },
  { id: 'mage', label: 'Mage' },
  { id: 'marksman', label: 'Marksman' },
  { id: 'support', label: 'Support' },
];

export function FavoriteLineupPanel({
  heroRanks,
  heroRanksLoading,
  positionMap,
  onOpenHero,
  draftHeroIds: controlledDraftIds,
  onChangeDraftHeroIds,
  savedLineups: controlledSavedLineups,
  onChangeSavedLineups,
  onPredictMatchup,
}: FavoriteLineupPanelProps) {
  const [internalDraftIds, setInternalDraftIds] = useState<number[]>([]);
  const [lineupName, setLineupName] = useState('');
  const [heroQuery, setHeroQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [internalSavedLineups, setInternalSavedLineups] = useState<FavoriteHeroLineup[]>(() =>
    loadSavedLineupsFromStorage(),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const draftHeroIds = controlledDraftIds ?? internalDraftIds;
  const savedLineups = controlledSavedLineups ?? internalSavedLineups;

  function setDraftHeroIds(updater: number[] | ((prev: number[]) => number[])) {
    const next = typeof updater === 'function' ? updater(draftHeroIds) : updater;
    if (onChangeDraftHeroIds) {
      onChangeDraftHeroIds(next);
    } else {
      setInternalDraftIds(next);
    }
  }

  function setSavedLineups(next: FavoriteHeroLineup[]) {
    if (onChangeSavedLineups) {
      onChangeSavedLineups(next);
    } else {
      setInternalSavedLineups(next);
    }
  }

  const roster = useMemo(
    () => buildHeroRosterForLineup(heroRanks, positionMap),
    [heroRanks, positionMap],
  );

  const filteredRoster = useMemo(
    () => filterHeroRosterForLineup(roster, heroQuery, roleFilter),
    [roster, heroQuery, roleFilter],
  );

  const activeHeroes = useMemo(
    () => resolveLineupHeroes(draftHeroIds, heroRanks, positionMap),
    [draftHeroIds, heroRanks, positionMap],
  );

  const activeSummary = useMemo(
    () => calculateLineupWinRate(activeHeroes),
    [activeHeroes],
  );

  const isLineupFull = draftHeroIds.length >= MAX_LINEUP_SIZE;

  function handleToggleHero(heroId: number) {
    setFormError(null);
    setStatusNote(null);
    setDraftHeroIds((prev) =>
      prev.includes(heroId)
        ? removeHeroFromLineup(prev, heroId)
        : addHeroToLineup(prev, heroId, MAX_LINEUP_SIZE),
    );
  }

  function handleRemoveHero(heroId: number) {
    setFormError(null);
    setStatusNote(null);
    setDraftHeroIds((prev) => removeHeroFromLineup(prev, heroId));
  }

  function handleClearDraft() {
    setDraftHeroIds([]);
    setLineupName('');
    setFormError(null);
    setStatusNote(null);
  }

  function handleSaveLineup(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setStatusNote(null);

    const check = validateLineupForSave(lineupName, draftHeroIds, savedLineups.length);
    if (!check.valid) {
      setFormError(check.error || 'Unable to save lineup.');
      return;
    }

    const nextEntry = createSavedLineup(check.resolvedName, activeHeroes);
    const nextList = [nextEntry, ...savedLineups];
    setSavedLineups(nextList);
    persistSavedLineupsToStorage(nextList);
    setLineupName('');

    const wrText =
      activeSummary.averageWinRatePct !== null
        ? `${activeSummary.averageWinRatePct.toFixed(2)}% avg win rate`
        : 'win rate pending';
    setStatusNote(`Saved "${check.resolvedName}" (${wrText}).`);
  }

  function handleLoadLineup(lineup: FavoriteHeroLineup) {
    setDraftHeroIds(lineup.heroIds.slice(0, MAX_LINEUP_SIZE));
    setLineupName(lineup.name);
    setFormError(null);
    setStatusNote(`Loaded "${lineup.name}" into the lineup calculator.`);
  }

  function handleDeleteLineup(lineupId: string, name: string) {
    const nextList = savedLineups.filter((item) => item.id !== lineupId);
    setSavedLineups(nextList);
    persistSavedLineupsToStorage(nextList);
    setStatusNote(`Removed "${name}" from saved lineups.`);
  }

  const slotIndices = [0, 1, 2, 3, 4];

  return (
    <section className="space-y-4" data-testid="favorite-lineup-section">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Favorite Hero Lineup &amp; Team Win Rate
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Assemble up to 5 favorite heroes, calculate the live average win rate of your team composition, and save lineups for quick access.
          </p>
        </div>

        <div className="flex items-baseline gap-3 shrink-0" data-testid="lineup-avg-wr-header">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Composition Avg Win Rate</div>
            <div className="flex items-baseline justify-end gap-2">
              <span
                className={`font-mono tabular-nums text-2xl font-bold ${
                  activeSummary.averageWinRatePct === null
                    ? 'text-slate-400'
                    : activeSummary.averageWinRatePct >= 50
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                }`}
              >
                {activeSummary.averageWinRatePct !== null
                  ? `${activeSummary.averageWinRatePct.toFixed(2)}%`
                  : '—'}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {activeSummary.heroCount} / {MAX_LINEUP_SIZE} heroes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Single-Elevation Workspace Container */}
      <div className="rounded-xl border border-slate-800/90 bg-[#111827]">
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
          {/* Left: 5-Slot Active Lineup & Composition Stats */}
          <div className="lg:col-span-7 p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Active Team Composition
              </h3>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {activeSummary.deltaFromFiftyPct !== null
                  ? `${activeSummary.deltaFromFiftyPct >= 0 ? '+' : ''}${activeSummary.deltaFromFiftyPct.toFixed(2)}% vs 50.0% baseline`
                  : 'Select 1–5 heroes from the roster'}
              </span>
            </div>

            {/* 5 Squad Slots */}
            <div className="divide-y divide-slate-800/70 border-y border-slate-800/70" data-testid="active-lineup-slots">
              {slotIndices.map((idx) => {
                const hero = activeHeroes[idx];
                if (!hero) {
                  return (
                    <div
                      key={`empty-slot-${idx}`}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs text-slate-500"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-lg border border-dashed border-slate-700/80 bg-[#0B0F17]/50 flex items-center justify-center font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                          {idx + 1}
                        </span>
                        <span>Empty squad slot — pick a hero from the roster</span>
                      </div>
                    </div>
                  );
                }

                const roleLine = [
                  hero.roles[0] ? hero.roles[0] : 'Flex',
                  hero.lanes[0] ? hero.lanes[0] : null,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div
                    key={hero.heroId}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SafeImage
                        src={hero.head}
                        alt={hero.name}
                        fallbackText={hero.name}
                        size="sm"
                        className="w-9 h-9 rounded-lg border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenHero(hero.heroId)}
                          className="font-medium text-sm text-slate-100 hover:text-amber-300 transition-colors truncate block text-left cursor-pointer"
                        >
                          {hero.name}
                        </button>
                        <div className="text-[11px] text-slate-400 capitalize truncate">
                          {roleLine}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div
                          className={`font-mono tabular-nums text-xs font-semibold ${
                            hero.winRatePct === null
                              ? 'text-slate-400'
                              : hero.winRatePct >= 50
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                          }`}
                        >
                          {hero.winRatePct !== null ? `${hero.winRatePct.toFixed(2)}% WR` : 'N/A'}
                        </div>
                        <div className="text-[10px] font-mono tabular-nums text-slate-500">
                          {hero.banRatePct !== null ? `Ban ${hero.banRatePct.toFixed(1)}%` : 'Live rate'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveHero(hero.heroId)}
                        aria-label={`Remove ${hero.name} from lineup`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Composition Metrics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-[11px] text-slate-400">Average Win Rate</div>
                <div
                  className={`font-mono tabular-nums text-base font-semibold mt-0.5 ${
                    activeSummary.averageWinRatePct === null
                      ? 'text-slate-400'
                      : activeSummary.averageWinRatePct >= 50
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                  }`}
                >
                  {activeSummary.averageWinRatePct !== null
                    ? `${activeSummary.averageWinRatePct.toFixed(2)}%`
                    : '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400">Avg Pick / Ban</div>
                <div className="font-mono tabular-nums text-sm font-medium text-slate-200 mt-0.5">
                  {activeSummary.averagePickRatePct !== null
                    ? `${activeSummary.averagePickRatePct.toFixed(2)}% / ${activeSummary.averageBanRatePct?.toFixed(1) ?? '0.0'}%`
                    : '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400">Highest WR Hero</div>
                <div className="text-sm font-medium text-slate-200 truncate mt-0.5">
                  {activeSummary.highestWrHero
                    ? `${activeSummary.highestWrHero.name} (${activeSummary.highestWrHero.winRatePct.toFixed(1)}%)`
                    : '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400">Role Coverage</div>
                <div className="text-sm text-slate-200 truncate mt-0.5">
                  {activeSummary.roleCoverage.length > 0
                    ? activeSummary.roleCoverage.slice(0, 3).join(', ') +
                      (activeSummary.roleCoverage.length > 3
                        ? ` +${activeSummary.roleCoverage.length - 3}`
                        : '')
                    : '—'}
                </div>
              </div>
            </div>

            {/* Save Lineup Form */}
            <form onSubmit={handleSaveLineup} noValidate className="pt-4 border-t border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="favorite-lineup-name"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Lineup Name
                  </label>
                  <input
                    id="favorite-lineup-name"
                    type="text"
                    maxLength={60}
                    placeholder={`e.g. Mythic 5-Man Squad (optional)`}
                    value={lineupName}
                    onChange={(e) => {
                      setLineupName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700/90 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <BookmarkPlus className="w-4 h-4" aria-hidden="true" />
                    <span>Save Lineup</span>
                  </button>

                  {onPredictMatchup && (
                    <button
                      type="button"
                      onClick={() => onPredictMatchup(draftHeroIds)}
                      className="px-3.5 py-2 text-sm font-medium rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <span>Predict vs Opponent</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleClearDraft}
                    disabled={draftHeroIds.length === 0 && !lineupName.trim()}
                    className="px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {formError && (
                <p role="alert" className="text-xs text-rose-400">
                  {formError}
                </p>
              )}

              {statusNote && !formError && (
                <p role="status" className="text-xs text-emerald-400">
                  {statusNote}
                </p>
              )}
            </form>
          </div>

          {/* Right: Searchable Hero Roster Picker */}
          <div className="lg:col-span-5 p-6 space-y-4 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Hero Roster
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {draftHeroIds.length} / {MAX_LINEUP_SIZE} selected
              </span>
            </div>

            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search heroes to add to lineup"
                placeholder="Search hero name..."
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[#0B0F17] border border-slate-700/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter heroes by role">
              {ROLE_FILTERS.map((rf) => {
                const active = roleFilter === rf.id;
                return (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() => setRoleFilter(rf.id)}
                    aria-pressed={active}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-[#0B0F17] text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {rf.label}
                  </button>
                );
              })}
            </div>

            <div
              className="flex-1 min-h-[260px] max-h-[340px] overflow-y-auto divide-y divide-slate-800/60 border-t border-slate-800/70 pr-1"
              data-testid="lineup-hero-roster"
            >
              {heroRanksLoading && roster.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading live hero win rates from Rone Arena...
                </div>
              ) : filteredRoster.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No heroes matched your search filter.
                </div>
              ) : (
                filteredRoster.map((hero) => {
                  const isSelected = draftHeroIds.includes(hero.heroId);
                  const disabled = isLineupFull && !isSelected;

                  return (
                    <button
                      key={hero.heroId}
                      type="button"
                      onClick={() => handleToggleHero(hero.heroId)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                      aria-label={
                        isSelected
                          ? `Remove ${hero.name} from lineup`
                          : `Add ${hero.name} to lineup`
                      }
                      className={`w-full py-2 px-2 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/10'
                          : disabled
                            ? 'opacity-45 cursor-not-allowed'
                            : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SafeImage
                          src={hero.head}
                          alt={hero.name}
                          fallbackText={hero.name}
                          size="sm"
                          className="w-8 h-8 rounded-md border border-slate-700/80 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-100 truncate">
                            {hero.name}
                          </div>
                          <div className="text-[11px] text-slate-400 capitalize truncate">
                            {hero.roles[0] || 'Hero'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`font-mono tabular-nums text-xs font-semibold ${
                            hero.winRatePct === null
                              ? 'text-slate-400'
                              : hero.winRatePct >= 50
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                          }`}
                        >
                          {hero.winRatePct !== null ? `${hero.winRatePct.toFixed(1)}%` : '—'}
                        </span>

                        <span
                          className={`text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                            isSelected ? 'text-amber-300' : 'text-slate-400'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              Added
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                              Add
                            </>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Saved Favorite Lineups List */}
        <div className="border-t border-slate-800/80 p-6 space-y-4" data-testid="saved-lineups-list">
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100 font-display">
              <span>Saved Favorite Lineups</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs font-normal font-mono tabular-nums text-slate-400">
                {savedLineups.length} saved
              </span>
            </div>
          </div>

          {savedLineups.length === 0 ? (
            <p className="text-xs text-slate-400">
              No favorite lineups saved yet. Pick 1–5 heroes above and click Save Lineup to store your team composition and its live average win rate.
            </p>
          ) : (
            <div className="divide-y divide-slate-800/70 border-t border-slate-800/70">
              {savedLineups.map((lineup) => {
                const resolved = resolveLineupHeroes(
                  lineup.heroIds,
                  heroRanks,
                  positionMap,
                  lineup.snapshotHeroes,
                );
                const summary = calculateLineupWinRate(resolved);

                return (
                  <div
                    key={lineup.id}
                    className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-display font-semibold text-sm text-slate-100">
                          {lineup.name}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {resolved.length} {resolved.length === 1 ? 'hero' : 'heroes'}
                        </span>
                        {summary.roleCoverage.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{summary.roleCoverage.join(', ')}</span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {resolved.map((h) => (
                          <button
                            key={h.heroId}
                            type="button"
                            onClick={() => onOpenHero(h.heroId)}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            <SafeImage
                              src={h.head}
                              alt={h.name}
                              fallbackText={h.name}
                              size="sm"
                              className="w-6 h-6 rounded border border-slate-700/80 shrink-0"
                            />
                            <span>{h.name}</span>
                            {h.winRatePct !== null && (
                              <span className="font-mono tabular-nums text-[11px] text-slate-400">
                                {h.winRatePct.toFixed(1)}%
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-5 shrink-0">
                      <div className="text-left md:text-right">
                        <div className="text-[11px] text-slate-400">Avg Win Rate</div>
                        <div
                          className={`font-mono tabular-nums text-base font-bold ${
                            summary.averageWinRatePct === null
                              ? 'text-slate-400'
                              : summary.averageWinRatePct >= 50
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                          }`}
                        >
                          {summary.averageWinRatePct !== null
                            ? `${summary.averageWinRatePct.toFixed(2)}%`
                            : '—'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadLineup(lineup)}
                          aria-label={`Load lineup '${lineup.name}'`}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-200 hover:border-amber-400/70 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Load
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteLineup(lineup.id, lineup.name)}
                          aria-label={`Delete lineup '${lineup.name}'`}
                          className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-300 hover:border-rose-700/60 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
