import type Database from 'better-sqlite3';
import { getActiveSession } from './session.js';
import { requireProfile } from './profile.js';
import { profileToEngine, drinksToEngine } from './compute.js';
import { getMinutesUntilSober } from '../engine/index.js';
import { formatISOUTC } from '../time/index.js';
import type { BACFormula } from '../engine/types.js';
import type { DrinkData } from './drink.js';

export function performAutoClose(db: Database.Database): number | null {
  const session = getActiveSession(db);
  if (!session) return null;

  const profile = requireProfile(db, 'auto-close');

  const lastDrink = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY finished_at DESC LIMIT 1'
  ).get(session.id) as { finished_at: string | null } | undefined;

  if (!lastDrink || !lastDrink.finished_at) return null;

  const formula = (profile.preferred_formula ?? 'watson') as BACFormula;
  const engineProfile = profileToEngine(profile);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const now = new Date();
  const engineDrinks = drinksToEngine(db, drinks, now);

  const minutesUntil = getMinutesUntilSober(engineProfile, engineDrinks, formula);
  const lastFinishedAt = new Date(lastDrink.finished_at);
  const soberAt = new Date(lastFinishedAt.getTime() + minutesUntil * 60000);

  if (now >= soberAt) {
    db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
      formatISOUTC(soberAt),
      session.id,
    );
    return session.id;
  }

  return null;
}