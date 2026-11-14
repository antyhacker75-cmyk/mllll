import type { DaysFilter, HeroRankRecord } from '../types/mlbb';

export const TREND_LINE_COLORS = [
  '#F59E0B', // Amber
  '#34D399', // Emerald
  '#38BDF8', // Sky
  '#F472B6', // Pink
  '#A78BFA', // Violet
] as const;

export interface HeroTrendSeriesMeta {
  heroId: number;
  dataKey: string;
  name: string;
  head: string;
  color: string;
  pickRate: number;
  latestWinRate: number;
  deltaWinRate: number;
}

export interface HeroWinRateTrendResult {
  windows: DaysFilter[];
  series: HeroTrendSeriesMeta[];
  dataPoints: Array<Record<string, string | number | null>>;
  yDomain: [number, number];
}

export function getTrendWindowsForRange(daysFilter: DaysFilter): DaysFilter[] {
  switch (daysFilter) {
    case '30':
      return ['30', '15', '7', '3', '1'];
    case '15':
      return ['15', '7', '3', '1'];
    case '7':
      return ['7', '3', '1'];
    case '3':
    case '1':
    default:
      return ['3', '1'];
  }
}

export function selectTopPopularHeroes(
  records: HeroRankRecord[],
  limit = 5,
): HeroRankRecord[] {
  if (!Array.isArray(records) || records.length === 0 || limit <= 0) {
    return [];
  }

  return [...records]
    .filter((rec) => Number.isFinite(rec?.data?.main_heroid))
    .sort((a, b) => {
      const pickDiff =
        (b.data.main_hero_appearance_rate || 0) -
        (a.data.main_hero_appearance_rate || 0);
      if (Math.abs(pickDiff) > 1e-9) return pickDiff;

      const wrDiff =
        (b.data.main_hero_win_rate || 0) - (a.data.main_hero_win_rate || 0);
      if (Math.abs(wrDiff) > 1e-9) return wrDiff;

      return a.data.main_heroid - b.data.main_heroid;
    })
    .slice(0, limit);
}

export function buildWinRateTrendSeries(opts: {
  topHeroes: HeroRankRecord[];
  snapshotsByDay: Partial<Record<DaysFilter, HeroRankRecord[]>>;
  windows: DaysFilter[];
}): HeroWinRateTrendResult {
  const { topHeroes, snapshotsByDay, windows } = opts;

  if (topHeroes.length === 0 || windows.length === 0) {
    return {
      windows,
      series: [],
      dataPoints: [],
      yDomain: [40, 60],
    };
  }

  const lookupByWindow = new Map<DaysFilter, Map<number, HeroRankRecord>>();
  for (const w of windows) {
    const map = new Map<number, HeroRankRecord>();
    for (const rec of snapshotsByDay[w] || []) {
      map.set(rec.data.main_heroid, rec);
    }
    lookupByWindow.set(w, map);
  }

  let minWr = Infinity;
  let maxWr = -Infinity;

  const dataPoints: Array<Record<string, string | number | null>> = windows.map((w) => {
    const point: Record<string, string | number | null> = {
      window: w,
      label: `${w}D`,
    };
    const windowMap = lookupByWindow.get(w);

    for (const hero of topHeroes) {
      const heroId = hero.data.main_heroid;
      const key = `hero_${heroId}`;
      const match = windowMap?.get(heroId);
      if (match && Number.isFinite(match.data.main_hero_win_rate)) {
        const pct = Number((match.data.main_hero_win_rate * 100).toFixed(2));
        point[key] = pct;
        if (pct < minWr) minWr = pct;
        if (pct > maxWr) maxWr = pct;
      } else {
        point[key] = null;
      }
    }

    return point;
  });

  const series: HeroTrendSeriesMeta[] = topHeroes.map((hero, idx) => {
    const heroId = hero.data.main_heroid;
    const dataKey = `hero_${heroId}`;
    const values = dataPoints
      .map((pt) => pt[dataKey])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    const fallbackWr = Number(((hero.data.main_hero_win_rate || 0) * 100).toFixed(2));
    const firstWr = values.length > 0 ? values[0] : fallbackWr;
    const latestWr = values.length > 0 ? values[values.length - 1] : fallbackWr;
    const deltaWinRate = Number((latestWr - firstWr).toFixed(2));

    return {
      heroId,
      dataKey,
      name: hero.data.main_hero?.data?.name || `Hero #${heroId}`,
      head: hero.data.main_hero?.data?.head || '',
      color: TREND_LINE_COLORS[idx % TREND_LINE_COLORS.length],
      pickRate: hero.data.main_hero_appearance_rate || 0,
      latestWinRate: latestWr,
      deltaWinRate,
    };
  });

  let yMin = 40;
  let yMax = 60;
  if (Number.isFinite(minWr) && Number.isFinite(maxWr)) {
    yMin = Math.max(0, Math.floor(minWr - 1.5));
    yMax = Math.min(100, Math.ceil(maxWr + 1.5));
    if (yMax - yMin < 4) {
      yMin = Math.max(0, yMin - 1);
      yMax = Math.min(100, yMax + 1);
    }
  }

  return {
    windows,
    series,
    dataPoints,
    yDomain: [yMin, yMax],
  };
}
