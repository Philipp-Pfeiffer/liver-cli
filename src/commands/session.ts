import type Database from 'better-sqlite3';
import { validateSessionName, validateStomachState } from '../errors/validation.js';
import {
  SESSION_ALREADY_ACTIVE,
  SESSION_NOT_ACTIVE,
  TIMESTAMP_OUTSIDE_SESSION,
  ENGINE_PANIC,
} from '../errors/index.js';
import { formatISOUTC, nowUTC, parseTimestamp } from '../time/index.js';

export interface SessionData {
  id: number;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  stomach_initial: string;
}

export interface StomachEvent {
  id: number;
  session_id: number;
  at: string;
  state: string;
}

export function getActiveSession(db: Database.Database): SessionData | null {
  const session = db.prepare(
    'SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
  ).get() as SessionData | undefined;
  
  return session ?? null;
}

export function requireActiveSession(db: Database.Database): SessionData {
  const session = getActiveSession(db);
  if (!session) {
    throw SESSION_NOT_ACTIVE();
  }
  return session;
}

export function startSession(
  db: Database.Database,
  options: {
    name?: string;
    stomach?: string;
    at?: Date;
    force?: boolean;
  },
): { ok: true; session_id: number } {
  validateSessionName(options.name);
  
  let stomachState: string;
  if (options.stomach) {
    stomachState = options.stomach;
  } else {
    // Get last stomach state from most recent ended session
    const lastSession = db.prepare(
      `SELECT stomach_initial FROM sessions WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1`
    ).get() as { stomach_initial: string } | undefined;
    stomachState = lastSession?.stomach_initial ?? 'some';
  }
  validateStomachState(stomachState);
  
  const activeSession = getActiveSession(db);
  if (activeSession && !options.force) {
    throw SESSION_ALREADY_ACTIVE();
  }
  
  const at = options.at ?? nowUTC();
  
  db.transaction(() => {
    if (activeSession && options.force) {
      db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
        formatISOUTC(at),
        activeSession.id,
      );
    }
    
    const result = db.prepare(
      'INSERT INTO sessions (name, started_at, ended_at, stomach_initial) VALUES (?, ?, ?, ?)'
    ).run(
      options.name ?? null,
      formatISOUTC(at),
      null,
      stomachState,
    );
    
    const sessionId = result.lastInsertRowid as number;
    
    db.prepare(
      'INSERT INTO stomach_events (session_id, at, state) VALUES (?, ?, ?)'
    ).run(sessionId, formatISOUTC(at), stomachState);
  })();
  
  const newSession = getActiveSession(db);
  if (!newSession) {
    throw ENGINE_PANIC();
  }
  
  return { ok: true, session_id: newSession.id };
}

export function endSession(
  db: Database.Database,
  options: { at?: Date } = {},
): { ok: true; session_id: number } {
  const session = requireActiveSession(db);
  const at = options.at ?? nowUTC();
  
  db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
    formatISOUTC(at),
    session.id,
  );
  
  return { ok: true, session_id: session.id };
}

export function getSession(db: Database.Database, id: number): SessionData | null {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionData | null;
}

export function renameSession(
  db: Database.Database,
  id: number,
  name: string,
): { ok: true; session_id: number } {
  validateSessionName(name);
  
  const session = getSession(db, id);
  if (!session) {
    throw SESSION_NOT_ACTIVE();
  }
  
  db.prepare('UPDATE sessions SET name = ? WHERE id = ?').run(name, id);
  
  return { ok: true, session_id: id };
}

export function listSessions(
  db: Database.Database,
  options: { year?: string; month?: string } = {},
): { items: SessionData[]; count: number } {
  let sql = 'SELECT * FROM sessions WHERE 1=1';
  const params: unknown[] = [];
  
  if (options.month) {
    sql += ' AND started_at LIKE ?';
    params.push(`${options.month}%`);
  } else if (options.year) {
    sql += ' AND started_at LIKE ?';
    params.push(`${options.year}%`);
  }
  
  sql += ' ORDER BY started_at DESC';
  
  const items = db.prepare(sql).all(...params) as SessionData[];
  return { items, count: items.length };
}

export function setStomachState(
  db: Database.Database,
  state: string,
  options: { at?: Date } = {},
): { ok: true; session_id: number } {
  validateStomachState(state);
  
  const session = requireActiveSession(db);
  const at = options.at ?? nowUTC();
  
  const sessionStart = new Date(session.started_at);
  if (at < sessionStart) {
    throw TIMESTAMP_OUTSIDE_SESSION();
  }
  
  if (session.ended_at) {
    const sessionEnd = new Date(session.ended_at);
    if (at > sessionEnd) {
      throw TIMESTAMP_OUTSIDE_SESSION();
    }
  }
  
  db.prepare(
    'INSERT INTO stomach_events (session_id, at, state) VALUES (?, ?, ?)'
  ).run(session.id, formatISOUTC(at), state);
  
  return { ok: true, session_id: session.id };
}

export function resolveStomachStateAt(
  db: Database.Database,
  sessionId: number,
  at: Date,
): string {
  const event = db.prepare(
    `SELECT state FROM stomach_events
     WHERE session_id = ? AND at <= ?
     ORDER BY at DESC, rowid DESC
     LIMIT 1`
  ).get(sessionId, formatISOUTC(at)) as { state: string } | undefined;
  
  if (event) {
    return event.state;
  }
  
  const session = db.prepare(
    'SELECT stomach_initial FROM sessions WHERE id = ?'
  ).get(sessionId) as { stomach_initial: string } | undefined;
  
  return session?.stomach_initial ?? 'some';
}

