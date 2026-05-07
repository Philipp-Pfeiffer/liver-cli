import { describe, it } from 'vitest'
import { calculateBAC, minutesUntilSober } from './api-adapter.js'
import { expectRelativeAgreement } from '../lib/bands.js'
import { STANDARD_MALE, shotVodka, addMinutes } from './profiles.js'

describe('B4: Sober-Time — derived from beta + peak BAC', () => {
	it('B4.1: predicted sober time matches BAC<0.1 crossing within ±20%', () => {
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const predicted = minutesUntilSober(drinks, STANDARD_MALE, t0)
		// Discover actual crossing by sampling minute-by-minute
		let observed = 0
		for (let m = 0; m <= 600; m++) {
			if (calculateBAC(drinks, STANDARD_MALE, addMinutes(t0, m), t0) < 0.1) {
				observed = m
				break
			}
		}
		expectRelativeAgreement(observed, predicted, 0.20, 'sober-time')
	})
})
