import { describe, it } from 'vitest'
import { generateCurveForTests } from './api-adapter.js'
import { expectRelativeAgreement } from '../lib/bands.js'
import { STANDARD_MALE, shotVodka } from './profiles.js'
import { addMinutes } from './profiles.js'

const REFERENCE = process.env.REFERENCE_ENGINE_URL

describe.skipIf(!REFERENCE)('B8: Curve variability vs reference engine (±15% peak, ±10% elimination)', () => {
	it('B8.1: peak BAC within ±15% of reference', async () => {
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const ours = generateCurveForTests(drinks, STANDARD_MALE, t0, 240)
		const ref = await fetchReferenceCurve(drinks, STANDARD_MALE, t0)
		const peakOurs = Math.max(...ours.points.map(p => p.bacPercent))
		const peakRef = Math.max(...ref.points.map(p => p.bacPercent))
		expectRelativeAgreement(peakOurs, peakRef, 0.15, 'peak BAC vs reference')
	})
})

// Placeholder — would need real implementation with env-based fetch
async function fetchReferenceCurve(
	_drinks: ReturnType<typeof import('./profiles.js').shotVodka>[],
	_profile: typeof STANDARD_MALE,
	_t0: Date,
): Promise<{ points: Array<{ offsetMinutes: number; bacPercent: number }> }> {
	throw new Error('REFERENCE_ENGINE_URL not implemented')
}
