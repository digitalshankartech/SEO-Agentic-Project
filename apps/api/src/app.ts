import express from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import v1Router from './routes/v1.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '@seo/api' });
});

app.get('/api/providers', (_req, res) => {
  res.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    mistral: Boolean(process.env.MISTRAL_API_KEY),
    cloudflare: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AUTH_TOKEN),
    pagespeed: Boolean(process.env.GOOGLE_PAGESPEED_API_KEY),
    serpapi: Boolean(process.env.SERPAPI_API_KEY),
    openpagerank: Boolean(process.env.OPENPAGERANK_API_KEY),
    searchConsole: Boolean(process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID && process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET),
    bingWebmaster: Boolean(process.env.BING_WEBMASTER_API_KEY),
  });
});

app.post('/api/chat', async (req, res, next) => {
  try {
    const { systemPrompt = '', userMessage = '', provider = 'cloudflare' } = req.body ?? {};
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const text = await runChatProvider(String(provider), String(systemPrompt), String(userMessage));
    const chunks = text.match(/[\s\S]{1,1200}/g) || [''];
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (!res.headersSent) return next(err);
    res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'AI request failed' })}\n\n`);
    res.end();
  }
});

app.get('/api/seo/health', (_req, res) => {
  res.json({
    pagespeed: Boolean(process.env.GOOGLE_PAGESPEED_API_KEY),
    serpapi: Boolean(process.env.SERPAPI_API_KEY),
    openpagerank: Boolean(process.env.OPENPAGERANK_API_KEY),
    searchConsole: Boolean(process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID && process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET),
    bingWebmaster: Boolean(process.env.BING_WEBMASTER_API_KEY),
  });
});

app.get('/api/seo/smoke', async (_req, res, next) => {
  try {
    const checks = await Promise.allSettled([
      smokePageSpeed(),
      smokeOpenPageRank(),
      smokeSerpApi(),
    ]);
    res.json({
      pagespeed: checks[0].status === 'fulfilled' ? checks[0].value : { ok: false, reason: checks[0].reason?.message || 'failed' },
      openpagerank: checks[1].status === 'fulfilled' ? checks[1].value : { ok: false, reason: checks[1].reason?.message || 'failed' },
      serpapi: checks[2].status === 'fulfilled' ? checks[2].value : { ok: false, reason: checks[2].reason?.message || 'failed' },
    });
  } catch (err) {
    next(err);
  }
});

app.use('/v1', v1Router);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_server_error', code: 'INTERNAL_SERVER_ERROR' });
};

app.use(errorHandler);

export default app;

async function runChatProvider(provider: string, systemPrompt: string, userMessage: string) {
  if (provider === 'cloudflare') return runCloudflare(systemPrompt, userMessage);
  if (provider === 'gemini') return runGemini(systemPrompt, userMessage);
  if (provider === 'mistral') return runMistral(systemPrompt, userMessage);
  if (provider === 'anthropic') return runAnthropic(systemPrompt, userMessage);
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AUTH_TOKEN) return runCloudflare(systemPrompt, userMessage);
  throw new Error(`Provider ${provider} is not configured`);
}

async function runCloudflare(systemPrompt: string, userMessage: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AUTH_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL || '@cf/openai/gpt-oss-120b';
  if (!accountId || !token) throw new Error('Cloudflare AI is not configured');

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      max_tokens: Number(process.env.CLOUDFLARE_MAX_TOKENS || 1024),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.errors?.[0]?.message || data?.error || `Cloudflare AI failed with HTTP ${response.status}`);
  }
  return data?.result?.response || data?.result?.content || data?.response || JSON.stringify(data?.result ?? data);
}

async function runGemini(systemPrompt: string, userMessage: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API key is not configured');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini failed with HTTP ${response.status}`);
  return data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
}

async function runMistral(systemPrompt: string, userMessage: string) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error('Mistral API key is not configured');
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error?.message || `Mistral failed with HTTP ${response.status}`);
  return data?.choices?.[0]?.message?.content || '';
}

async function runAnthropic(systemPrompt: string, userMessage: string) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Anthropic API key is not configured');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Anthropic failed with HTTP ${response.status}`);
  return data?.content?.map((part: { text?: string }) => part.text || '').join('') || '';
}

async function smokePageSpeed() {
  const key = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!key) return { ok: false, configured: false };
  const params = new URLSearchParams({ url: 'https://example.com', category: 'PERFORMANCE', key });
  const response = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, configured: true, status: response.status, hasLighthouse: Boolean(data?.lighthouseResult) };
}

async function smokeOpenPageRank() {
  const key = process.env.OPENPAGERANK_API_KEY;
  if (!key) return { ok: false, configured: false };
  const response = await fetch('https://openpagerank.com/api/v1.0/getPageRank?domains[]=example.com', {
    headers: { 'API-OPR': key },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, configured: true, status: response.status, hasResponse: Boolean(data?.response) };
}

async function smokeSerpApi() {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return { ok: false, configured: false };
  const params = new URLSearchParams({ engine: 'google', q: 'example', api_key: key });
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, configured: true, status: response.status, hasOrganicResults: Array.isArray(data?.organic_results) };
}
