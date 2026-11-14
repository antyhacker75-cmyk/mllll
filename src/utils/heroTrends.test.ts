import test from 'node:test';
import assert from 'node:assert/strict';
import type { HeroRankRecord } from '../types/mlbb';
import {
  buildWinRateTrendSeries,
  getTrendWindowsForRange,
  selectTopPopularHeroes,
} from './heroTrends';

function makeHero(
  id: number,
  name: string,
  winRate: number,
  pickRate: number,
): HeroRankRecord {
  return {
    data: {
      main_heroid: id,
      main_hero_win_rate: winRate,
      main_hero_appearance_rate: pickRate,
      main_hero_ban_rate: 0.05,
      main_hero: {
        data: {
          name,
          head: `https://example.com/${id}.png`,
        },
      },
    },
  };
}

test('getTrendWindowsForRange returns chronological rolling windows for each date range', () => {
  assert.deepEqual(getTrendWindowsForRange('30'), ['30', '15', '7', '3', '1']);
  assert.deepEqual(getTrendWindowsForRange('15'), ['15', '7', '3', '1']);
  assert.deepEqual(getTrendWindowsForRange('7'), ['7', '3', '1']);
  assert.deepEqual(getTrendWindowsForRange('3'), ['3', '1']);
  assert.deepEqual(getTrendWindowsForRange('1'), ['3', '1']);
});

test('selectTopPopularHeroes picks top 5 heroes sorted by appearance/pick rate descending', () => {
  const pool = [
    makeHero(1, 'Hero A', 0.56, 0.011),
    makeHero(2, 'Hanabi', 0.531, 0.029),
    makeHero(3, 'Tigreal', 0.45, 0.025),
    makeHero(4, 'Miya', 0.504, 0.024),
    makeHero(5, 'Layla', 0.501, 0.026),
    makeHero(6, 'Nana', 0.475, 0.021),
    makeHero(7, 'Estes', 0.52, 0.015),
  ];

  const top5 = selectTopPopularHeroes(pool, 5);
  assert.equal(top5.length, 5);
  assert.deepEqual(
    top5.map((h) => h.data.main_hero.data.name),
    ['Hanabi', 'Layla', 'Tigreal', 'Miya', 'Nana'],
  );
});

test('buildWinRateTrendSeries constructs Recharts data points, deltas, and padded Y domain', () => {
  const hanabi7 = makeHero(60, 'Hanabi', 0.5315, 0.0289);
  const tigreal7 = makeHero(6, 'Tigreal', 0.4495, 0.0246);
  const topHeroes = [hanabi7, tigreal7];

  const result = buildWinRateTrendSeries({
    topHeroes,
    windows: ['7', '3', '1'],
    snapshotsByDay: {
      '7': [hanabi7, tigreal7],
      '3': [
        makeHero(60, 'Hanabi', 0.5334, 0.0293),
        makeHero(6, 'Tigreal', 0.4522, 0.0246),
      ],
      '1': [
        makeHero(60, 'Hanabi', 0.5348, 0.0291),
        makeHero(6, 'Tigreal', 0.454, 0.0247),
      ],
    },
  });

  assert.equal(result.dataPoints.length, 3);
  assert.deepEqual(result.dataPoints[0], {
    window: '7',
    label: '7D',
    hero_60: 53.15,
    hero_6: 44.95,
  });
  assert.deepEqual(result.dataPoints[2], {
    window: '1',
    label: '1D',
    hero_60: 53.48,
    hero_6: 45.4,
  });

  assert.equal(result.series[0].dataKey, 'hero_60');
  assert.equal(result.series[0].latestWinRate, 53.48);
  assert.equal(result.series[0].deltaWinRate, 0.33);
  assert.equal(result.series[1].deltaWinRate, 0.45);
  assert.equal(result.yDomain[0], 43);
  assert.equal(result.yDomain[1], 55);
});
