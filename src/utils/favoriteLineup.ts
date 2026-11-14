import type {
  FavoriteHeroLineup,
  FavoriteLineupHero,
  HeroRankRecord,
  LineupWinRateSummary,
  RoleFilter,
} from '../types/mlbb';
import type { HeroMetadataSummary } from './mlbb';

export const FAVORITE_LINEUPS_STORAGE_KEY = 'dawnsight_favorite_lineups_v1';
export const MAX_LINEUP_SIZE = 5;

function roundTwo(val: number): number {
  return Math.round(val * 100) / 100;
}

function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function buildHeroRosterForLineup(
  heroRanks: HeroRankRecord[],
  positionMap: Map<number, HeroMetadataSummary>,
): FavoriteLineupHero[] {
  const seen = new Set<number>();
  const roster: FavoriteLineupHero[] = [];

  for (const rec of heroRanks) {
    const heroId = rec.data?.main_heroid;
    if (!heroId || seen.has(heroId)) continue;
    seen.add(heroId);
    const pos = positionMap.get(heroId);
    const wr = rec.data.main_hero_win_rate;
    const pr = rec.data.main_hero_appearance_rate;
    const br = rec.data.main_hero_ban_rate;

    roster.push({
      heroId,
      name: rec.data.main_hero?.data?.name || `Hero #${heroId}`,
      head: rec.data.main_hero?.data?.head || pos?.smallmap || '',
      roles: pos?.roles || [],
      lanes: pos?.lanes || [],
      winRatePct: Number.isFinite(wr) && wr > 0 ? roundTwo(wr * 100) : null,
      pickRatePct: Number.isFinite(pr) && pr >= 0 ? roundTwo(pr * 100) : null,
      banRatePct: Number.isFinite(br) && br >= 0 ? roundTwo(br * 100) : null,
    });
  }

  return roster.sort((a, b) => a.name.localeCompare(b.name));
}

export function filterHeroRosterForLineup(
  roster: FavoriteLineupHero[],
  query: string,
  roleFilter: RoleFilter,
): FavoriteLineupHero[] {
  const q = query.trim().toLowerCase();
  return roster.filter((hero) => {
    if (q && !hero.name.toLowerCase().includes(q) && String(hero.heroId) !== q) {
      return false;
    }
    if (roleFilter !== 'all' && !hero.roles.some((r) => r.includes(roleFilter))) {
      return false;
    }
    return true;
  });
}

export function addHeroToLineup(
  currentIds: number[],
  heroId: number,
  maxSize: number = MAX_LINEUP_SIZE,
): number[] {
  if (!Number.isFinite(heroId) || heroId <= 0) return currentIds;
  if (currentIds.includes(heroId)) return currentIds;
  if (currentIds.length >= maxSize) return currentIds;
  return [...currentIds, heroId];
}

export function removeHeroFromLineup(currentIds: number[], heroId: number): number[] {
  return currentIds.filter((id) => id !== heroId);
}

export function resolveLineupHeroes(
  heroIds: number[],
  heroRanks: HeroRankRecord[],
  positionMap: Map<number, HeroMetadataSummary>,
  snapshotHeroes: FavoriteLineupHero[] = [],
): FavoriteLineupHero[] {
  const rankById = new Map<number, HeroRankRecord>();
  for (const rec of heroRanks) {
    if (rec.data?.main_heroid) {
      rankById.set(rec.data.main_heroid, rec);
    }
  }

  const snapshotById = new Map<number, FavoriteLineupHero>();
  for (const snap of snapshotHeroes) {
    snapshotById.set(snap.heroId, snap);
  }

  return heroIds.map((heroId) => {
    const rec = rankById.get(heroId);
    const pos = positionMap.get(heroId);
    const snap = snapshotById.get(heroId);

    if (rec) {
      const wr = rec.data.main_hero_win_rate;
      const pr = rec.data.main_hero_appearance_rate;
      const br = rec.data.main_hero_ban_rate;
      return {
        heroId,
        name: rec.data.main_hero?.data?.name || snap?.name || `Hero #${heroId}`,
        head: rec.data.main_hero?.data?.head || pos?.smallmap || snap?.head || '',
        roles: pos?.roles?.length ? pos.roles : snap?.roles || [],
        lanes: pos?.lanes?.length ? pos.lanes : snap?.lanes || [],
        winRatePct: Number.isFinite(wr) && wr > 0 ? roundTwo(wr * 100) : snap?.winRatePct ?? null,
        pickRatePct: Number.isFinite(pr) && pr >= 0 ? roundTwo(pr * 100) : snap?.pickRatePct ?? null,
        banRatePct: Number.isFinite(br) && br >= 0 ? roundTwo(br * 100) : snap?.banRatePct ?? null,
      };
    }

    if (snap) {
      return {
        ...snap,
        head: snap.head || pos?.smallmap || '',
        roles: snap.roles?.length ? snap.roles : pos?.roles || [],
        lanes: snap.lanes?.length ? snap.lanes : pos?.lanes || [],
      };
    }

    return {
      heroId,
      name: `Hero #${heroId}`,
      head: pos?.smallmap || '',
      roles: pos?.roles || [],
      lanes: pos?.lanes || [],
      winRatePct: null,
      pickRatePct: null,
      banRatePct: null,
    };
  });
}

export function calculateLineupWinRate(heroes: FavoriteLineupHero[]): LineupWinRateSummary {
  const heroCount = heroes.length;
  const ratedHeroes = heroes.filter(
    (h): h is FavoriteLineupHero & { winRatePct: number } =>
      typeof h.winRatePct === 'number' && Number.isFinite(h.winRatePct),
  );

  const pickHeroes = heroes.filter(
    (h): h is FavoriteLineupHero & { pickRatePct: number } =>
      typeof h.pickRatePct === 'number' && Number.isFinite(h.pickRatePct),
  );

  const banHeroes = heroes.filter(
    (h): h is FavoriteLineupHero & { banRatePct: number } =>
      typeof h.banRatePct === 'number' && Number.isFinite(h.banRatePct),
  );

  const averageWinRatePct =
    ratedHeroes.length > 0
      ? roundTwo(ratedHeroes.reduce((sum, h) => sum + h.winRatePct, 0) / ratedHeroes.length)
      : null;

  const averagePickRatePct =
    pickHeroes.length > 0
      ? roundTwo(pickHeroes.reduce((sum, h) => sum + h.pickRatePct, 0) / pickHeroes.length)
      : null;

  const averageBanRatePct =
    banHeroes.length > 0
      ? roundTwo(banHeroes.reduce((sum, h) => sum + h.banRatePct, 0) / banHeroes.length)
      : null;

  const deltaFromFiftyPct =
    averageWinRatePct !== null ? roundTwo(averageWinRatePct - 50) : null;

  let highestWrHero: LineupWinRateSummary['highestWrHero'] = null;
  let lowestWrHero: LineupWinRateSummary['lowestWrHero'] = null;

  for (const hero of ratedHeroes) {
    if (!highestWrHero || hero.winRatePct > highestWrHero.winRatePct) {
      highestWrHero = { heroId: hero.heroId, name: hero.name, winRatePct: hero.winRatePct };
    }
    if (!lowestWrHero || hero.winRatePct < lowestWrHero.winRatePct) {
      lowestWrHero = { heroId: hero.heroId, name: hero.name, winRatePct: hero.winRatePct };
    }
  }

  const roleSet = new Set<string>();
  for (const hero of heroes) {
    for (const role of hero.roles) {
      const clean = capitalizeWord(role.trim());
      if (clean) roleSet.add(clean);
    }
  }

  return {
    heroCount,
    ratedHeroCount: ratedHeroes.length,
    averageWinRatePct,
    averagePickRatePct,
    averageBanRatePct,
    deltaFromFiftyPct,
    highestWrHero,
    lowestWrHero,
    roleCoverage: Array.from(roleSet),
  };
}

export function validateLineupForSave(
  name: string,
  heroIds: number[],
  existingCount: number = 0,
): { valid: boolean; error?: string; resolvedName: string } {
  if (heroIds.length === 0) {
    return {
      valid: false,
      error: 'Select at least 1 hero before saving your lineup.',
      resolvedName: '',
    };
  }
  const cleanName = name.trim();
  if (cleanName.length > 60) {
    return {
      valid: false,
      error: 'Lineup name must be 60 characters or fewer.',
      resolvedName: '',
    };
  }
  return {
    valid: true,
    resolvedName: cleanName || `Favorite Lineup #${existingCount + 1}`,
  };
}

export function createSavedLineup(
  name: string,
  heroes: FavoriteLineupHero[],
  nowIso: string = new Date().toISOString(),
): FavoriteHeroLineup {
  const heroIds = heroes.map((h) => h.heroId);
  return {
    id: `lineup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    heroIds,
    snapshotHeroes: heroes,
    savedAt: nowIso,
  };
}

export function parseSavedLineups(rawJson: string | null): FavoriteHeroLineup[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is FavoriteHeroLineup => {
      if (!item || typeof item !== 'object') return false;
      if (typeof item.id !== 'string' || typeof item.name !== 'string') return false;
      if (!Array.isArray(item.heroIds) || item.heroIds.length === 0) return false;
      return item.heroIds.every((id: unknown) => typeof id === 'number' && Number.isFinite(id));
    });
  } catch {
    return [];
  }
}

export function serializeSavedLineups(lineups: FavoriteHeroLineup[]): string {
  return JSON.stringify(lineups);
}

export function loadSavedLineupsFromStorage(): FavoriteHeroLineup[] {
  try {
    return parseSavedLineups(localStorage.getItem(FAVORITE_LINEUPS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function persistSavedLineupsToStorage(lineups: FavoriteHeroLineup[]): void {
  try {
    localStorage.setItem(FAVORITE_LINEUPS_STORAGE_KEY, serializeSavedLineups(lineups));
  } catch {
    // ignore storage quota errors
  }
}
