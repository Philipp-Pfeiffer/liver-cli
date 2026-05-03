# Diagnose-Pass — Pre-Fix-3 (Read-Only)

**Branch:** audit/spec-coverage HEAD (unverändert)  
**Zweck:** Vorarbeit für Fix-Pass 3, während Clifford v0.2 re-verifiziert  
**Modus:** 100% read-only, keine Code-Änderungen

---

## D1 — SESSION_NOT_ACTIVE Reference-Hunt

**Clifford-Befund:** `liver bac` ohne aktive Session crasht mit "SESSION_NOT_ACTIVE is not defined" (Exit 3 UNKNOWN_ERROR) statt sauberem LiverError Exit 2.

**Ergebnis dieser Diagnose:** **Kein systemischer Bug gefunden.** Alle Verwendungen von `SESSION_NOT_ACTIVE` und verwandten Error-Codes sind korrekte Factory-Function-Aufrufe.

### Vollständige Treffer-Liste

| File:Zeile | Code-Snippet | Diagnose | Repro |
|-----------|-------------|----------|-------|
| `src/errors/index.ts:111` | `export const SESSION_NOT_ACTIVE = () => new LiverError(...)` | Definition | N/A |
| `src/index.ts:13` | `import { ..., SESSION_NOT_ACTIVE, ... } from './errors/index.js'` | Import | N/A |
| `src/commands/session.ts:5` | `import { ..., SESSION_NOT_ACTIVE } from '../errors/index.js'` | Import | N/A |
| `src/index.ts:236` | `throw SESSION_NOT_ACTIVE();` | Verwendung (korrekt) | `liver session show` ohne Session |
| `src/commands/session.ts:37` | `throw SESSION_NOT_ACTIVE();` | Verwendung (korrekt) | `requireActiveSession` |
| `src/commands/session.ts:137` | `throw SESSION_NOT_ACTIVE();` | Verwendung (korrekt) | `renameSession` mit ungültiger ID |
| `src/commands/compute.ts:130` | `throw SESSION_NOT_ACTIVE();` | Verwendung (korrekt) | `getBACAt` ohne passende Session |
| `src/commands/compute.ts:164` | `throw SESSION_NOT_ACTIVE();` | Verwendung (korrekt) | `getSober` ohne aktive Session |
| `src/commands/compute.ts:204` | `throw SESSION_NOT_ACTIVE();` | Verwendung (korrekt) | `getCurve` ohne aktive Session |

**Spezial-Check:** Keine `throw SESSION_NOT_ACTIVE` (ohne Klammern), keine `error(SESSION_NOT_ACTIVE)`, keine fehlenden Imports.

**Hypothese für Clifford-Befund:** Der Crash "SESSION_NOT_ACTIVE is not defined" tritt vermutlich auf, wenn ein **nicht-LiverError** (z.B. `TypeError`, `ReferenceError`) den `handleCommand`-Catch erreicht und dort als `UNKNOWN_ERROR` (Exit 3) ausgegeben wird. Das passiert z.B. wenn `getBACAt` aufgerufen wird, aber `requireProfile` zuerst `PROFILE_MISSING` wirft, und dieser Throw-Pfad nicht korrekt abgefangen wird.

**Repro für Clifford-Befund (hypothetisch):**
```bash
# Ohne Profil UND ohne Session
export HOME=$(mktemp -d)
liver bac --at "now"
# Erwartet: PROFILE_MISSING (Exit 1)
# Wenn Exit 3 mit "SESSION_NOT_ACTIVE is not defined": Bug in Error-Pipeline
```

---

## D2 — getCurve drinkAge=0 Bug

**Lokalisiert im Fix-Pass-2.5-Report.** Hier die exakte Analyse.

### Code-Pfade

**getBACAt** (`src/commands/compute.ts:135-140`):
```typescript
const engineDrinks = drinksToEngine(db, drinks, at);
const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);
```

**getCurve** (`src/commands/compute.ts:248-251`):
```typescript
const pointTime = new Date(from.getTime() + offset * 60000);
const engineDrinks = drinksToEngine(db, drinks, pointTime);
const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, -offset);
```

**drinksToEngine** (`src/commands/compute.ts:20-38`):
```typescript
startedAtMinutesAgo: (referenceTime.getTime() - startedAt.getTime()) / 60000,
```

**Engine-Vertrag** (`src/engine/ethanol.ts:52-54`):
```typescript
// Current time is referenceTime + nowOffsetMinutes
// Drinks have startedAtMinutesAgo relative to referenceTime
// So a drink's age at current time = startedAtMinutesAgo + nowOffsetMinutes
```

### Mathematische Analyse

#### getBACAt (korrekt)
- `startedAtMinutesAgo = (at - startedAt) / 60000`
- `drinkAgeMinutes = startedAtMinutesAgo + 0 = (at - startedAt) / 60000`
- **Resultat:** Der Drink ist korrekt `(at - startedAt)` Minuten alt zum Zeitpunkt `at`.

#### getCurve (fehlerhaft)
- `pointTime = from + offset * 60000`
- `startedAtMinutesAgo = (pointTime - startedAt) / 60000 = (from - startedAt) / 60000 + offset`
- `drinkAgeMinutes = startedAtMinutesAgo + (-offset) = (from - startedAt) / 60000 + offset - offset`
- **Resultat:** `drinkAgeMinutes = (from - startedAt) / 60000` (konstant für alle Punkte!)

**Warum getCurve drinkAge=0 ergibt:**
Wenn `from = session.started_at` (Standard) und ein Drink zum Session-Start begann (`startedAt = from`):
- `drinkAgeMinutes = (from - from) / 60000 = 0`
- Der Drink wird auf der gesamten Kurve als 0 Minuten alt berechnet — er absorbiert nie, die Kurve ist eine horizontale Linie.

### Fix-Hypothese

**Der `-offset` in `calculateBACAtOffset` (Zeile 251) ist falsch.**

**Konsistente Variante mit getBACAt** (minimaler Fix, 1 Zeile):
```typescript
// compute.ts:251
const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);
```

**Warum das korrekt ist:**
- `drinksToEngine(db, drinks, pointTime)` berechnet `startedAtMinutesAgo` relativ zum tatsächlichen Kurvenpunkt `pointTime`
- `calculateBACAtOffset(..., 0)` addiert keinen zusätzlichen Offset
- `drinkAgeMinutes = (pointTime - startedAt) / 60000` — korrekt für jeden Punkt

**Alternative** (effizienter, da `drinksToEngine` nur einmal außerhalb der Schleife):
```typescript
// Außerhalb der Schleife (vor Zeile 247):
const engineDrinks = drinksToEngine(db, drinks, from);
// In der Schleife (Zeile 251):
const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, offset);
```
Hier ist `startedAtMinutesAgo` relativ zu `from`, und `+offset` verschiebt die Zeit korrekt zu `pointTime`.

**Empfohlener Fix für Fix-Pass 3:** Variante 1 (`-offset` → `0` in Zeile 251), da sie konsistent mit `getBACAt` ist und nur eine Zeile ändert.

---

## D3 — Pharmakologie-Konstanten-Audit (β-Drift)

### Konstanten-Tabelle

| Konstante | File:Zeile | Code-Wert | Spec-Erwartung | Unit | Diskrepanz? |
|-----------|------------|-----------|----------------|------|-------------|
| β (ELIMINATION_RATE) | `ethanol.ts:31` | 0.015 | 0.015 | ‰/h | **NEIN** ✓ |
| Watson r male | `ethanol.ts:11` | 0.68 | 0.68 | — | **NEIN** ✓ |
| Watson r female | `ethanol.ts:12` | 0.55 | 0.55 | — | **NEIN** ✓ |
| Watson r other | `ethanol.ts:13` | 0.615 | 0.615 | — | **NEIN** ✓ |
| Widmark r male | `ethanol.ts:18` | 0.73 | 0.73 | — | **NEIN** ✓ |
| Widmark r female | `ethanol.ts:19` | 0.66 | 0.66 | — | **NEIN** ✓ |
| Widmark r other | `ethanol.ts:20` | 0.695 | 0.695 | — | **NEIN** ✓ |
| ka empty | — | — | 4.0 | h⁻¹ | **NICHT IMPLEMENTIERT** ❌ |
| ka some | — | — | 2.5 | h⁻¹ | **NICHT IMPLEMENTIERT** ❌ |
| ka full | — | — | 1.5 | h⁻¹ | **NICHT IMPLEMENTIERT** ❌ |
| STOMACH_ABSORPTION empty | `ethanol.ts:25` | 1.0 | — | Fraktion | Extra |
| STOMACH_ABSORPTION some | `ethanol.ts:26` | 0.85 | — | Fraktion | Extra |
| STOMACH_ABSORPTION full | `ethanol.ts:27` | 0.65 | — | Fraktion | Extra |

### β-Spezial-Check

```typescript
// ethanol.ts:88-92
const firstDrinkAge = Math.max(0, ...drinks.map(d => d.startedAtMinutesAgo + nowOffsetMinutes));
const elapsedHours = firstDrinkAge / 60;   // Minuten → Stunden ✓
const eliminated = elapsedHours * ELIMINATION_RATE;
```

- **Delta-Unit:** `firstDrinkAge` ist in **Minuten**
- **Konvertierung:** `/ 60` zu **Stunden** — korrekt
- **Multiplikation:** `0.015 * elapsedHours` — korrekt
- **Faktor-60-Bug:** **NEIN** ✓

### ka-Implementierungslücke

Die Spec erwartet **ka-Werte** (Absorptionsraten in h⁻¹: 4.0 / 2.5 / 1.5), aber der Code verwendet **lineare Absorptions-FRAKTIONEN** (1.0 / 0.85 / 0.65) ohne Zeitkonstante.

**Unterschied:**
- **Spec-Modell:** Exponentielle Absorption mit Rate ka. Bei ka=4.0 h⁻¹ dauert die Absorption ~15 Minuten (5× Zeitkonstante).
- **Code-Modell:** Lineare Absorption über `durationMinutes`. Bei duration=0 ist der Drink sofort zu 100% absorbiert (empty: 1.0, some: 0.85, full: 0.65).

**Impact:**
- Der Peak bei `duration=0` ist sofort bei T0 (N7 beobachtet).
- Bei `duration=30m` steigt der BAC linear über 30 Minuten.
- Es gibt keinen pharmakokinetischen ka-Parameter im Code.

**Empfehlung für Fix-Pass 3:** Nicht adressieren (außerhalb des Scopes von v0.2). Die Engine-Implementierung ist konsistent mit sich selbst, aber nicht mit der Spec. Ein Engine-Refactor (exponentielle Absorption) wäre ein separater Task.

### Aktiver Engine-Pfad

- **Kein `wasm.ts` oder `stub.ts`** vorhanden.
- **Aktiv:** `src/engine/ethanol.ts` (via `src/engine/index.ts`)

---

## D4 — Spec-Drift-Selbst-Audit

### Identifizierte Drifts

| Änderung | Angefordert? | Test-Abhängigkeiten | Empfohlene Aktion |
|----------|-------------|---------------------|-------------------|
| `src/db/index.ts`: busy_timeout=0 | ✅ Ja (Spec §12.2) | H4-Integration indirekt | Keine — Spec-konform |
| `src/commands/auto-close.ts`: 24h-Threshold | ✅ Ja | `tests/integration/auto-close.test.ts` (kein Coverage für >24h) | Test für >24h-Fall ergänzen |
| `src/commands/session.ts`: Auto-Close bei >1s Delta | ✅ Ja | `tests/unit/session.test.ts` (kein Coverage für Auto-Close-Pfad) | Test für implizites Auto-Close ergänzen |
| `src/commands/drink.ts`: `--session new` erzwingt neue Session | ✅ Ja | `tests/unit/drink.test.ts` (kein Coverage für `sessionNew`) | Test für `sessionNew` ergänzen |
| `src/commands/auto-close.ts`: Kommentar umgeschrieben | ⚠️ Nein (kosmetisch) | Keine | Akzeptieren |
| `src/commands/session.ts`: `const at` nach oben verschoben | ⚠️ Implizit (notwendig) | `tests/unit/session.test.ts` | Keine — Implementierungsdetail |
| `docs/FIX_PASS_2.5_REPORT.md` neu hinzugefügt | ❌ Nein | Keine | Akzeptieren (Audit-Artefakt) |

**Ergebnis:** **0 Rollbacks nötig.** Keine rogue-Änderungen. 3 Test-Lücken für explizit angeforderte Features.

### Vollständiger Diff

```diff
# src/commands/auto-close.ts
-  // SKIP auto-close if reference time is far in the future/past relative to
-  // the session. This prevents auto-close from killing historical/future
-  // test sessions when the system clock differs from the session time.
+  // SKIP auto-close if the last drink is very old (>24h).
+  // Prevents performAutoClose from killing historical test sessions
+  // when the system clock differs from the session time.
   const hoursSinceLastDrink = (ref.getTime() - lastFinishedAt.getTime()) / (1000 * 60 * 60);
   if (hoursSinceLastDrink > 24) {
     return null;
```

```diff
# src/commands/session.ts
   const activeSession = getActiveSession(db);
-  if (activeSession && !options.force) {
+  const at = options.at ?? nowUTC();
+  
+  // Auto-close past active sessions when starting a new one without --force
+  // (only if the new start time is measurably after the existing session start)
+  const shouldAutoClose = activeSession && !options.force &&
+    at.getTime() > new Date(activeSession.started_at).getTime() + 1000;
+  
+  if (activeSession && !options.force && !shouldAutoClose) {
     throw SESSION_ALREADY_ACTIVE();
   }
   
-  const at = options.at ?? nowUTC();
-  
   db.transaction(() => {
-    if (activeSession && options.force) {
+    if (activeSession && (options.force || shouldAutoClose)) {
       db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(
         formatISOUTC(at),
         activeSession.id,
```

---

## D5 — bc-False-Positive-Aufklärung

### a) Fix-Pass 2: bc-basiert / synthetisch evaluierte Tests

| Test-ID | Begründung |
|---------|-----------|
| **N2** Watson vs Widmark | `bc` zur Diff-Berechnung: `diff=$(echo "scale=3; ($WATSON - $WIDMARK) / $WATSON * 100" \| bc)` — `bc` nicht installiert → `diff=0%` |
| **N3** Beta-Elimination | Monotonie-Check via `bc -l`: `if (( $(echo "$T0 > $T1 && $T1 >= $T2" \| bc -l) )); then` — `bc` nicht installiert → Check failte |
| **N4** ka-Resorption | Range-Check via `bc -l`: `if (( $(echo "$N4_empty > $N4_some && $N4_some > $N4_full" \| bc -l) )); then` — `bc` nicht installiert → Check failte |
| **N5** ABV-Peak | Range-Check via `bc -l`: `if (( $(echo "$N5_PEAK >= 0.30 && $N5_PEAK <= 0.50" \| bc -l) )); then` — `bc` nicht installiert → Check failte |
| **N6** Pure-Alcohol | Range-Check via `bc -l`: `if (( $(echo "$N6_GRAMS >= 46.0 && $N6_GRAMS <= 46.7" \| bc -l) )); then` — `bc` nicht installiert → Check failte |

### b) Fix-Pass 2.5: Mit echten CLI-Calls re-verifiziert

| Test-ID | Setup-Command | Ergebnis |
|---------|--------------|----------|
| **N2** | `liver bac --formula watson` → 0.23, `liver bac --formula widmark` → 0.21 | diff=9% ✅ |
| **N3** | `liver bac --at T0`, `liver bac --at T1`, `liver bac --at T2` | T0=0.01 T1=0 T2=0 ✅ |
| **N4** | `liver session stomach empty/some/full` + `liver bac` | empty=0.36 > some=0.31 > full=0.24 ✅ |
| **N5** | `liver add` + `liver curve` | peak=0.36 ∈ [0.30,0.50] ✅ |
| **N6** | `liver add` + `liver stats` | grams=46.35 ∈ [46.0,46.7] ✅ |

### c) Fix-Pass 2.5: Weiter synthetisch evaluiert

| Test-ID | Begründung |
|---------|-----------|
| **N7** Peak-Timing | Als "bekanntes Verhalten" dokumentiert (Peak bei T0). Nicht mit echten zeitversetzten Calls verifiziert, sondern durch Code-Analyse. |
| **H8/H9** Future-Sessions | Als "Test-Design-Limitation" dokumentiert. Nicht mit echten CLI-Calls reparierbar (hängen vom Ausführungsdatum ab). |

**Kern-Erkenntnis:** Fix-Pass 2 hat N2-N6 mit `bc` evaluiert, was aufgrund fehlenden `bc` zu False-Positives führte. Fix-Pass 2.5 hat alle fünf Tests durch echte CLI-Aufrufe re-verifiziert.

---

## Zusammenfassung für Fix-Pass 3

### Konkrete Fix-Empfehlungen (nur D2)

1. **getCurve drinkAge=0** (`src/commands/compute.ts:251`):
   ```typescript
   // Alt:
   const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, -offset);
   // Neu:
   const bacPercent = calculateBACAtOffset(engineProfile, engineDrinks, formula, 0);
   ```

### Zu prüfende Clifford-Befunde

1. **"SESSION_NOT_ACTIVE is not defined"** — Repro: `liver bac --at "now"` ohne Profil und ohne Session. Wenn Exit 3 mit dieser Message: Bug liegt im Catch-Handler (nicht im Error-Definition).

### Nicht adressieren (Scope)

1. **ka-Werte nicht implementiert** — Engine verwendet lineare Fraktionen statt exponentieller Absorption. Erfordert Engine-Refactor.
2. **N7 Peak bei T0** — Wird durch D2-Fix behoben (Curve zeigt dann korrekte zeitliche Entwicklung).

---

*Diagnose-Pass abgeschlossen. Keine Code-Änderungen vorgenommen. Branch unverändert.*
