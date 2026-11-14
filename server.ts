import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { buildDeterministicProTips } from './src/utils/comboEngine.ts';
import { buildDeterministicMatchupAnalysis } from './src/utils/heroMatchup.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RONE_API_BASE = 'https://arena.rone.dev/api';
const PORT = Number(process.env.PORT) || 3000;

interface CacheEntry {
  expiresAt: number;
  status: number;
  body: unknown;
}

const publicGetCache = new Map<string, CacheEntry>();
const PUBLIC_CACHE_TTL_MS = 120_000;

interface AiCacheEntry {
  expiresAt: number;
  analysis: unknown;
}

const aiMatchupCache = new Map<string, AiCacheEntry>();
const aiProTipsCache = new Map<string, AiCacheEntry>();
const AI_CACHE_TTL_MS = 600_000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isCacheablePublicPath(apiPath: string): boolean {
  return (
    apiPath.startsWith('/heroes') ||
    apiPath.startsWith('/academy')
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, upstream: RONE_API_BASE });
  });

  app.post('/api/ai/matchup-analysis', async (req: Request, res: Response) => {
    const { payload, forceRefresh } = (req.body || {}) as {
      payload?: {
        heroId?: number;
        heroName?: string;
        rankTier?: string;
        roles?: string[];
        lanes?: string[];
        speciality?: string[];
        winRatePct?: number | null;
        pickRatePct?: number | null;
        banRatePct?: number | null;
        strongAgainst?: Array<{ name: string; winRateBoostPct: number }>;
        bestTeammates?: Array<{ name: string; winRateBoostPct: number }>;
        skills?: Array<{ name: string; summary: string }>;
        counterItems?: Array<{ equipName: string; typeLabel: string; reason: string }>;
      };
      forceRefresh?: boolean;
    };

    if (!payload || !payload.heroId || !payload.heroName) {
      res.status(400).json({ error: 'Hero matchup context is required.' });
      return;
    }

    const cacheKey = `${payload.heroId}:${payload.rankTier || 'mythic'}`;
    if (!forceRefresh) {
      const cached = aiMatchupCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json({ analysis: cached.analysis, cached: true });
        return;
      }
    }

    const ai = getGeminiClient();
    if (!ai) {
      const analysis = buildDeterministicMatchupAnalysis({
        heroName: payload.heroName,
        rankTier: payload.rankTier,
        roles: payload.roles,
        winRatePct: payload.winRatePct,
        banRatePct: payload.banRatePct,
        strongAgainst: payload.strongAgainst,
        bestTeammates: payload.bestTeammates,
        skills: payload.skills,
        counterItems: payload.counterItems,
      });
      res.json({ analysis, cached: false, fallback: true });
      return;
    }

    const promptText = [
      `Target Hero: ${payload.heroName} (${payload.roles?.join(' / ') || 'Unknown Role'}; Lanes: ${payload.lanes?.join(', ') || 'Flex'}; Specialty: ${payload.speciality?.join(', ') || 'N/A'})`,
      `Ranked Tier (${payload.rankTier || 'mythic'}): Win Rate ${payload.winRatePct ?? 'N/A'}%, Pick Rate ${payload.pickRatePct ?? 'N/A'}%, Ban Rate ${payload.banRatePct ?? 'N/A'}%`,
      `Heroes ${payload.heroName} Performs Best Against (Win Rate Boost): ${
        payload.strongAgainst?.length
          ? payload.strongAgainst.map((s) => `${s.name} (+${s.winRateBoostPct}%)`).join(', ')
          : 'None recorded'
      }`,
      `Top Teammate Synergies: ${
        payload.bestTeammates?.length
          ? payload.bestTeammates.map((t) => `${t.name} (+${t.winRateBoostPct}%)`).join(', ')
          : 'None recorded'
      }`,
      `Skill Kit Summary: ${
        payload.skills?.length
          ? payload.skills.map((k) => `${k.name}: ${k.summary}`).join(' | ')
          : 'Not provided'
      }`,
      `Recommended MLBB Counter Items Against ${payload.heroName}: ${
        payload.counterItems?.length
          ? payload.counterItems.map((i) => `${i.equipName} (${i.typeLabel} — ${i.reason})`).join(' | ')
          : 'General defensive items'
      }`,
      `Provide a concise, high-signal tactical Matchup Analysis explaining how to play and itemize against ${payload.heroName}.`,
    ].join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are a Mythical Immortal Mobile Legends: Bang Bang (MLBB) coach. Summarize the best strategies to counter the target hero based strictly on their win rates, skill windows, matchup synergies, and counter-items. Keep the overview to 2 concise sentences, give exactly 3 sharp counter strategies (under 24 words each), give 3 item build recommendations referencing the provided MLBB counter items, and end with a 1-sentence draft verdict.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overview: {
                type: Type.STRING,
                description: '2-sentence tactical summary of how to beat this hero.',
              },
              counterStrategies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 concise in-game strategies for laning and teamfights against this hero.',
              },
              itemBuildAdvice: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemName: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['itemName', 'reason'],
                },
                description: '3 recommended counter items and why each shuts down this hero.',
              },
              draftVerdict: {
                type: Type.STRING,
                description: '1-sentence summary of win-rate pressure and draft priority against this hero.',
              },
            },
            required: ['overview', 'counterStrategies', 'itemBuildAdvice', 'draftVerdict'],
          },
        },
      });

      const raw = (response.text ?? '').trim();
      const analysis = JSON.parse(raw);

      aiMatchupCache.set(cacheKey, {
        expiresAt: Date.now() + AI_CACHE_TTL_MS,
        analysis,
      });

      res.json({ analysis, cached: false });
    } catch {
      const analysis = buildDeterministicMatchupAnalysis({
        heroName: payload.heroName,
        rankTier: payload.rankTier,
        roles: payload.roles,
        winRatePct: payload.winRatePct,
        banRatePct: payload.banRatePct,
        strongAgainst: payload.strongAgainst,
        bestTeammates: payload.bestTeammates,
        skills: payload.skills,
        counterItems: payload.counterItems,
      });
      res.json({ analysis, cached: false, fallback: true });
    }
  });

  app.post('/api/ai/pro-tips', async (req: Request, res: Response) => {
    const { payload, forceRefresh } = (req.body || {}) as {
      payload?: {
        heroId?: number;
        heroName?: string;
        rankTier?: string;
        roles?: string[];
        lanes?: string[];
        speciality?: string[];
        winRatePct?: number | null;
        pickRatePct?: number | null;
        banRatePct?: number | null;
        strongAgainst?: Array<{ name: string; winRateBoostPct: number }>;
        bestTeammates?: Array<{ name: string; winRateBoostPct: number }>;
        skills?: Array<{ slot?: string; name: string; cooldownCost?: string; summary: string }>;
      };
      forceRefresh?: boolean;
    };

    if (!payload || !payload.heroId || !payload.heroName) {
      res.status(400).json({ error: 'Hero meta context is required.' });
      return;
    }

    const cacheKey = `${payload.heroId}:${payload.rankTier || 'mythic'}`;
    if (!forceRefresh) {
      const cached = aiProTipsCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json({ proTips: cached.analysis, cached: true });
        return;
      }
    }

    const ai = getGeminiClient();
    if (!ai) {
      const proTips = buildDeterministicProTips({
        heroName: payload.heroName,
        rankTier: payload.rankTier,
        roles: payload.roles,
        lanes: payload.lanes,
        speciality: payload.speciality,
        winRatePct: payload.winRatePct,
        strongAgainst: payload.strongAgainst,
        bestTeammates: payload.bestTeammates,
        skills: payload.skills,
      });
      res.json({ proTips, cached: false, fallback: true });
      return;
    }

    const promptText = [
      `Hero: ${payload.heroName} (${payload.roles?.join(' / ') || 'Unknown Role'}; Lanes: ${payload.lanes?.join(', ') || 'Flex'}; Specialty: ${payload.speciality?.join(', ') || 'N/A'})`,
      `Ranked Meta (${payload.rankTier || 'mythic'}): Win Rate ${payload.winRatePct ?? 'N/A'}%, Pick Rate ${payload.pickRatePct ?? 'N/A'}%, Ban Rate ${payload.banRatePct ?? 'N/A'}%`,
      `Ability Kit:\n${
        payload.skills?.length
          ? payload.skills
              .map(
                (k) =>
                  `- [${k.slot || 'Skill'}] ${k.name}${k.cooldownCost ? ` (${k.cooldownCost})` : ''}: ${k.summary}`,
              )
              .join('\n')
          : '- Skill data unavailable'
      }`,
      `Strong Against (Win Rate Boost): ${
        payload.strongAgainst?.length
          ? payload.strongAgainst.map((s) => `${s.name} (+${s.winRateBoostPct}%)`).join(', ')
          : 'None recorded'
      }`,
      `Best Allied Synergies: ${
        payload.bestTeammates?.length
          ? payload.bestTeammates.map((t) => `${t.name} (+${t.winRateBoostPct}%)`).join(', ')
          : 'None recorded'
      }`,
      `Parse this hero's meta data and skill kit into high-elo Pro Tips for PLAYING ${payload.heroName}, covering ability leveling priority, 2-3 recommended skill combos with step sequences, execution tips, teamfight positioning, and power spikes.`,
    ].join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are a Mythical Immortal Mobile Legends: Bang Bang (MLBB) coach teaching a player how to pilot the specified hero effectively. Ground your advice in the provided skill names, cooldowns, ranked win rates, and best teammate synergies. Return concise, practical guidance: a 2-sentence playstyle summary, an explicit ability leveling order label (e.g. "Ult > Skill 1 > Skill 2") with 3 skill priority notes, 2-3 concrete recommended skill combos (with ordered step sequence using slots like "Skill 1", "Skill 2", "Ult", "Basic Attack", "Flicker" and brief skill labels + whenToUse), 3 sharp execution/laning tips, clear teamfight positioning guidance, and a 2-sentence power spike & macro note.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              playstyleSummary: {
                type: Type.STRING,
                description: '2-sentence summary of how to pilot this hero and win condition.',
              },
              skillPriority: {
                type: Type.OBJECT,
                properties: {
                  orderLabel: {
                    type: Type.STRING,
                    description: 'Short ability leveling priority string, e.g., "Ult > Skill 1 > Skill 2".',
                  },
                  skillsToPrioritize: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        slot: { type: Type.STRING },
                        skillName: { type: Type.STRING },
                        reason: { type: Type.STRING },
                      },
                      required: ['slot', 'skillName', 'reason'],
                    },
                    description: 'Priority explanation for Ultimate, Skill 1, and Skill 2.',
                  },
                },
                required: ['orderLabel', 'skillsToPrioritize'],
              },
              recommendedCombos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: {
                      type: Type.STRING,
                      description: 'Short combo name, e.g., "Core All-In Burst" or "Safe Poke Trade".',
                    },
                    sequence: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          slot: {
                            type: Type.STRING,
                            description: 'Slot token like "Skill 1", "Skill 2", "Ult", "Passive", "Basic Attack", or "Battle Spell".',
                          },
                          label: {
                            type: Type.STRING,
                            description: 'Exact skill name or short action label.',
                          },
                        },
                        required: ['slot', 'label'],
                      },
                    },
                    whenToUse: {
                      type: Type.STRING,
                      description: '1 concise sentence explaining the ideal trigger or target window.',
                    },
                  },
                  required: ['title', 'sequence', 'whenToUse'],
                },
                description: '2 to 3 ordered skill combo chains for trading, bursting, or teamfighting.',
              },
              comboAndExecution: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 concise mechanical, combo, or laning execution tips.',
              },
              teamfightPositioning: {
                type: Type.STRING,
                description: '2-sentence guide on teamfight positioning, target selection, and engage timing.',
              },
              powerSpikesAndMacro: {
                type: Type.STRING,
                description: '2-sentence note on level/item power spikes, macro objectives, and synergy with top allies.',
              },
            },
            required: [
              'playstyleSummary',
              'skillPriority',
              'recommendedCombos',
              'comboAndExecution',
              'teamfightPositioning',
              'powerSpikesAndMacro',
            ],
          },
        },
      });

      const raw = (response.text ?? '').trim();
      const proTips = JSON.parse(raw);

      aiProTipsCache.set(cacheKey, {
        expiresAt: Date.now() + AI_CACHE_TTL_MS,
        analysis: proTips,
      });

      res.json({ proTips, cached: false });
    } catch {
      const proTips = buildDeterministicProTips({
        heroName: payload.heroName,
        rankTier: payload.rankTier,
        roles: payload.roles,
        lanes: payload.lanes,
        speciality: payload.speciality,
        winRatePct: payload.winRatePct,
        strongAgainst: payload.strongAgainst,
        bestTeammates: payload.bestTeammates,
        skills: payload.skills,
      });
      res.json({ proTips, cached: false, fallback: true });
    }
  });

  app.all('/api/mlbb/*', async (req: Request, res: Response) => {
    const subPath = '/' + (req.params[0] || '');
    const queryIdx = req.originalUrl.indexOf('?');
    const queryStr = queryIdx >= 0 ? req.originalUrl.slice(queryIdx) : '';
    const targetUrl = `${RONE_API_BASE}${subPath}${queryStr}`;

    if (req.method === 'GET' && isCacheablePublicPath(subPath)) {
      const cached = publicGetCache.get(targetUrl);
      if (cached && cached.expiresAt > Date.now()) {
        res.status(cached.status).json(cached.body);
        return;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const forwardHeaders: Record<string, string> = {
        Accept: 'application/json',
      };
      if (req.headers.authorization) {
        forwardHeaders['Authorization'] = req.headers.authorization;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        forwardHeaders['Content-Type'] = 'application/json';
      }

      const maxAttempts = req.method === 'GET' ? 3 : 1;
      let upstreamRes: globalThis.Response | null = null;
      let rawText = '';

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        upstreamRes = await fetch(targetUrl, {
          method: req.method,
          headers: forwardHeaders,
          body:
            req.method !== 'GET' && req.method !== 'HEAD' && req.body
              ? JSON.stringify(req.body)
              : undefined,
          signal: controller.signal,
        });
        rawText = await upstreamRes.text();
        if (
          upstreamRes.status !== 502 &&
          upstreamRes.status !== 503 &&
          upstreamRes.status !== 504
        ) {
          break;
        }
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 350 * attempt));
        }
      }

      if (!upstreamRes) {
        throw new Error('Upstream response missing');
      }

      const contentType = upstreamRes.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        res.status(upstreamRes.status || 502).json({
          code: upstreamRes.status || 502,
          message: 'Upstream API returned an unexpected response.',
          detail: rawText.slice(0, 200),
        });
        return;
      }

      const parsed = JSON.parse(rawText);

      if (req.method === 'GET' && upstreamRes.ok && isCacheablePublicPath(subPath)) {
        publicGetCache.set(targetUrl, {
          expiresAt: Date.now() + PUBLIC_CACHE_TTL_MS,
          status: upstreamRes.status,
          body: parsed,
        });
      }

      res.status(upstreamRes.status).json(parsed);
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      res.status(isAbort ? 504 : 502).json({
        code: isAbort ? 504 : 502,
        message: isAbort
          ? 'Rone Arena API request timed out. Please try again.'
          : 'Unable to reach Rone Arena API.',
      });
    } finally {
      clearTimeout(timer);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DawnSight server listening on http://localhost:${PORT}`);
  });
}

startServer();
