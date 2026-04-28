import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import {
  startSession,
  endSession,
  getActiveSession,
  requireActiveSession,
  setStomachState,
  resolveStomachStateAt,
  listSessions,
} from '../../src/commands/session.js';

describe('session commands', () => {
  let db: Database.Database;
  
  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });
  
  it('should start a session', () => {
    const result = startSession(db, { name: 'Test', stomach: 'full' });
    expect(result.session_id).toBeGreaterThan(0);
    
    const session = getActiveSession(db);
    expect(session).not.toBeNull();
    expect(session?.name).toBe('Test');
    expect(session?.stomach_initial).toBe('full');
  });
  
  it('should create initial stomach event', () => {
    startSession(db, { stomach: 'full' });
    const session = getActiveSession(db);
    
    const events = db.prepare('SELECT * FROM stomach_events WHERE session_id = ?').all(session!.id);
    expect(events.length).toBe(1);
    expect((events[0] as { state: string }).state).toBe('full');
  });
  
  it('should reject duplicate active session', () => {
    startSession(db, {});
    expect(() => startSession(db, {})).toThrow();
  });
  
  it('should allow force override', () => {
    startSession(db, {});
    const result = startSession(db, { force: true });
    expect(result.session_id).toBeGreaterThan(0);
  });
  
  it('should end session', () => {
    startSession(db, {});
    const result = endSession(db);
    expect(result.ok).toBe(true);
    expect(getActiveSession(db)).toBeNull();
  });
  
  it('should reject end without active session', () => {
    expect(() => endSession(db)).toThrow();
  });
  
  it('should set stomach state', () => {
    startSession(db, { stomach: 'full' });
    const result = setStomachState(db, 'some');
    expect(result.ok).toBe(true);
    
    const events = db.prepare('SELECT * FROM stomach_events').all();
    expect(events.length).toBe(2);
  });
  
  it('should resolve stomach state at time', () => {
    const now = new Date();
    startSession(db, { stomach: 'full', at: now });
    const session = getActiveSession(db);
    
    const state = resolveStomachStateAt(db, session!.id, now);
    expect(state).toBe('full');
  });
  
  it('should resolve historical stomach state', () => {
    const now = new Date();
    startSession(db, { stomach: 'full', at: now });
    const session = getActiveSession(db);
    
    const future = new Date(now.getTime() + 3600000);
    setStomachState(db, 'some', { at: future });
    
    const past = new Date(now.getTime() + 1800000);
    const state = resolveStomachStateAt(db, session!.id, past);
    expect(state).toBe('full');
    
    const later = new Date(now.getTime() + 7200000);
    const stateLater = resolveStomachStateAt(db, session!.id, later);
    expect(stateLater).toBe('some');
  });
  
  it('should reject stomach state outside session', () => {
    const now = new Date();
    startSession(db, { at: now });
    
    const past = new Date(now.getTime() - 3600000);
    expect(() => setStomachState(db, 'empty', { at: past })).toThrow();
  });
  
  it('should list sessions', () => {
    startSession(db, { name: 'Session 1' });
    endSession(db);
    startSession(db, { name: 'Session 2' });
    
    const list = listSessions(db);
    expect(list.count).toBe(2);
  });
});