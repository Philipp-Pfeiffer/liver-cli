import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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
}