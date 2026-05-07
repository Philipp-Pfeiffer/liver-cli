import { describe, it } from 'vitest'
import { calculateBAC, generateCurveForTests } from './api-adapter.js'
import { STANDARD_MALE, shotVodka, addMinutes } from './profiles.js'

describe('B7: v0.1.x bug anti-regression', () => {
	it('B7.1: BUG-1 (factor-10 beta) — BAC after 1h plateau still >50% of peak', () => {
		// Wenn beta = 1.5 ‰/h (Faktor-10-Bug), wäre BAC nach 1h fast bei 0.
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = Array.from({ length: 4 }, (_, i) => ({
			...shotVodka('empty'),
			startedAt: addMinutes(t0, i * 5),
			finishedAt: addMinutes(t0, i * 5 + 1),
		}))
		const curve = generateCurveForTests(drinks, STANDARD_MALE, t0, 180)
		const peak = Math.max(...curve.points.map(p => p.bacPercent))
		const at60 = curve.points.find(p => p.offsetMinutes === 60)!.bacPercent
		if (at60 < peak * 0.5) {
			throw new Error(`Beta too high (factor-10 regression?): peak=${peak}, +60min=${at60}`)
		}
	})
	it('B7.2: BUG-2 (stomach-cap absorption loss) — total absorbed ≈ 100% of dose, not 65/85%', () => {
		// Massenbilanz: ∫ BAC dt × beta + final eliminated ≈ A / (W × r)
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = [{ ...shotVodka('some'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const curve = generateCurveForTests(drinks, STANDARD_MALE, t0, 600)
		const peak = Math.max(...curve.points.map(p => p.bacPercent))
		// Theoretical peak (no cap): A=40·0.40·0.789·1000=12624mg = 12.624g; r·W=0.7·80=56kg → peak≈ 0.225 ‰ (post-absorption equiv)
		// With 0.65 cap (Bug 2), peak would be ≈ 0.146 ‰ — explicit floor:
		if (peak < 0.17) {
			throw new Error(`Stomach-cap regression: peak=${peak} suggests 65% cap still active`)
		}
	})
	it('B7.3: BUG-3 (linear absorption) — absorption curve is concave, not linear', () => {
		// First-order kinetics: BAC(t) curvature negative early. Linear model would give zero curvature.
		// Use instant drink (1min) so absorption starts immediately and we can test concavity
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const b10 = calculateBAC(drinks, STANDARD_MALE, addMinutes(t0, 10), t0)
		const b20 = calculateBAC(drinks, STANDARD_MALE, addMinutes(t0, 20), t0)
		const b30 = calculateBAC(drinks, STANDARD_MALE, addMinutes(t0, 30), t0)
		// Concave: (b10 + b30) / 2 < b20 (mit etwas Toleranz)
		if ((b10 + b30) / 2 >= b20 - 1e-4) {
			throw new Error(`Absorption appears linear (Bug 3 regression): b10=${b10}, b20=${b20}, b30=${b30}`)
		}
	})
})
