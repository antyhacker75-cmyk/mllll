export type RankFilter = 'all' | 'epic' | 'legend' | 'mythic' | 'honor' | 'glory';
export type DaysFilter = '1' | '3' | '7' | '15' | '30';
export type HeroSortField = 'win_rate' | 'pick_rate' | 'ban_rate';
export type SortOrder = 'asc' | 'desc';
export type RoleFilter = 'all' | 'tank' | 'fighter' | 'assassin' | 'mage' | 'marksman' | 'support';
export type LaneFilter = 'all' | 'exp' | 'mid' | 'roam' | 'jungle' | 'gold';

export interface ApiEnvelope<T> {
  code: number;
  message?: string;
  msg?: string;
  data: T;
}

export interface UserAuthLoginData {
  jwt: string;
  token: string;
  roleid: number;
  zoneid: number;
  time: number;
  name?: string;
  email?: string;
  mobile?: string;
  open_id?: string;
}

export interface UserInfo {
  avatar: string;
  name: string;
  level: number;
  rank_level: number;
  history_rank_level: number;
  reg_country: string;
  roleId: number;
  zoneId: number;
}

export interface StatHighlight {
  v: number;
  ts: number;
  hid: number;
  n: string;
  ix: string;
  i2x?: string;
  bid?: number | string;
}

export interface UserStats {
  wc: number;
  tc: number;
  as: number;
  gt: number;
  mvpc: number;
  wsc: number;
  mo?: StatHighlight;
  hk?: StatHighlight;
  ma?: StatHighlight;
  ms?: StatHighlight;
  mdt?: StatHighlight;
  mg?: StatHighlight;
  mtd?: StatHighlight;
}

export interface HeroEntityRef {
  id: number;
  n: string;
  ix: string;
  i2x?: string;
}

export interface UserMatch {
  sid: number;
  bid: number;
  bid_s?: string;
  hid: number;
  k: number;
  d: number;
  a: number;
  lid: number;
  s: number;
  mvp: number;
  res: number;
  ts: number;
  hid_e?: HeroEntityRef;
}

export interface PageInfo {
  nextCursor?: string | number;
  hasNext: boolean;
  count?: number;
}

export interface UserMatchesPayload {
  matches: UserMatch[];
  pageInfo: PageInfo;
}

export interface FrequentHero {
  hid: number;
  tc: number;
  wc: number;
  bs: number;
  mr: number;
  mrp: number;
  p: number;
  hid_e?: HeroEntityRef;
}

export interface UserFrequentHeroesPayload {
  heroes: FrequentHero[];
  pageInfo: PageInfo;
}

export interface UserFriend {
  f?: {
    rid: number;
    zid: number;
    n?: string;
    ax?: string;
    pri?: boolean;
  };
  frid: number;
  fzid: number;
  cl?: number;
  l?: number;
  tbc: number;
  twc: number;
}

export interface SubHeroEntry {
  heroid: number;
  increase_win_rate: number;
  hero?: {
    data?: {
      head?: string;
      name?: string;
    };
  };
}

export interface HeroRankRecord {
  data: {
    main_heroid: number;
    main_hero_win_rate: number;
    main_hero_appearance_rate: number;
    main_hero_ban_rate: number;
    main_hero: {
      data: {
        name: string;
        head: string;
      };
    };
    sub_hero?: SubHeroEntry[];
  };
}

export interface HeroPositionRecord {
  data: {
    hero_id: number;
    hero: {
      data: {
        name: string;
        smallmap?: string;
        roadsort?: Array<
          | {
              data?: {
                road_sort_id?: string;
                road_sort_title?: string;
                road_sort_icon?: string;
              };
            }
          | string
        >;
        sortid?: Array<
          | {
              data?: {
                sort_id?: string;
                sort_title?: string;
                sort_icon?: string;
              };
            }
          | string
        >;
      };
    };
    relation?: {
      assist?: { target_hero_id?: number[] };
      strong?: { target_hero_id?: number[] };
      weak?: { target_hero_id?: number[] };
    };
  };
}

export interface HeroSkill {
  skillid?: number | string;
  skillname: string;
  skilldesc: string;
  skillicon: string;
  'skillcd&cost'?: string;
  skilltag?: Array<{
    tagid?: number;
    tagname: string;
    tagrgb?: string;
  }>;
}

export interface HeroDetailRecord {
  data: {
    head: string;
    head_big?: string;
    hero: {
      data: {
        heroid: number;
        name: string;
        story?: string;
        painting?: string;
        speciality?: string[];
        abilityshow?: string[];
        difficulty?: string;
        heroskilllist?: Array<{
          skilllist?: HeroSkill[];
        }>;
      };
    };
  };
}

export interface RankRecord {
  id: number;
  caption: string;
  data: {
    bigrank: number;
    bigrank_name: string;
    icon: string;
    minrank?: string;
    minrank_name?: string;
    rankid_start: number;
    rankid_end: number;
  };
}

export interface WinRateCalcResponse {
  status: string;
  match_now: number;
  wr_now: number;
  wr_future: number;
  required_no_lose_matches: number;
  message: string;
}

export interface ResolvedRank {
  tierName: string;
  division: string;
  fullLabel: string;
  stars: number | null;
  icon?: string;
  bigrank: number;
}

export interface EquipmentRecord {
  id: number;
  data: {
    equipid: number;
    equipname: string;
    equipicon: string;
    equiptype?: string;
    equiptypename?: string;
    equipskilldesc?: string;
    equiptips?: string;
    equipskill1?: string;
    equipskill2?: string;
    equipskill3?: string;
    equipskill4?: string;
    equipskill5?: string;
  };
}

export interface LeaderboardPlayer {
  rank: number;
  playerName: string;
  region: string;
  regionLabel: string;
  rankLevel: number;
  winRate: number;
  matches: number;
  mmr: number;
  mainHeroId: number;
  mainHeroName: string;
}

export type RecommendationCategory = 'counter' | 'sustain' | 'damage' | 'defense';

export interface ItemRecommendation {
  equipName: string;
  equipId?: number;
  icon?: string;
  typeLabel: string;
  category: RecommendationCategory;
  priority: 'Core Counter' | 'High' | 'Situational';
  statsSummary: string;
  reasons: string[];
  score: number;
}

export interface DraftThreatSummary {
  physicalCount: number;
  magicCount: number;
  healerCount: number;
  tankCount: number;
  burstCount: number;
  ccCount: number;
  allyHealerCount: number;
  allyFrontlineCount: number;
  notes: string[];
}

export interface DraftAnalysis {
  threats: DraftThreatSummary;
  recommendations: ItemRecommendation[];
}

export interface HeroCounterBaselineItem {
  equipName: string;
  icon?: string;
  typeLabel: string;
  statsSummary: string;
  reason: string;
}

export interface HeroMatchupPayload {
  heroId: number;
  heroName: string;
  rankTier: string;
  roles: string[];
  lanes: string[];
  speciality: string[];
  winRatePct: number | null;
  pickRatePct: number | null;
  banRatePct: number | null;
  strongAgainst: Array<{ name: string; winRateBoostPct: number }>;
  bestTeammates: Array<{ name: string; winRateBoostPct: number }>;
  skills: Array<{ slot?: string; name: string; cooldownCost?: string; summary: string }>;
  counterItems: HeroCounterBaselineItem[];
}

export interface AiMatchupAnalysis {
  overview: string;
  counterStrategies: string[];
  itemBuildAdvice: Array<{ itemName: string; reason: string }>;
  draftVerdict: string;
}

export interface SkillComboStep {
  slot: string;
  label: string;
}

export interface RecommendedSkillCombo {
  title: string;
  sequence: SkillComboStep[];
  whenToUse: string;
}

export interface AiProTips {
  playstyleSummary: string;
  skillPriority: {
    orderLabel: string;
    skillsToPrioritize: Array<{ slot: string; skillName: string; reason: string }>;
  };
  recommendedCombos: RecommendedSkillCombo[];
  comboAndExecution: string[];
  teamfightPositioning: string;
  powerSpikesAndMacro: string;
}

export interface TeamComboRecommendation {
  partnerHeroId: number;
  partnerName: string;
  partnerHead: string;
  partnerRole: string;
  synergyLabel: string;
  winRateBoostPct: number | null;
  comboNote: string;
  alreadyInTeam: boolean;
}

export interface HeroBaseStatsProfile {
  baseHp: number;
  hpGrowth: number;
  basePhysAtk: number;
  physAtkGrowth: number;
  basePhysDef: number;
  physDefGrowth: number;
  baseMagicDef: number;
  magicDefGrowth: number;
  moveSpeed: number;
  baseAtkSpeed: number;
  atkSpeedGrowthPct: number;
  source: 'catalog' | 'role-calibrated';
}

export interface HeroSkillUtilitySlot {
  slotLabel: string;
  name: string;
  icon: string;
  cooldownSec: number | null;
  cooldownText: string;
  costText: string;
  tags: string[];
  summary: string;
}

export interface SkillUtilitySummary {
  slots: HeroSkillUtilitySlot[];
  utilityCounts: {
    cc: number;
    mobility: number;
    sustain: number;
    burst: number;
    buff: number;
  };
  avgActiveCdSec: number | null;
  ultCdSec: number | null;
}

export interface FavoriteLineupHero {
  heroId: number;
  name: string;
  head: string;
  roles: string[];
  lanes: string[];
  winRatePct: number | null;
  pickRatePct: number | null;
  banRatePct: number | null;
}

export interface FavoriteHeroLineup {
  id: string;
  name: string;
  heroIds: number[];
  snapshotHeroes: FavoriteLineupHero[];
  savedAt: string;
}

export interface LineupWinRateSummary {
  heroCount: number;
  ratedHeroCount: number;
  averageWinRatePct: number | null;
  averagePickRatePct: number | null;
  averageBanRatePct: number | null;
  deltaFromFiftyPct: number | null;
  highestWrHero: { heroId: number; name: string; winRatePct: number } | null;
  lowestWrHero: { heroId: number; name: string; winRatePct: number } | null;
  roleCoverage: string[];
}

