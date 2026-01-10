import crypto from 'node:crypto';
import { config } from './env.js';

export function generateState() {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function buildAuthorizationUrl({ state, codeChallenge }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.oauth.clientId,
    redirect_uri: config.oauth.redirectUri,
    scope: config.oauth.scopes.join(' '),
    state,
  });

  if (!config.oauth.disablePkce && codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  return `${config.chutesIdp.authorizationEndpoint}?${params.toString()}`;
}

export async function exchangeCodeForTokens({ code, codeVerifier }) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.oauth.redirectUri,
    client_id: config.oauth.clientId,
  });

  if (!config.oauth.disablePkce && codeVerifier) {
    params.set('code_verifier', codeVerifier);
  }

  if (config.oauth.clientSecret) {
    params.set('client_secret', config.oauth.clientSecret);
  }

  const response = await fetch(config.chutesIdp.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${detail}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    tokenType: data.token_type || 'Bearer',
    scope: data.scope || config.oauth.scopes.join(' '),
  };
}

export async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.oauth.clientId,
  });

  if (config.oauth.clientSecret) {
    params.set('client_secret', config.oauth.clientSecret);
  }

  const response = await fetch(config.chutesIdp.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${detail}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in * 1000),
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
  };
}

export async function getUserInfo(accessToken) {
  const response = await fetch(config.chutesIdp.userInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to fetch user info: ${response.status} ${detail}`);
  }

  return response.json();
}

export async function revokeToken(token) {
  const params = new URLSearchParams({
    token,
    client_id: config.oauth.clientId,
  });

  if (config.oauth.clientSecret) {
    params.set('client_secret', config.oauth.clientSecret);
  }

  await fetch(config.chutesIdp.revocationEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
}
