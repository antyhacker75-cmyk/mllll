import type { FrequentHero, UserMatch } from '../types/mlbb';
import { SAMPLE_PLAYER_DOSSIER, type PlayerDossierData } from './samplePlayer';

function buildQuickDossier(opts: {
  name: string;
  roleId: number;
  zoneId: number;
  region: string;
  level: number;
  rankLevel: number;
  peakRankLevel: number;
  matchesTotal: number;
  winRatePct: number;
  mvpCount: number;
  streak: number;
  hours: number;
  avgScore: number;
  mainHeroes: Array<{
    hid: number;
    name: string;
    laneId: number;
    matches: number;
    wins: number;
    mmr: number;
    avgScore: number;
  }>;
  highlights: {
    kills: { v: number; hid: number; n: string };
    assists: { v: number; hid: number; n: string };
    score: { v: number; hid: number; n: string };
    gold: { v: number; hid: number; n: string };
    dmg: { v: number; hid: number; n: string };
    tanked: { v: number; hid: number; n: string };
  };
  friends: Array<{ name: string; roleId: number; zoneId: number; level: number; games: number; wins: number }>;
}): PlayerDossierData {
  const winsTotal = Math.round((opts.matchesTotal * opts.winRatePct) / 100);
  const totalSeasonMatches = opts.mainHeroes.reduce((acc, h) => acc + h.matches, 0) || 1;

  const frequent39: FrequentHero[] = opts.mainHeroes.map((h) => ({
    hid: h.hid,
    tc: h.matches,
    wc: h.wins,
    bs: h.avgScore,
    mr: h.mmr,
    mrp: Number(((h.matches / totalSeasonMatches) * 100).toFixed(1)),
    p: h.mmr,
    hid_e: { id: h.hid, n: h.name, ix: '' },
  }));

  const matches39: UserMatch[] = opts.mainHeroes.flatMap((h, idx) => [
    {
      sid: 39,
      bid: opts.roleId + idx * 10 + 1,
      hid: h.hid,
      k: h.laneId === 3 ? 2 : 9 - idx,
      d: 2 + (idx % 3),
      a: h.laneId === 3 ? 19 : 7 + idx,
      lid: h.laneId,
      s: Math.min(1350, h.avgScore + 160),
      mvp: idx === 0 ? 1 : 0,
      res: 1,
      ts: 1794650000 - idx * 21600,
      hid_e: { id: h.hid, n: h.name, ix: '' },
    },
    {
      sid: 39,
      bid: opts.roleId + idx * 10 + 2,
      hid: h.hid,
      k: h.laneId === 3 ? 1 : 6,
      d: idx === 1 ? 4 : 2,
      a: h.laneId === 3 ? 15 : 8,
      lid: h.laneId,
      s: Math.max(680, h.avgScore - (idx === 1 ? 110 : 0)),
      mvp: 0,
      res: idx === 1 ? 0 : 1,
      ts: 1794620000 - idx * 25200,
      hid_e: { id: h.hid, n: h.name, ix: '' },
    },
  ]);

  return {
    mode: 'directory',
    info: {
      avatar: '',
      name: opts.name,
      level: opts.level,
      rank_level: opts.rankLevel,
      history_rank_level: opts.peakRankLevel,
      reg_country: opts.region,
      roleId: opts.roleId,
      zoneId: opts.zoneId,
    },
    stats: {
      wc: winsTotal,
      tc: opts.matchesTotal,
      as: opts.avgScore,
      gt: opts.hours,
      mvpc: opts.mvpCount,
      wsc: opts.streak,
      hk: { v: opts.highlights.kills.v, ts: 1794100000, hid: opts.highlights.kills.hid, n: opts.highlights.kills.n, ix: '' },
      ma: { v: opts.highlights.assists.v, ts: 1793900000, hid: opts.highlights.assists.hid, n: opts.highlights.assists.n, ix: '' },
      ms: { v: opts.highlights.score.v, ts: 1794200000, hid: opts.highlights.score.hid, n: opts.highlights.score.n, ix: '' },
      mg: { v: opts.highlights.gold.v, ts: 1794000000, hid: opts.highlights.gold.hid, n: opts.highlights.gold.n, ix: '' },
      mtd: { v: opts.highlights.dmg.v, ts: 1793950000, hid: opts.highlights.dmg.hid, n: opts.highlights.dmg.n, ix: '' },
      mdt: { v: opts.highlights.tanked.v, ts: 1793700000, hid: opts.highlights.tanked.hid, n: opts.highlights.tanked.n, ix: '' },
    },
    seasons: [39, 38],
    matchesBySeason: {
      39: matches39,
      38: matches39.slice(0, 3).map((m, i) => ({ ...m, sid: 38, bid: m.bid + 999, ts: 1789000000 - i * 40000 })),
    },
    frequentBySeason: {
      39: frequent39,
      38: frequent39.slice(0, 3).map((f) => ({ ...f, tc: Math.max(12, Math.round(f.tc * 0.8)) })),
    },
    friends: opts.friends.map((fr) => ({
      frid: fr.roleId,
      fzid: fr.zoneId,
      cl: fr.level,
      tbc: fr.games,
      twc: fr.wins,
      f: { rid: fr.roleId, zid: fr.zoneId, n: fr.name, pri: false },
    })),
  };
}

export const PLAYER_DIRECTORY: PlayerDossierData[] = [
  SAMPLE_PLAYER_DOSSIER,
  buildQuickDossier({
    name: 'Kairi',
    roleId: 100482911,
    zoneId: 3021,
    region: 'PH',
    level: 88,
    rankLevel: 328,
    peakRankLevel: 342,
    matchesTotal: 9120,
    winRatePct: 74.8,
    mvpCount: 2840,
    streak: 29,
    hours: 2940,
    avgScore: 980,
    mainHeroes: [
      { hid: 21, name: 'Hayabusa', laneId: 4, matches: 164, wins: 129, mmr: 6840, avgScore: 1020 },
      { hid: 84, name: 'Ling', laneId: 4, matches: 142, wins: 107, mmr: 6410, avgScore: 990 },
      { hid: 116, name: 'Julian', laneId: 4, matches: 96, wins: 71, mmr: 5890, avgScore: 940 },
      { hid: 126, name: 'Suyou', laneId: 4, matches: 84, wins: 62, mmr: 5620, avgScore: 930 },
    ],
    highlights: {
      kills: { v: 26, hid: 21, n: 'Hayabusa' },
      assists: { v: 21, hid: 116, n: 'Julian' },
      score: { v: 1490, hid: 84, n: 'Ling' },
      gold: { v: 22400, hid: 84, n: 'Ling' },
      dmg: { v: 198500, hid: 21, n: 'Hayabusa' },
      tanked: { v: 142000, hid: 116, n: 'Julian' },
    },
    friends: [
      { name: 'Sanz', roleId: 204918221, zoneId: 2411, level: 84, games: 318, wins: 244 },
      { name: 'Kiboy', roleId: 219048112, zoneId: 2412, level: 82, games: 294, wins: 220 },
      { name: 'Oheb', roleId: 118492011, zoneId: 3014, level: 81, games: 112, wins: 85 },
    ],
  }),
  buildQuickDossier({
    name: 'Sanz',
    roleId: 204918221,
    zoneId: 2411,
    region: 'ID',
    level: 84,
    rankLevel: 314,
    peakRankLevel: 325,
    matchesTotal: 8450,
    winRatePct: 72.1,
    mvpCount: 2410,
    streak: 24,
    hours: 2710,
    avgScore: 950,
    mainHeroes: [
      { hid: 112, name: 'Valentina', laneId: 2, matches: 158, wins: 119, mmr: 6510, avgScore: 970 },
      { hid: 107, name: 'Yve', laneId: 2, matches: 124, wins: 91, mmr: 6020, avgScore: 940 },
      { hid: 93, name: 'Cecilion', laneId: 2, matches: 98, wins: 70, mmr: 5540, avgScore: 920 },
    ],
    highlights: {
      kills: { v: 19, hid: 112, n: 'Valentina' },
      assists: { v: 28, hid: 107, n: 'Yve' },
      score: { v: 1410, hid: 112, n: 'Valentina' },
      gold: { v: 19600, hid: 93, n: 'Cecilion' },
      dmg: { v: 214000, hid: 93, n: 'Cecilion' },
      tanked: { v: 118000, hid: 112, n: 'Valentina' },
    },
    friends: [
      { name: 'Kairi', roleId: 100482911, zoneId: 3021, level: 88, games: 318, wins: 244 },
      { name: 'Kiboy', roleId: 219048112, zoneId: 2412, level: 82, games: 405, wins: 301 },
    ],
  }),
  buildQuickDossier({
    name: 'Kiboy',
    roleId: 219048112,
    zoneId: 2412,
    region: 'ID',
    level: 82,
    rankLevel: 302,
    peakRankLevel: 318,
    matchesTotal: 10240,
    winRatePct: 69.5,
    mvpCount: 1980,
    streak: 21,
    hours: 3120,
    avgScore: 910,
    mainHeroes: [
      { hid: 58, name: 'Khufra', laneId: 3, matches: 190, wins: 135, mmr: 6290, avgScore: 930 },
      { hid: 10, name: 'Tigreal', laneId: 3, matches: 132, wins: 92, mmr: 5840, avgScore: 900 },
      { hid: 55, name: 'Angela', laneId: 3, matches: 94, wins: 67, mmr: 5490, avgScore: 910 },
    ],
    highlights: {
      kills: { v: 9, hid: 58, n: 'Khufra' },
      assists: { v: 36, hid: 55, n: 'Angela' },
      score: { v: 1340, hid: 58, n: 'Khufra' },
      gold: { v: 15200, hid: 58, n: 'Khufra' },
      dmg: { v: 92400, hid: 58, n: 'Khufra' },
      tanked: { v: 298000, hid: 58, n: 'Khufra' },
    },
    friends: [
      { name: 'Sanz', roleId: 204918221, zoneId: 2411, level: 84, games: 405, wins: 301 },
      { name: 'Kairi', roleId: 100482911, zoneId: 3021, level: 88, games: 294, wins: 220 },
    ],
  }),
  buildQuickDossier({
    name: 'Oheb',
    roleId: 118492011,
    zoneId: 3014,
    region: 'PH',
    level: 81,
    rankLevel: 294,
    peakRankLevel: 308,
    matchesTotal: 7880,
    winRatePct: 71.4,
    mvpCount: 2290,
    streak: 23,
    hours: 2480,
    avgScore: 945,
    mainHeroes: [
      { hid: 105, name: 'Beatrix', laneId: 5, matches: 175, wins: 129, mmr: 6180, avgScore: 965 },
      { hid: 65, name: 'Claude', laneId: 5, matches: 128, wins: 91, mmr: 5790, avgScore: 930 },
      { hid: 60, name: 'Hanabi', laneId: 5, matches: 76, wins: 54, mmr: 5120, avgScore: 895 },
    ],
    highlights: {
      kills: { v: 24, hid: 105, n: 'Beatrix' },
      assists: { v: 19, hid: 65, n: 'Claude' },
      score: { v: 1440, hid: 105, n: 'Beatrix' },
      gold: { v: 24100, hid: 105, n: 'Beatrix' },
      dmg: { v: 232000, hid: 105, n: 'Beatrix' },
      tanked: { v: 108000, hid: 65, n: 'Claude' },
    },
    friends: [
      { name: 'Pheww', roleId: 129481022, zoneId: 3018, level: 79, games: 244, wins: 176 },
      { name: 'Kairi', roleId: 100482911, zoneId: 3021, level: 88, games: 112, wins: 85 },
    ],
  }),
  buildQuickDossier({
    name: 'Skylar',
    roleId: 230491822,
    zoneId: 2415,
    region: 'ID',
    level: 79,
    rankLevel: 263,
    peakRankLevel: 284,
    matchesTotal: 9550,
    winRatePct: 70.3,
    mvpCount: 2510,
    streak: 19,
    hours: 2890,
    avgScore: 925,
    mainHeroes: [
      { hid: 65, name: 'Claude', laneId: 5, matches: 184, wins: 132, mmr: 5680, avgScore: 950 },
      { hid: 105, name: 'Beatrix', laneId: 5, matches: 118, wins: 83, mmr: 5340, avgScore: 915 },
      { hid: 1, name: 'Miya', laneId: 5, matches: 62, wins: 44, mmr: 4820, avgScore: 880 },
    ],
    highlights: {
      kills: { v: 23, hid: 65, n: 'Claude' },
      assists: { v: 20, hid: 65, n: 'Claude' },
      score: { v: 1390, hid: 65, n: 'Claude' },
      gold: { v: 23600, hid: 65, n: 'Claude' },
      dmg: { v: 221000, hid: 65, n: 'Claude' },
      tanked: { v: 98500, hid: 105, n: 'Beatrix' },
    },
    friends: [
      { name: 'Sanz', roleId: 204918221, zoneId: 2411, level: 84, games: 145, wins: 104 },
    ],
  }),
  buildQuickDossier({
    name: 'Chibi',
    roleId: 310482910,
    zoneId: 2208,
    region: 'MY',
    level: 76,
    rankLevel: 281,
    peakRankLevel: 292,
    matchesTotal: 7140,
    winRatePct: 68.2,
    mvpCount: 1840,
    streak: 17,
    hours: 2210,
    avgScore: 905,
    mainHeroes: [
      { hid: 84, name: 'Ling', laneId: 4, matches: 152, wins: 108, mmr: 5940, avgScore: 945 },
      { hid: 21, name: 'Hayabusa', laneId: 4, matches: 108, wins: 74, mmr: 5510, avgScore: 910 },
      { hid: 95, name: 'Yu Zhong', laneId: 1, matches: 64, wins: 42, mmr: 4890, avgScore: 870 },
    ],
    highlights: {
      kills: { v: 22, hid: 84, n: 'Ling' },
      assists: { v: 18, hid: 21, n: 'Hayabusa' },
      score: { v: 1360, hid: 84, n: 'Ling' },
      gold: { v: 21800, hid: 84, n: 'Ling' },
      dmg: { v: 189000, hid: 84, n: 'Ling' },
      tanked: { v: 164000, hid: 95, n: 'Yu Zhong' },
    },
    friends: [
      { name: 'Diablo', roleId: 410293841, zoneId: 2501, level: 74, games: 168, wins: 119 },
    ],
  }),
  buildQuickDossier({
    name: 'Diablo',
    roleId: 410293841,
    zoneId: 2501,
    region: 'SG',
    level: 74,
    rankLevel: 274,
    peakRankLevel: 285,
    matchesTotal: 6900,
    winRatePct: 67.6,
    mvpCount: 1610,
    streak: 16,
    hours: 2150,
    avgScore: 890,
    mainHeroes: [
      { hid: 95, name: 'Yu Zhong', laneId: 1, matches: 146, wins: 101, mmr: 5810, avgScore: 915 },
      { hid: 88, name: 'Masha', laneId: 1, matches: 98, wins: 69, mmr: 5420, avgScore: 895 },
      { hid: 106, name: 'Phoveus', laneId: 1, matches: 72, wins: 48, mmr: 4980, avgScore: 875 },
    ],
    highlights: {
      kills: { v: 17, hid: 95, n: 'Yu Zhong' },
      assists: { v: 24, hid: 95, n: 'Yu Zhong' },
      score: { v: 1290, hid: 88, n: 'Masha' },
      gold: { v: 18700, hid: 88, n: 'Masha' },
      dmg: { v: 174000, hid: 95, n: 'Yu Zhong' },
      tanked: { v: 265000, hid: 95, n: 'Yu Zhong' },
    },
    friends: [
      { name: 'Chibi', roleId: 310482910, zoneId: 2208, level: 76, games: 168, wins: 119 },
    ],
  }),
  buildQuickDossier({
    name: 'Pheww',
    roleId: 129481022,
    zoneId: 3018,
    region: 'PH',
    level: 79,
    rankLevel: 258,
    peakRankLevel: 279,
    matchesTotal: 7600,
    winRatePct: 68.7,
    mvpCount: 2040,
    streak: 18,
    hours: 2410,
    avgScore: 915,
    mainHeroes: [
      { hid: 107, name: 'Yve', laneId: 2, matches: 148, wins: 105, mmr: 5540, avgScore: 930 },
      { hid: 112, name: 'Valentina', laneId: 2, matches: 114, wins: 79, mmr: 5260, avgScore: 910 },
      { hid: 93, name: 'Cecilion', laneId: 2, matches: 86, wins: 59, mmr: 4910, avgScore: 890 },
    ],
    highlights: {
      kills: { v: 18, hid: 112, n: 'Valentina' },
      assists: { v: 31, hid: 107, n: 'Yve' },
      score: { v: 1350, hid: 107, n: 'Yve' },
      gold: { v: 19200, hid: 93, n: 'Cecilion' },
      dmg: { v: 218000, hid: 93, n: 'Cecilion' },
      tanked: { v: 112000, hid: 112, n: 'Valentina' },
    },
    friends: [
      { name: 'Oheb', roleId: 118492011, zoneId: 3014, level: 81, games: 244, wins: 176 },
    ],
  }),
  buildQuickDossier({
    name: 'AriaSenpai',
    roleId: 401293811,
    zoneId: 2418,
    region: 'ID',
    level: 58,
    rankLevel: 198,
    peakRankLevel: 224,
    matchesTotal: 2910,
    winRatePct: 61.2,
    mvpCount: 612,
    streak: 12,
    hours: 940,
    avgScore: 865,
    mainHeroes: [
      { hid: 55, name: 'Angela', laneId: 3, matches: 112, wins: 73, mmr: 3420, avgScore: 890 },
      { hid: 34, name: 'Estes', laneId: 3, matches: 84, wins: 53, mmr: 3110, avgScore: 870 },
      { hid: 93, name: 'Cecilion', laneId: 2, matches: 52, wins: 31, mmr: 2680, avgScore: 830 },
    ],
    highlights: {
      kills: { v: 11, hid: 93, n: 'Cecilion' },
      assists: { v: 34, hid: 55, n: 'Angela' },
      score: { v: 1260, hid: 55, n: 'Angela' },
      gold: { v: 16400, hid: 93, n: 'Cecilion' },
      dmg: { v: 158000, hid: 93, n: 'Cecilion' },
      tanked: { v: 176000, hid: 34, n: 'Estes' },
    },
    friends: [
      { name: 'KaelVortex', roleId: 184920312, zoneId: 2418, level: 64, games: 84, wins: 57 },
      { name: 'NoxRoam', roleId: 519204412, zoneId: 2419, level: 61, games: 62, wins: 40 },
    ],
  }),
  buildQuickDossier({
    name: 'NoxRoam',
    roleId: 519204412,
    zoneId: 2419,
    region: 'ID',
    level: 61,
    rankLevel: 192,
    peakRankLevel: 215,
    matchesTotal: 3280,
    winRatePct: 58.9,
    mvpCount: 540,
    streak: 11,
    hours: 1090,
    avgScore: 840,
    mainHeroes: [
      { hid: 10, name: 'Tigreal', laneId: 3, matches: 134, wins: 82, mmr: 3390, avgScore: 865 },
      { hid: 58, name: 'Khufra', laneId: 3, matches: 92, wins: 55, mmr: 3040, avgScore: 845 },
      { hid: 87, name: 'Gloo', laneId: 1, matches: 48, wins: 29, mmr: 2590, avgScore: 820 },
    ],
    highlights: {
      kills: { v: 8, hid: 87, n: 'Gloo' },
      assists: { v: 31, hid: 10, n: 'Tigreal' },
      score: { v: 1210, hid: 58, n: 'Khufra' },
      gold: { v: 14100, hid: 87, n: 'Gloo' },
      dmg: { v: 98000, hid: 87, n: 'Gloo' },
      tanked: { v: 274000, hid: 10, n: 'Tigreal' },
    },
    friends: [
      { name: 'KaelVortex', roleId: 184920312, zoneId: 2418, level: 64, games: 52, wins: 33 },
      { name: 'AriaSenpai', roleId: 401293811, zoneId: 2418, level: 58, games: 62, wins: 40 },
    ],
  }),
  buildQuickDossier({
    name: 'SoraMid',
    roleId: 773190221,
    zoneId: 2104,
    region: 'MY',
    level: 49,
    rankLevel: 174,
    peakRankLevel: 196,
    matchesTotal: 2140,
    winRatePct: 56.8,
    mvpCount: 412,
    streak: 9,
    hours: 720,
    avgScore: 825,
    mainHeroes: [
      { hid: 15, name: 'Eudora', laneId: 2, matches: 96, wins: 57, mmr: 2940, avgScore: 850 },
      { hid: 93, name: 'Cecilion', laneId: 2, matches: 74, wins: 43, mmr: 2760, avgScore: 835 },
      { hid: 25, name: 'Kagura', laneId: 2, matches: 52, wins: 30, mmr: 2510, avgScore: 815 },
    ],
    highlights: {
      kills: { v: 19, hid: 15, n: 'Eudora' },
      assists: { v: 22, hid: 93, n: 'Cecilion' },
      score: { v: 1240, hid: 15, n: 'Eudora' },
      gold: { v: 17800, hid: 93, n: 'Cecilion' },
      dmg: { v: 172000, hid: 93, n: 'Cecilion' },
      tanked: { v: 86000, hid: 25, n: 'Kagura' },
    },
    friends: [
      { name: 'KaelVortex', roleId: 184920312, zoneId: 2418, level: 64, games: 31, wins: 18 },
    ],
  }),
];
