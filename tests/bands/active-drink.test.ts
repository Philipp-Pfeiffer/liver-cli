import { describe, it } from 'vitest'
import { calculateBAC } from './api-adapter.js'
import { STANDARD_MALE, pintBeer, addMinutes } from './profiles.js'

describe('B6: Active drink — BAC must not drop during consumption (Bug Session 6)', () => {
	it('B6.1: Beer over 48min, BAC monotonically rising during drink window', () => {
		const t0 = new Date('2026-05-01T19:17:00Z')
		const drink = { ...pintBeer('empty'), startedAt: t0, finishedAt: addMinutes(t0, 48) }
		// During drink-window (0-48min) BAC must monotonically rise (or at least not drop sharply)
		let prev = -Infinity
		for (let m = 0; m <= 48; m += 4) {
			const bac = calculateBAC([drink], STANDARD_MALE, addMinutes(t0, m), t0)
			if (bac < prev - 0.005) {  // 0.005 = numerical tolerance
				throw new Error(`BAC dropped during active drink at +${m}min: ${prev.toFixed(3)} → ${bac.toFixed(3)} ‰`)
			}
			prev = bac
		}
	})
	it('B6.2: BAC at drink-end > BAC at drink-start (alcohol must accumulate)', () => {
		const t0 = new Date('2026-05-01T19:17:00Z')
		const drink = { ...pintBeer('empty'), startedAt: t0, finishedAt: addMinutes(t0, 48) }
		const bacStart = calculateBAC([drink], STANDARD_MALE, t0, t0)
		const bacEnd = calculateBAC([drink], STANDARD_MALE, addMinutes(t0, 48), t0)
		if (bacEnd <= bacStart) {
			throw new Error(`No accumulation: start=${bacStart.toFixed(3)}, end=${bacEnd.toFixed(3)} ‰`)
		}
	})
})
