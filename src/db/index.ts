import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { migrate } from './migrate.js';

const LIVER_DIR = process.env.LIVER_DB 
  ? join(process.env.LIVER_DB, '..') 
  : join(homedir(), '.liver');
const DB_PATH = process.env.LIVER_DB ?? join(LIVER_DIR, 'db.sqlite');

export function initDb(): Database.Database {
  mkdirSync(LIVER_DIR, { recursive: true });
  
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 0');
  
  migrate(db);
  
  return db;
}

export { Database };