import dotenv from 'dotenv';

dotenv.config();

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3030}`;

export const config = {
  port: Number(process.env.PORT || 3030),
  appUrl: APP_URL,
  chutesBaseUrl: process.env.CHUTES_LTX2_BASE_URL || 'https://chutes-ltx-2.chutes.ai',
  chutesApiKey: process.env.CHUTES_API_KEY || '',
  sessionSecret: process.env.SESSION_SECRET || 'ltx-studio-dev-secret',
  authCookieName: process.env.AUTH_COOKIE_NAME || 'ltx_studio_auth',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'ltx_studio_session',
  chutesIdp: {
    issuer: 'https://api.chutes.ai',
    authorizationEndpoint: 'https://api.chutes.ai/idp/authorize',
    tokenEndpoint: 'https://api.chutes.ai/idp/token',
    userInfoEndpoint: 'https://api.chutes.ai/idp/userinfo',
    revocationEndpoint: 'https://api.chutes.ai/idp/token/revoke',
    idpHost: 'https://idp.chutes.ai',
  },
  oauth: {
    clientId: process.env.CHUTES_IDP_CLIENT_ID || '',
    clientSecret: process.env.CHUTES_IDP_CLIENT_SECRET || '',
    redirectUri:
      process.env.CHUTES_IDP_REDIRECT_URI || `${APP_URL.replace(/\/$/, '')}/auth/callback`,
    scopes: ['openid', 'profile', 'chutes:invoke'],
    disablePkce: process.env.CHUTES_IDP_DISABLE_PKCE === 'true',
  },
};

export function getChuteHost(baseUrl) {
  return new URL(baseUrl).host;
}
