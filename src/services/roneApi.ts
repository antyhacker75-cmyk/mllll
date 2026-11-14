import type {
  AiMatchupAnalysis,
  AiProTips,
  ApiEnvelope,
  DaysFilter,
  EquipmentRecord,
  FrequentHero,
  HeroDetailRecord,
  HeroMatchupPayload,
  HeroPositionRecord,
  HeroRankRecord,
  HeroSortField,
  PageInfo,
  RankFilter,
  RankRecord,
  SortOrder,
  UserAuthLoginData,
  UserFriend,
  UserInfo,
  UserMatch,
  UserStats,
  WinRateCalcResponse,
} from '../types/mlbb';

const API_BASE = '/api/mlbb';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      payload?.detail?.[0]?.msg ||
      payload?.message ||
      payload?.msg ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  if (payload && typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(payload.message || payload.msg || `API error code ${payload.code}`);
  }

  return payload as T;
}

export async function sendVerificationCode(roleId: number, zoneId: number): Promise<void> {
  await requestJson<ApiEnvelope<string>>('/user/auth/send-vc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_id: roleId, zone_id: zoneId }),
  });
}

export async function loginWithVerificationCode(
  roleId: number,
  zoneId: number,
  vc: number,
): Promise<UserAuthLoginData> {
  const res = await requestJson<ApiEnvelope<UserAuthLoginData>>('/user/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_id: roleId, zone_id: zoneId, vc }),
  });
  return res.data;
}

export async function fetchUserInfo(jwt: string): Promise<UserInfo> {
  const res = await requestJson<ApiEnvelope<UserInfo>>('/user/info?lang=en', {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return res.data;
}

export async function fetchUserStats(jwt: string): Promise<UserStats> {
  const res = await requestJson<ApiEnvelope<UserStats>>('/user/stats?lang=en', {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return res.data;
}

export async function fetchUserSeasons(jwt: string): Promise<number[]> {
  const res = await requestJson<ApiEnvelope<{ sids?: number[] }>>('/user/season?lang=en', {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return res.data?.sids || [];
}

export async function fetchUserMatches(
  jwt: string,
  sid: number,
  limit = 15,
  lastCursor?: string | number,
): Promise<{ matches: UserMatch[]; pageInfo: PageInfo }> {
  const params = new URLSearchParams({ sid: String(sid), limit: String(limit), lang: 'en' });
  if (lastCursor) params.set('last_cursor', String(lastCursor));
  const res = await requestJson<ApiEnvelope<unknown>>(`/user/matches?${params}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const d = res.data as Record<string, unknown>;
  const matches = (d?.matches || d?.records || d?.list || (Array.isArray(d) ? d : [])) as UserMatch[];
  const pageInfo = (d?.pageInfo || { hasNext: false }) as PageInfo;
  return { matches, pageInfo };
}

export async function fetchUserFrequentHeroes(
  jwt: string,
  sid: number,
  limit = 12,
): Promise<{ heroes: FrequentHero[]; pageInfo: PageInfo }> {
  const params = new URLSearchParams({ sid: String(sid), limit: String(limit), lang: 'en' });
  const res = await requestJson<ApiEnvelope<unknown>>(`/user/heroes/frequent?${params}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const d = res.data as Record<string, unknown>;
  const heroes = (d?.heroes || d?.records || d?.list || (Array.isArray(d) ? d : [])) as FrequentHero[];
  const pageInfo = (d?.pageInfo || { hasNext: false }) as PageInfo;
  return { heroes, pageInfo };
}

export async function fetchUserFriends(jwt: string, sid: number): Promise<UserFriend[]> {
  const params = new URLSearchParams({ sid: String(sid), lang: 'en' });
  const res = await requestJson<ApiEnvelope<unknown>>(`/user/friends?${params}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const d = res.data as Record<string, unknown>;
  return (d?.fs || d?.friends || []) as UserFriend[];
}

export async function fetchHeroRanks(opts: {
  days: DaysFilter;
  rank: RankFilter;
  sortField: HeroSortField;
  sortOrder: SortOrder;
  size?: number;
}): Promise<{ records: HeroRankRecord[]; total: number }> {
  const params = new URLSearchParams({
    days: opts.days,
    rank: opts.rank,
    sort_field: opts.sortField,
    sort_order: opts.sortOrder,
    size: String(opts.size ?? 150),
    index: '1',
    lang: 'en',
  });
  const res = await requestJson<ApiEnvelope<{ records: HeroRankRecord[]; total: number }>>(
    `/heroes/rank?${params}`,
  );
  return { records: res.data?.records || [], total: res.data?.total || 0 };
}

export async function fetchHeroPositions(): Promise<HeroPositionRecord[]> {
  const res = await requestJson<ApiEnvelope<{ records: HeroPositionRecord[] }>>(
    '/heroes/positions?size=160&index=1&lang=en',
  );
  return res.data?.records || [];
}

export async function fetchHeroDetail(heroId: number): Promise<HeroDetailRecord | null> {
  const res = await requestJson<ApiEnvelope<{ records: HeroDetailRecord[] }>>(
    `/heroes/${heroId}?lang=en`,
  );
  return res.data?.records?.[0] || null;
}

export async function fetchHeroCounters(heroId: number, rank: RankFilter = 'mythic'): Promise<HeroRankRecord | null> {
  const res = await requestJson<ApiEnvelope<{ records: HeroRankRecord[] }>>(
    `/heroes/${heroId}/counters?days=7&rank=${rank}&lang=en`,
  );
  return res.data?.records?.[0] || null;
}

export async function fetchHeroCompatibility(
  heroId: number,
  rank: RankFilter = 'mythic',
): Promise<HeroRankRecord | null> {
  const res = await requestJson<ApiEnvelope<{ records: HeroRankRecord[] }>>(
    `/heroes/${heroId}/compatibility?days=7&rank=${rank}&lang=en`,
  );
  return res.data?.records?.[0] || null;
}

export async function fetchAcademyRanks(): Promise<RankRecord[]> {
  const res = await requestJson<ApiEnvelope<{ records: RankRecord[] }>>(
    '/academy/ranks?size=50&index=1&lang=en',
  );
  return res.data?.records || [];
}

export async function fetchGameVersion(): Promise<string | null> {
  try {
    const res = await requestJson<
      ApiEnvelope<{ records: Array<{ data?: { game_version?: string } }> }>
    >('/academy/meta/version?size=1&index=1&lang=en');
    return res.data?.records?.[0]?.data?.game_version || null;
  } catch {
    return null;
  }
}

export async function calculateConsecutiveWins(
  matchNow: number,
  wrNow: number,
  wrFuture: number,
): Promise<WinRateCalcResponse> {
  const params = new URLSearchParams({
    'match-now': String(matchNow),
    'wr-now': String(wrNow),
    'wr-future': String(wrFuture),
  });
  return requestJson<WinRateCalcResponse>(`/addon/win-rate-calculator?${params}`);
}

export async function fetchEquipmentExpanded(): Promise<EquipmentRecord[]> {
  const res = await requestJson<ApiEnvelope<{ records: EquipmentRecord[] }>>(
    '/academy/equipment/expanded?size=200&index=1&lang=en',
  );
  return res.data?.records || [];
}

export async function fetchAiMatchupAnalysis(
  payload: HeroMatchupPayload,
  forceRefresh = false,
): Promise<AiMatchupAnalysis> {
  const res = await fetch('/api/ai/matchup-analysis', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ payload, forceRefresh }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.analysis) {
    throw new Error(data?.error || `Matchup analysis unavailable (${res.status})`);
  }
  return data.analysis as AiMatchupAnalysis;
}

export async function fetchAiProTips(
  payload: HeroMatchupPayload,
  forceRefresh = false,
): Promise<AiProTips> {
  const res = await fetch('/api/ai/pro-tips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ payload, forceRefresh }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.proTips) {
    throw new Error(data?.error || `Pro Tips unavailable (${res.status})`);
  }
  return data.proTips as AiProTips;
}

