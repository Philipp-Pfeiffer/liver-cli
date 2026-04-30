import Database from 'better-sqlite3';
import { readFileSync, readdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const LIVER_DIR = join(homedir(), '.liver');
const CONFIG_PATH = join(LIVER_DIR, 'config');

function migrateConfigFile(db: Database.Database): void {
  if (!existsSync(CONFIG_PATH)) return;
  
  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content) as Record<string, unknown>;
    
    for (const [key, value] of Object.entries(config)) {
      db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(
        key,
        JSON.stringify(value),
      );
    }
    
    // Remove the old config file after successful migration
    unlinkSync(CONFIG_PATH);
  } catch {
    // If the file is corrupt, just remove it
    try {
      unlinkSync(CONFIG_PATH);
    } catch {
      // Ignore errors
    }
  }
}

export function migrate(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  
  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  for (const file of files) {
    const version = parseInt(file.slice(0, 3), 10);
    if (version > currentVersion) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    }
  }
  
  // One-time config file migration
  if (currentVersion < 2) {
    migrateConfigFile(db);
  }
}