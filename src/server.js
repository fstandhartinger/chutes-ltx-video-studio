import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

import { config as baseConfig, getChuteHost } from './server/env.js';
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  getUserInfo,
  refreshAccessToken,
} from './server/auth.js';
import { createSession, deleteSession, getSession, updateSession } from './server/session.js';
import { listLoras } from './core/loras.js';
import { buildGenerationPayload, ValidationError } from './core/request.js';
import { invokeLtx2, RemoteError } from './core/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');

function mergeConfig(overrides) {
  if (!overrides) return baseConfig;
  return {
    ...baseConfig,
    ...overrides,
    chutesIdp: { ...baseConfig.chutesIdp, ...(overrides.chutesIdp || {}) },
    oauth: { ...baseConfig.oauth, ...(overrides.oauth || {}) },
  };
}

function isScopeGranted(scopeString, scope) {
  if (!scopeString) return false;
  return scopeString.split(/\s+/).includes(scope);
}

function tokensNeedRefresh(tokens) {
  if (!tokens?.expiresAt) return false;
  return tokens.expiresAt - Date.now() < 5 * 60 * 1000;
}

function sanitizeReturnTo(value, appUrl) {
  if (!value) return '/';
  try {
    const url = new URL(value, appUrl);
    if (url.origin !== new URL(appUrl).origin) {
      return '/';
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (error) {
    return '/';
  }
}

export function createApp(overrides) {
  const config = mergeConfig(overrides);
  const chuteHost = getChuteHost(config.chutesBaseUrl);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20mb' }));
  app.use(cookieParser(config.sessionSecret));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/loras', (_req, res) => {
    res.json({
      loras: listLoras(),
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const sessionId = req.signedCookies[config.sessionCookieName];
    const session = getSession(sessionId);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user: session.user,
      scope: session.tokens?.scope || '',
      hasInvokeScope: isScopeGranted(session.tokens?.scope, 'chutes:invoke'),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.signedCookies[config.sessionCookieName];
    if (sessionId) {
      deleteSession(sessionId);
    }
    res.clearCookie(config.sessionCookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.status(204).send();
  });

  app.get('/auth/login', (req, res) => {
    if (!config.oauth.clientId) {
      res.status(500).send('Missing CHUTES_IDP_CLIENT_ID');
      return;
    }

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const returnToRaw = Array.isArray(req.query.returnTo) ? req.query.returnTo[0] : req.query.returnTo;
    const returnTo = sanitizeReturnTo(returnToRaw, config.appUrl);

    const authCookie = JSON.stringify({ state, codeVerifier, returnTo });
    res.cookie(config.authCookieName, authCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: true,
      maxAge: 10 * 60 * 1000,
    });

    const authUrl = buildAuthorizationUrl({
      state,
      codeChallenge,
    });

    res.redirect(authUrl);
  });

  app.get('/auth/callback', async (req, res) => {
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    const state = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
    const authPayload = req.signedCookies[config.authCookieName];

    if (!authPayload) {
      res.status(400).send('Missing auth state.');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(authPayload);
    } catch (error) {
      res.status(400).send('Invalid auth state.');
      return;
    }

    if (!code || !state || parsed.state !== state) {
      res.status(400).send('Invalid OAuth callback state.');
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens({
        code,
        codeVerifier: parsed.codeVerifier,
      });
      const user = await getUserInfo(tokens.accessToken);

      const sessionId = createSession({
        user,
        tokens,
      });

      res.cookie(config.sessionCookieName, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        signed: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.clearCookie(config.authCookieName);

      const returnTo = sanitizeReturnTo(parsed.returnTo, config.appUrl);
      res.redirect(returnTo);
    } catch (error) {
      res.status(500).send(`OAuth callback failed: ${error.message}`);
    }
  });

  app.post('/api/generate', async (req, res) => {
    let payload;
    try {
      payload = buildGenerationPayload(req.body);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: 'validation_error', details: error.errors });
        return;
      }
      res.status(400).json({ error: 'invalid_request', details: error.message });
      return;
    }

    const sessionId = req.signedCookies[config.sessionCookieName];
    const session = getSession(sessionId);

    let accessToken = null;
    if (session && isScopeGranted(session.tokens?.scope, 'chutes:invoke')) {
      accessToken = session.tokens.accessToken;
      if (tokensNeedRefresh(session.tokens)) {
        try {
          const refreshed = await refreshAccessToken(session.tokens.refreshToken);
          updateSession(sessionId, { tokens: { ...session.tokens, ...refreshed } });
          accessToken = refreshed.accessToken;
        } catch (error) {
          accessToken = null;
        }
      }
    }

    try {
      const requestId = crypto.randomUUID();
      const result = await invokeLtx2({
        payload,
        baseUrl: config.chutesBaseUrl,
        apiKey: config.chutesApiKey,
        accessToken,
        idpHost: config.chutesIdp.idpHost,
        chuteHost,
        timeoutMs: 10 * 60 * 1000,
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('X-Request-ID', requestId);
      res.status(200).send(result.buffer);
    } catch (error) {
      if (error instanceof RemoteError) {
        res.status(error.status || 502).json({
          error: 'chutes_error',
          detail: error.detail,
        });
        return;
      }
      res.status(500).json({ error: 'server_error', detail: error.message });
    }
  });

  app.use(express.static(PUBLIC_DIR));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  return app;
}

export function startServer() {
  const app = createApp();
  app.listen(baseConfig.port, () => {
    console.log(`LTX-2 Video Studio running on ${baseConfig.appUrl}`);
  });
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  startServer();
}
