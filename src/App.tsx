import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccountSearchSection } from './components/AccountSearchSection';
import { SafeImage } from './components/SafeImage';
import { HeroDetailDrawer } from './components/HeroDetailDrawer';
import { HeroMetaView } from './components/HeroMetaView';
import { ItemCounterView } from './components/ItemCounterView';
import { PlayerDossierView } from './components/PlayerDossierView';
import { RankLadderView } from './components/RankLadderView';
import { TopNav, type AppTab } from './components/TopNav';
import { WinPredictorView } from './components/WinPredictorView';
import { SAMPLE_PLAYER_DOSSIER, type PlayerDossierData } from './data/samplePlayer';
import {
  fetchAcademyRanks,
  fetchEquipmentExpanded,
  fetchGameVersion,
  fetchHeroPositions,
  fetchHeroRanks,
  fetchUserFrequentHeroes,
  fetchUserFriends,
  fetchUserInfo,
  fetchUserMatches,
  fetchUserSeasons,
  fetchUserStats,
  loginWithVerificationCode,
  sendVerificationCode,
} from './services/roneApi';
import type {
  DaysFilter,
  EquipmentRecord,
  FavoriteHeroLineup,
  HeroPositionRecord,
  HeroRankRecord,
  RankFilter,
  RankRecord,
} from './types/mlbb';
import { loadSavedLineupsFromStorage } from './utils/favoriteLineup';
import { extractHeroPositionMap } from './utils/mlbb';

const JWT_STORAGE_KEY = 'dawnsight_mlbb_jwt';

const PUBLIC_CACHE_PREFIX = 'dawnsight_public_v1_';
const PUBLIC_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readPublicCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PUBLIC_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: T };
    if (typeof parsed.savedAt !== 'number' || parsed.data === undefined) return null;
    if (Date.now() - parsed.savedAt > PUBLIC_CACHE_MAX_AGE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writePublicCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(
      PUBLIC_CACHE_PREFIX + key,
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // Storage can be unavailable or full; live API requests still work.
  }
}


export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('account');
  const [gameVersion, setGameVersion] = useState<string | null>(() => readPublicCache<string>('gameVersion'));

  // Public Meta & Reference Data
  const [rankFilter, setRankFilter] = useState<RankFilter>('mythic');
  const [daysFilter, setDaysFilter] = useState<DaysFilter>('7');
  const [heroRanks, setHeroRanks] = useState<HeroRankRecord[]>(() => readPublicCache<HeroRankRecord[]>('heroRanks_7_mythic') || []);
  const [heroRanksLoading, setHeroRanksLoading] = useState(() => !readPublicCache<HeroRankRecord[]>('heroRanks_7_mythic'));
  const [heroRanksError, setHeroRanksError] = useState<string | null>(null);

  const [positions, setPositions] = useState<HeroPositionRecord[]>(() => readPublicCache<HeroPositionRecord[]>('positions') || []);
  const [rankRecords, setRankRecords] = useState<RankRecord[]>(() => readPublicCache<RankRecord[]>('rankRecords') || []);
  const [ranksLoading, setRanksLoading] = useState(() => !readPublicCache<RankRecord[]>('rankRecords'));
  const [equipmentList, setEquipmentList] = useState<EquipmentRecord[]>(() => readPublicCache<EquipmentRecord[]>('equipment') || []);
  const [equipmentLoading, setEquipmentLoading] = useState(() => !readPublicCache<EquipmentRecord[]>('equipment'));

  // Player Account Dossier State
  const [jwt, setJwt] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(JWT_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [dossier, setDossier] = useState<PlayerDossierData | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(39);
  const [loadingSeasonData, setLoadingSeasonData] = useState(false);

  // Hero Deep-Dive Drawer
  const [selectedHeroId, setSelectedHeroId] = useState<number | null>(null);

  // Shared Team Composition & Win Predictor State
  const [favoriteHeroIds, setFavoriteHeroIds] = useState<number[]>([]);
  const [savedLineups, setSavedLineups] = useState<FavoriteHeroLineup[]>(() =>
    loadSavedLineupsFromStorage(),
  );
  const [predictorAllySlots, setPredictorAllySlots] = useState<Array<number | null>>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const [predictorEnemySlots, setPredictorEnemySlots] = useState<Array<number | null>>([
    null,
    null,
    null,
    null,
    null,
  ]);

  function toFiveSlots(ids: number[]): Array<number | null> {
    return [0, 1, 2, 3, 4].map((idx) => ids[idx] ?? null);
  }

  function handleChangeFavoriteHeroIds(nextIds: number[]) {
    setFavoriteHeroIds(nextIds);
    // Keep Win Predictor's Your Team synchronized with user's selected composition
    // unless a hero is already occupied in Opponent slots
    setPredictorAllySlots(
      [0, 1, 2, 3, 4].map((idx) => {
        const candidate = nextIds[idx] ?? null;
        return candidate && !predictorEnemySlots.includes(candidate) ? candidate : null;
      }),
    );
  }

  function handlePredictFromFavoriteLineup(heroIds: number[]) {
    const cleanEnemies = predictorEnemySlots.map((id) =>
      id && heroIds.includes(id) ? null : id,
    );
    setPredictorEnemySlots(cleanEnemies);
    setPredictorAllySlots(toFiveSlots(heroIds));
    setActiveTab('calculator');
  }

  function handleSendDraftToPredictor(allyIds: number[], enemyIds: number[]) {
    setPredictorAllySlots(toFiveSlots(allyIds));
    setPredictorEnemySlots(toFiveSlots(enemyIds));
    setActiveTab('calculator');
  }

  // Scroll to top when switching primary tabs
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  const refreshPublicData = useCallback(async () => {
    const [versionResult, positionsResult, ranksResult, equipmentResult] = await Promise.all([
      fetchGameVersion()
        .then((value) => ({ ok: true as const, value }))
        .catch(() => ({ ok: false as const })),
      fetchHeroPositions()
        .then((value) => ({ ok: true as const, value }))
        .catch(() => ({ ok: false as const })),
      fetchAcademyRanks()
        .then((value) => ({ ok: true as const, value }))
        .catch(() => ({ ok: false as const })),
      fetchEquipmentExpanded()
        .then((value) => ({ ok: true as const, value }))
        .catch(() => ({ ok: false as const })),
    ]);

    if (versionResult.ok && versionResult.value) {
      setGameVersion(versionResult.value);
      writePublicCache('gameVersion', versionResult.value);
    }
    if (positionsResult.ok && positionsResult.value.length > 0) {
      setPositions(positionsResult.value);
      writePublicCache('positions', positionsResult.value);
    }
    if (ranksResult.ok && ranksResult.value.length > 0) {
      setRankRecords(ranksResult.value);
      writePublicCache('rankRecords', ranksResult.value);
    }
    if (equipmentResult.ok && equipmentResult.value.length > 0) {
      setEquipmentList(equipmentResult.value);
      writePublicCache('equipment', equipmentResult.value);
    }
    setRanksLoading(false);
    setEquipmentLoading(false);
  }, []);

  // Display cached public data immediately, then refresh quietly in the background.
  useEffect(() => {
    void refreshPublicData();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshPublicData();
    }, 90_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshPublicData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshPublicData]);

  const loadHeroRanks = useCallback(() => {
    const cacheKey = 'heroRanks_' + daysFilter + '_' + rankFilter;
    const cached = readPublicCache<HeroRankRecord[]>(cacheKey);
    if (cached) setHeroRanks(cached);
    if (!cached || cached.length === 0) setHeroRanksLoading(true);
    setHeroRanksError(null);
    fetchHeroRanks({
      days: daysFilter,
      rank: rankFilter,
      sortField: 'win_rate',
      sortOrder: 'desc',
      size: 150,
    })
      .then((res) => {
        if (res.records.length > 0) {
          setHeroRanks(res.records);
          writePublicCache(cacheKey, res.records);
        }
      })
      .catch((err) =>
        setHeroRanksError(err instanceof Error ? err.message : 'Unable to fetch hero meta.'),
      )
      .finally(() => setHeroRanksLoading(false));
  }, [daysFilter, rankFilter]);

  useEffect(() => {
    loadHeroRanks();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadHeroRanks();
    }, 90_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadHeroRanks();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadHeroRanks]);

  // Hydrate authenticated player dossier if JWT exists
  const loadLivePlayer = useCallback(async (token: string) => {
    const [info, stats, seasons] = await Promise.all([
      fetchUserInfo(token),
      fetchUserStats(token),
      fetchUserSeasons(token),
    ]);
    const latestSid = seasons[0] ?? 39;
    const [matchesRes, frequentRes, friends] = await Promise.all([
      fetchUserMatches(token, latestSid, 15).catch(() => ({ matches: [], pageInfo: { hasNext: false } })),
      fetchUserFrequentHeroes(token, latestSid, 12).catch(() => ({ heroes: [], pageInfo: { hasNext: false } })),
      fetchUserFriends(token, latestSid).catch(() => []),
    ]);

    setSelectedSeason(latestSid);
    setDossier({
      mode: 'live',
      info,
      stats,
      seasons: seasons.length > 0 ? seasons : [latestSid],
      matchesBySeason: { [latestSid]: matchesRes.matches },
      frequentBySeason: { [latestSid]: frequentRes.heroes },
      friends,
    });
  }, []);

  useEffect(() => {
    if (!jwt) return;
    loadLivePlayer(jwt).catch(() => {
      try {
        sessionStorage.removeItem(JWT_STORAGE_KEY);
      } catch {
        // ignore storage restrictions
      }
      setJwt(null);
    });
  }, [jwt, loadLivePlayer]);

  async function handleSendCode(roleId: number, zoneId: number) {
    await sendVerificationCode(roleId, zoneId);
  }

  async function handleLogin(roleId: number, zoneId: number, vc: number) {
    const authData = await loginWithVerificationCode(roleId, zoneId, vc);
    try {
      sessionStorage.setItem(JWT_STORAGE_KEY, authData.jwt);
    } catch {
      // ignore
    }
    setJwt(authData.jwt);
    await loadLivePlayer(authData.jwt);
  }

  function handleLoadSample() {
    setDossier(SAMPLE_PLAYER_DOSSIER);
    setSelectedSeason(SAMPLE_PLAYER_DOSSIER.seasons[0]);
  }

  function handleSelectDossier(nextDossier: PlayerDossierData) {
    setDossier(nextDossier);
    setSelectedSeason(nextDossier.seasons[0] ?? 39);
  }

  function handleResetAccount() {
    try {
      sessionStorage.removeItem(JWT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setJwt(null);
    setDossier(null);
  }

  async function handleSelectSeason(sid: number) {
    setSelectedSeason(sid);
    if (!dossier || dossier.mode !== 'live' || !jwt) return;
    if (dossier.matchesBySeason[sid] && dossier.frequentBySeason[sid]) return;

    setLoadingSeasonData(true);
    try {
      const [matchesRes, frequentRes] = await Promise.all([
        fetchUserMatches(jwt, sid, 15).catch(() => ({ matches: [], pageInfo: { hasNext: false } })),
        fetchUserFrequentHeroes(jwt, sid, 12).catch(() => ({ heroes: [], pageInfo: { hasNext: false } })),
      ]);
      setDossier((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          matchesBySeason: { ...prev.matchesBySeason, [sid]: matchesRes.matches },
          frequentBySeason: { ...prev.frequentBySeason, [sid]: frequentRes.heroes },
        };
      });
    } finally {
      setLoadingSeasonData(false);
    }
  }

  const positionMap = useMemo(() => extractHeroPositionMap(positions), [positions]);

  const heroRankMap = useMemo(() => {
    const map = new Map<number, HeroRankRecord>();
    for (const rec of heroRanks) {
      map.set(rec.data.main_heroid, rec);
    }
    return map;
  }, [heroRanks]);

  const heroHeadMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const rec of heroRanks) {
      if (rec.data.main_hero?.data?.head) {
        map.set(rec.data.main_heroid, rec.data.main_hero.data.head);
      }
    }
    return map;
  }, [heroRanks]);

  const heroNameMap = useMemo(() => {
    const map = new Map<number, { name: string; head: string }>();
    for (const rec of heroRanks) {
      map.set(rec.data.main_heroid, {
        name: rec.data.main_hero?.data?.name || `Hero #${rec.data.main_heroid}`,
        head: rec.data.main_hero?.data?.head || '',
      });
    }
    for (const pos of positions) {
      if (!map.has(pos.data.hero_id)) {
        map.set(pos.data.hero_id, {
          name: pos.data.hero?.data?.name || `Hero #${pos.data.hero_id}`,
          head: pos.data.hero?.data?.smallmap || '',
        });
      }
    }
    return map;
  }, [heroRanks, positions]);

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#0B0F17] text-slate-100">
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasDossier={Boolean(dossier)}
        isSampleMode={dossier?.mode === 'sample'}
        onPrimaryAction={() => {
          setActiveTab('account');
          if (dossier) {
            handleResetAccount();
          }
        }}
      />

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-10">
        {activeTab === 'account' && (
          <>
            {dossier ? (
              <PlayerDossierView
                dossier={dossier}
                selectedSeason={selectedSeason}
                onSelectSeason={handleSelectSeason}
                rankRecords={rankRecords}
                heroHeadMap={heroHeadMap}
                onOpenHero={setSelectedHeroId}
                onSelectDossier={handleSelectDossier}
                onResetAccount={handleResetAccount}
                loadingSeasonData={loadingSeasonData}
              />
            ) : (
              <>
                <AccountSearchSection
                  gameVersion={gameVersion}
                  rankRecords={rankRecords}
                  heroHeadMap={heroHeadMap}
                  heroRanks={heroRanks}
                  heroRanksLoading={heroRanksLoading}
                  positionMap={positionMap}
                  onSendCode={handleSendCode}
                  onLogin={handleLogin}
                  onLoadSample={handleLoadSample}
                  onSelectDossier={handleSelectDossier}
                  onExploreMeta={() => setActiveTab('heroes')}
                  onOpenHero={setSelectedHeroId}
                  favoriteHeroIds={favoriteHeroIds}
                  onChangeFavoriteHeroIds={handleChangeFavoriteHeroIds}
                  savedLineups={savedLineups}
                  onChangeSavedLineups={setSavedLineups}
                  onPredictMatchup={handlePredictFromFavoriteLineup}
                />

                {/* Top Meta Snapshot right below the Account Search hero */}
                <section className="space-y-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-slate-100">
                        Top Mythic Meta Performers
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Live 7-day win rate leaders from Rone Arena. Click any hero to inspect skills and counters.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('heroes')}
                      className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      View all {heroRanks.length || ''} heroes
                    </button>
                  </div>

                  {heroRanksLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 rounded-xl bg-[#111827] border border-slate-800 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {heroRanks.slice(0, 8).map((rec) => {
                        const d = rec.data;
                        const name = d.main_hero?.data?.name || `Hero #${d.main_heroid}`;
                        const pos = positionMap.get(d.main_heroid);
                        return (
                          <button
                            key={d.main_heroid}
                            type="button"
                            onClick={() => setSelectedHeroId(d.main_heroid)}
                            className="text-left p-4 rounded-xl border border-slate-800/80 bg-[#111827] hover:border-slate-700 hover:bg-[#151D2E] transition-colors flex items-center gap-3.5 cursor-pointer"
                          >
                            <SafeImage
                              src={d.main_hero?.data?.head}
                              alt={name}
                              fallbackText={name}
                              size="sm"
                              className="w-11 h-11 rounded-lg"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm text-slate-100 truncate">
                                {name}
                              </div>
                              <div className="text-xs text-slate-400 capitalize truncate">
                                {pos?.roles?.[0] || 'Hero'}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono tabular-nums text-sm font-semibold text-emerald-400">
                                {(d.main_hero_win_rate * 100).toFixed(1)}%
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                Ban {(d.main_hero_ban_rate * 100).toFixed(1)}%
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {activeTab === 'heroes' && (
          <HeroMetaView
            heroRanks={heroRanks}
            positionMap={positionMap}
            loading={heroRanksLoading}
            error={heroRanksError}
            rankFilter={rankFilter}
            daysFilter={daysFilter}
            onChangeRankFilter={setRankFilter}
            onChangeDaysFilter={setDaysFilter}
            onRetry={loadHeroRanks}
            onOpenHero={setSelectedHeroId}
          />
        )}

        {activeTab === 'counter' && (
          <ItemCounterView
            heroRanks={heroRanks}
            positionMap={positionMap}
            heroNameMap={heroNameMap}
            equipmentList={equipmentList}
            equipmentLoading={equipmentLoading}
            onSendToPredictor={handleSendDraftToPredictor}
          />
        )}

        {activeTab === 'ranks' && (
          <RankLadderView
            rankRecords={rankRecords}
            heroHeadMap={heroHeadMap}
            loading={ranksLoading}
            onOpenHero={setSelectedHeroId}
            onSelectPlayerDossier={(selected) => {
              handleSelectDossier(selected);
              setActiveTab('account');
            }}
          />
        )}

        {activeTab === 'calculator' && (
          <WinPredictorView
            allyHeroIds={predictorAllySlots}
            enemyHeroIds={predictorEnemySlots}
            onChangeAllyHeroIds={setPredictorAllySlots}
            onChangeEnemyHeroIds={setPredictorEnemySlots}
            savedLineups={savedLineups}
            heroRanks={heroRanks}
            heroRanksLoading={heroRanksLoading}
            positionMap={positionMap}
            heroNameMap={heroNameMap}
            onOpenHero={setSelectedHeroId}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/70 py-6 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>DawnSight · Mobile Legends: Bang Bang Analytics</span>
          <span>Data powered by Rone Arena API</span>
        </div>
      </footer>

      <HeroDetailDrawer
        heroId={selectedHeroId}
        rankFilter={rankFilter}
        positionMap={positionMap}
        heroRankMap={heroRankMap}
        heroNameMap={heroNameMap}
        equipmentList={equipmentList}
        onSelectHero={setSelectedHeroId}
        onClose={() => setSelectedHeroId(null)}
      />
    </div>
  );
}
