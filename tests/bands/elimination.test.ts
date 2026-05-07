import { describe, it } from 'vitest'
import { calculateBAC } from './api-adapter.js'
import { BANDS, expectInBand } from '../lib/bands.js'
import { STANDARD_MALE, shotVodka, addMinutes } from './profiles.js'

describe('B1: Beta (Elimination Rate) — Jones 2010', () => {
	it('B1.1: beta over 1h plateau is in physiological_range [0.10, 0.35] /h (Jones 2010)', () => {
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		// Plateau-Phase: 90min nach Drink-Start, BAC in stabiler Elimination
		const bacAt90 = calculateBAC(drinks, STANDARD_MALE, addMinutes(t0, 90), t0)
		const bacAt150 = calculateBAC(drinks, STANDARD_MALE, addMinutes(t0, 150), t0)
		const betaPerHour = bacAt90 - bacAt150  // promille / h
		expectInBand(betaPerHour, BANDS.beta.physiological, 'beta@plateau')
	})
	it('B1.2: beta in forensic_moderate range [0.10, 0.20] /h for moderate drinker', () => {
		// Wie B1.1, aber engerer Forensic-Band (Spec-Default-Profil)
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const bac1 = calculateBAC(drinks, STANDARD_MALE, addMinutes(t0, 90), t0)
		const bac2 = calculateBAC(drinks, STANDARD_MALE, addMinutes(t0, 150), t0)
		expectInBand(bac1 - bac2, BANDS.beta.forensic_moderate, 'beta@forensic')
	})
	it('B1.3: beta is monotonically declining (no negative spikes during plateau)', () => {
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		let prev = Infinity
		for (let m = 90; m <= 240; m += 10) {
			const bac = calculateBAC(drinks, STANDARD_MALE, addMinutes(t0, m), t0)
			if (bac > prev + 1e-6) throw new Error(`non-monotonic at +${m}min: ${prev} → ${bac}`)
			prev = bac
		}
	})
})
