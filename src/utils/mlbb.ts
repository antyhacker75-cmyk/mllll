import type {
  HeroPositionRecord,
  HeroRankRecord,
  HeroSortField,
  LaneFilter,
  LeaderboardPlayer,
  RankRecord,
  ResolvedRank,
  RoleFilter,
  SortOrder,
} from '../types/mlbb';

const ENGLISH_TIER_NAMES: Record<number, string> = {
  1: 'Warrior',
  2: 'Elite',
  3: 'Master',
  4: 'Grandmaster',
  5: 'Epic',
  6: 'Legend',
  7: 'Mythic',
};

export function resolveRankFromLevel(
  rankLevel: number,
  rankRecords: RankRecord[] = [],
): ResolvedRank {
  const safeLevel = Math.max(1, Math.floor(Number.isFinite(rankLevel) ? rankLevel : 1));
  const matched = rankRecords.find(
    (rec) => safeLevel >= rec.data.rankid_start && safeLevel <= rec.data.rankid_end,
  );

  if (safeLevel >= 236) {
    return {
      tierName: 'Mythical Immortal',
      division: 'Immortal',
      fullLabel: 'Mythical Immortal',
      stars: safeLevel - 136,
      icon: matched?.data.icon,
      bigrank: 7,
    };
  }
  if (safeLevel >= 186) {
    return {
      tierName: 'Mythical Glory',
      division: 'Glory',
      fullLabel: 'Mythical Glory',
      stars: safeLevel - 136,
      icon: matched?.data.icon,
      bigrank: 7,
    };
  }
  if (safeLevel >= 161) {
    return {
      tierName: 'Mythical Honor',
      division: 'Honor',
      fullLabel: 'Mythical Honor',
      stars: safeLevel - 136,
      icon: matched?.data.icon,
      bigrank: 7,
    };
  }
  if (safeLevel >= 136) {
    return {
      tierName: 'Mythic',
      division: 'Mythic',
      fullLabel: 'Mythic',
      stars: safeLevel - 136,
      icon: matched?.data.icon,
      bigrank: 7,
    };
  }

  if (matched) {
    const tierName = ENGLISH_TIER_NAMES[matched.data.bigrank] || matched.data.bigrank_name;
    const division = matched.data.minrank_name || '';
    const fullLabel = division ? `${tierName} ${division}` : tierName;
    const stars = Math.max(0, safeLevel - matched.data.rankid_start);
    return {
      tierName,
      division,
      fullLabel,
      stars,
      icon: matched.data.icon,
      bigrank: matched.data.bigrank,
    };
  }

  // Deterministic fallback table when rankRecords haven't loaded yet
  const fallbackBands: Array<{ start: number; end: number; tier: string; div: string; big: number }> = [
    { start: 1, end: 4, tier: 'Warrior', div: 'III', big: 1 },
    { start: 5, end: 7, tier: 'Warrior', div: 'II', big: 1 },
    { start: 8, end: 10, tier: 'Warrior', div: 'I', big: 1 },
    { start: 11, end: 15, tier: 'Elite', div: 'III', big: 2 },
    { start: 16, end: 20, tier: 'Elite', div: 'II', big: 2 },
    { start: 21, end: 25, tier: 'Elite', div: 'I', big: 2 },
    { start: 26, end: 30, tier: 'Master', div: 'IV', big: 3 },
    { start: 31, end: 35, tier: 'Master', div: 'III', big: 3 },
    { start: 36, end: 40, tier: 'Master', div: 'II', big: 3 },
    { start: 41, end: 45, tier: 'Master', div: 'I', big: 3 },
    { start: 46, end: 51, tier: 'Grandmaster', div: 'V', big: 4 },
    { start: 52, end: 57, tier: 'Grandmaster', div: 'IV', big: 4 },
    { start: 58, end: 63, tier: 'Grandmaster', div: 'III', big: 4 },
    { start: 64, end: 69, tier: 'Grandmaster', div: 'II', big: 4 },
    { start: 70, end: 75, tier: 'Grandmaster', div: 'I', big: 4 },
    { start: 76, end: 81, tier: 'Epic', div: 'V', big: 5 },
    { start: 82, end: 87, tier: 'Epic', div: 'IV', big: 5 },
    { start: 88, end: 93, tier: 'Epic', div: 'III', big: 5 },
    { start: 94, end: 99, tier: 'Epic', div: 'II', big: 5 },
    { start: 100, end: 105, tier: 'Epic', div: 'I', big: 5 },
    { start: 106, end: 111, tier: 'Legend', div: 'V', big: 6 },
    { start: 112, end: 117, tier: 'Legend', div: 'IV', big: 6 },
    { start: 118, end: 123, tier: 'Legend', div: 'III', big: 6 },
    { start: 124, end: 129, tier: 'Legend', div: 'II', big: 6 },
    { start: 130, end: 135, tier: 'Legend', div: 'I', big: 6 },
  ];

  const band = fallbackBands.find((b) => safeLevel >= b.start && safeLevel <= b.end) || fallbackBands[0];
  return {
    tierName: band.tier,
    division: band.div,
    fullLabel: `${band.tier} ${band.div}`,
    stars: safeLevel - band.start,
    bigrank: band.big,
  };
}

export function formatWinRate(wins: number, total: number): string {
  if (!total || total <= 0) return '0.0%';
  const pct = (wins / total) * 100;
  return `${pct.toFixed(1)}%`;
}

export function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return '0.0%';
  return `${(rate * 100).toFixed(2)}%`;
}

export function formatBattleScore(rawScore: number): string {
  if (!Number.isFinite(rawScore) || rawScore <= 0) return '0.0';
  return (rawScore / 100).toFixed(1);
}

export function formatKda(k: number, d: number, a: number): { kdaText: string; ratio: string } {
  const kills = Math.max(0, Math.floor(k || 0));
  const deaths = Math.max(0, Math.floor(d || 0));
  const assists = Math.max(0, Math.floor(a || 0));
  const kdaText = `${kills}/${deaths}/${assists}`;
  if (deaths === 0) {
    return { kdaText, ratio: (kills + assists).toFixed(1) };
  }
  return { kdaText, ratio: ((kills + assists) / deaths).toFixed(1) };
}

export function getLaneLabel(lid: number): string {
  switch (lid) {
    case 1:
      return 'EXP Lane';
    case 2:
      return 'Mid Lane';
    case 3:
      return 'Roam';
    case 4:
      return 'Jungle';
    case 5:
      return 'Gold Lane';
    default:
      return 'Flex';
  }
}

export function formatRelativeTime(tsInput: number, nowMs: number = Date.now()): string {
  if (!Number.isFinite(tsInput) || tsInput <= 0) return '—';
  const tsMs = tsInput < 10_000_000_000 ? tsInput * 1000 : tsInput;
  const diffSec = Math.max(0, Math.floor((nowMs - tsMs) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const date = new Date(tsMs);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface AccountValidationResult {
  valid: boolean;
  roleIdError?: string;
  zoneIdError?: string;
  vcError?: string;
}

export function validateAccountCredentials(
  roleId: string,
  zoneId: string,
  vc: string = '',
  requireVc: boolean = false,
): AccountValidationResult {
  const cleanRole = roleId.trim();
  const cleanZone = zoneId.trim();
  const cleanVc = vc.trim();

  let roleIdError: string | undefined;
  let zoneIdError: string | undefined;
  let vcError: string | undefined;

  if (!cleanRole) {
    roleIdError = 'Game ID is required.';
  } else if (!/^\d{5,12}$/.test(cleanRole)) {
    roleIdError = 'Enter a valid numeric Game ID (5–12 digits).';
  }

  if (!cleanZone) {
    zoneIdError = 'Server ID is required.';
  } else if (!/^\d{3,6}$/.test(cleanZone)) {
    zoneIdError = 'Enter a valid numeric Server ID (3–6 digits).';
  }

  if (requireVc) {
    if (!cleanVc) {
      vcError = 'Verification code is required.';
    } else if (!/^\d{4,8}$/.test(cleanVc)) {
      vcError = 'Enter the numeric verification code from in-game mail.';
    }
  }

  return {
    valid: !roleIdError && !zoneIdError && !vcError,
    roleIdError,
    zoneIdError,
    vcError,
  };
}

export interface HeroMetadataSummary {
  roles: string[];
  lanes: string[];
  smallmap?: string;
}

export function extractHeroPositionMap(
  records: HeroPositionRecord[],
): Map<number, HeroMetadataSummary> {
  const map = new Map<number, HeroMetadataSummary>();
  for (const rec of records) {
    const heroId = rec.data?.hero_id;
    const heroData = rec.data?.hero?.data;
    if (!heroId || !heroData) continue;

    const roles: string[] = [];
    for (const entry of heroData.sortid || []) {
      if (typeof entry === 'object' && entry?.data?.sort_title) {
        roles.push(entry.data.sort_title.toLowerCase());
      }
    }

    const lanes: string[] = [];
    for (const entry of heroData.roadsort || []) {
      if (typeof entry === 'object' && entry?.data?.road_sort_title) {
        lanes.push(entry.data.road_sort_title.toLowerCase());
      }
    }

    map.set(heroId, {
      roles,
      lanes,
      smallmap: heroData.smallmap,
    });
  }
  return map;
}

export function filterAndSortHeroRanks(
  records: HeroRankRecord[],
  query: string,
  roleFilter: RoleFilter,
  laneFilter: LaneFilter,
  positionMap: Map<number, HeroMetadataSummary>,
  sortField: HeroSortField,
  sortOrder: SortOrder,
): HeroRankRecord[] {
  const q = query.trim().toLowerCase();

  const filtered = records.filter((rec) => {
    const name = (rec.data?.main_hero?.data?.name || '').toLowerCase();
    const heroId = rec.data?.main_heroid;
    if (q && !name.includes(q) && String(heroId) !== q) {
      return false;
    }

    const pos = positionMap.get(heroId);
    if (roleFilter !== 'all') {
      if (!pos || !pos.roles.some((r) => r.includes(roleFilter))) {
        return false;
      }
    }
    if (laneFilter !== 'all') {
      if (!pos || !pos.lanes.some((l) => l.includes(laneFilter))) {
        return false;
      }
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const getVal = (item: HeroRankRecord): number => {
      switch (sortField) {
        case 'pick_rate':
          return item.data.main_hero_appearance_rate || 0;
        case 'ban_rate':
          return item.data.main_hero_ban_rate || 0;
        case 'win_rate':
        default:
          return item.data.main_hero_win_rate || 0;
      }
    };
    const diff = getVal(a) - getVal(b);
    return sortOrder === 'asc' ? diff : -diff;
  });

  return sorted;
}

export function stripHtmlTags(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function filterLeaderboardPlayers(
  players: LeaderboardPlayer[],
  query: string,
  regionFilter: string = 'all',
): LeaderboardPlayer[] {
  const q = query.trim().toLowerCase();
  const r = regionFilter.trim().toLowerCase();

  return players.filter((player) => {
    if (r !== 'all' && player.region.toLowerCase() !== r) {
      return false;
    }
    if (!q) return true;
    return (
      player.playerName.toLowerCase().includes(q) ||
      player.region.toLowerCase().includes(q) ||
      player.regionLabel.toLowerCase().includes(q) ||
      player.mainHeroName.toLowerCase().includes(q)
    );
  });
}

