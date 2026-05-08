import type Database from 'better-sqlite3';
import { getActiveSession } from './session.js';
import { requireProfile } from './profile.js';
import { profileToEngine, drinksToEngine } from './compute.js';
import { getMinutesUntilSober } from '../engine/index.js';
import { formatISOUTC } from '../time/index.js';
import type { BACFormula } from '../engine/types.js';
import type { DrinkData } from './drink.js';

export function performAutoClose(db: Database.Database, referenceTime?: Date): number | null {
  const session = getActiveSession(db);
  if (!session) return null;

  const profile = requireProfile(db, 'auto-close');

  // If there is an open (unfinished) drink, never auto-close the session
  const openDrink = db.prepare(
    'SELECT 1 FROM drinks WHERE session_id = ? AND finished_at IS NULL LIMIT 1'
  ).get(session.id);
  if (openDrink) return null;

  const lastDrink = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1'
  ).get(session.id) as { finished_at: string; started_at: string } | undefined;

  if (!lastDrink) return null;

  const ref = referenceTime ?? new Date();
  const lastFinishedAt = new Date(lastDrink.finished_at);
  const lastStartedAt = new Date(lastDrink.started_at);

  // SKIP auto-close if reference time is before last drink finished
  // (e.g., querying a future point within an active session)
  if (ref < lastFinishedAt) {
    return null;
  }

  // Auto-close window: only close sessions with last drink in the past 24h.
  // See Spec v1.0.8 §X.
  // Prevents performAutoClose from killing historical test sessions
  // when the system clock differs from the session time.
  const hoursSinceLastDrink = (ref.getTime() - lastFinishedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastDrink > 24) {
    return null;
  }

  // Grace period: auto-close only after grace has passed.
  // Grace starts at max(finished_at, started_at + AUTO_CLOSE_GRACE).
  // This prevents immediate auto-close for instant drinks (no --duration).
  const autoCloseGraceMin = 15;
  const graceStart = new Date(Math.max(
    lastFinishedAt.getTime(),
    lastStartedAt.getTime() + autoCloseGraceMin * 60000,
  ));

  if (ref < graceStart) {
    return null;
  }

  const formula = (profile.preferred_formula ?? 'watson') as BACFormula;
  const engineProfile = profileToEngine(profile);

  const drinks = db.prepare(
    'SELECT * FROM drinks WHERE session_id = ? ORDER BY started_at'
  ).all(session.id) as DrinkData[];

  const engineDrinks = drinksToEngine(db, drinks, ref);

  const minutesUntil = getMinutesUntilSober(engineProfile, engineDrinks, formula);
  const soberAt = new Date(ref.getTime() + minutesUntil * 60000);

  if (ref >= soberAt) {
    db.transaction(() => {
      db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
        formatISOUTC(soberAt),
        session.id,
      );
    })();
    return session.id;
  }

  return null;
}