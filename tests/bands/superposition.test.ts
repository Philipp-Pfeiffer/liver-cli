import { describe, it } from 'vitest'
import { calculateBAC } from './api-adapter.js'
import { STANDARD_MALE, shotVodka, addMinutes } from './profiles.js'

describe('B5: Superposition — 2 drinks > 1 drink at every t', () => {
	it('B5.1: peak BAC of 2 drinks > peak BAC of 1 drink (sanity)', () => {
		const t0 = new Date('2026-05-01T19:00:00Z')
		const one = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const two = [...one, { ...shotVodka('empty'), startedAt: addMinutes(t0, 30), finishedAt: addMinutes(t0, 31) }]
		let maxOne = 0, maxTwo = 0
		for (let m = 0; m <= 300; m += 5) {
			maxOne = Math.max(maxOne, calculateBAC(one, STANDARD_MALE, addMinutes(t0, m), t0))
			maxTwo = Math.max(maxTwo, calculateBAC(two, STANDARD_MALE, addMinutes(t0, m), t0))
		}
		if (maxTwo <= maxOne * 1.3) {
			throw new Error(`Superposition broken: 2-drink peak ${maxTwo} not >> 1-drink peak ${maxOne}`)
		}
	})
})
