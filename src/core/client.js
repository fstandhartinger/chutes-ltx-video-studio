import { setTimeout as delay } from 'node:timers/promises';

export class RemoteError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'RemoteError';
    this.status = status;
    this.detail = detail;
  }
}

export async function invokeLtx2({
  payload,
  baseUrl,
  apiKey,
  accessToken,
  idpHost,
  chuteHost,
  timeoutMs = 10 * 60 * 1000,
}) {
  // Always use the API key for chute invocation.
  // OAuth tokens are used for user authentication, but chute calls go through the API key.
  if (!apiKey) {
    throw new Error('Missing CHUTES_API_KEY.');
  }

  const endpoint = '/generate';
  const targetUrl = `${baseUrl.replace(/\/$/, '')}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-Identifier': 'chutes-ltx-video-studio',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = null;
      try {
        const text = await response.text();
        detail = text;
      } catch (err) {
        detail = String(err);
      }
      throw new RemoteError(
        `Chutes request failed with status ${response.status}.`,
        response.status,
        detail
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      contentType: response.headers.get('content-type') || 'video/mp4',
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Chutes request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function retryInvoke({
  attempts = 2,
  backoffMs = 1200,
  ...params
}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await invokeLtx2(params);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(backoffMs * attempt);
      }
    }
  }
  throw lastError;
}
