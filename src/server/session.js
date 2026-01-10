import crypto from 'node:crypto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();

export function createSession(session) {
  const id = crypto.randomUUID();
  const now = Date.now();
  sessions.set(id, {
    ...session,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return id;
}

export function getSession(id) {
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt && session.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export function updateSession(id, updates) {
  const session = sessions.get(id);
  if (!session) return null;
  const updated = {
    ...session,
    ...updates,
    updatedAt: Date.now(),
  };
  sessions.set(id, updated);
  return updated;
}

export function deleteSession(id) {
  sessions.delete(id);
}

export function setSession(id, session) {
  sessions.set(id, session);
}

export function listSessions() {
  return [...sessions.entries()];
}
