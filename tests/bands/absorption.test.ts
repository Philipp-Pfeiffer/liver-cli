import { describe, it } from 'vitest'
import { calculateBAC, generateCurveForTests } from './api-adapter.js'
import { BANDS, expectInBand } from '../lib/bands.js'
import { STANDARD_MALE, shotVodka, pintBeer, addMinutes } from './profiles.js'
import type { CurveResult } from '../../src/engine/types.js'

function findPeakMinute(curve: CurveResult): number {
	return curve.points.reduce((peak, p) => (p.bacPercent > peak.bacPercent ? p : peak)).offsetMinutes
}

describe('B3: Peak Timing — Mitchell 2014, Wilkinson 1977, Norberg 2003', () => {
	it('B3.1: Bolus vodka empty stomach — peak in [15, 45] min (Mitchell 2014)', () => {
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const curve = generateCurveForTests(drinks, STANDARD_MALE, t0, 240)
		expectInBand(findPeakMinute(curve), BANDS.peak_min_bolus_empty, 'peak vodka empty')
	})
	it('B3.2: Bolus vodka full stomach — peak in [30, 90] min (Wilkinson 1977)', () => {
		const t0 = new Date('2026-05-01T19:00:00Z')
		const drinks = [{ ...shotVodka('full'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const curve = generateCurveForTests(drinks, STANDARD_MALE, t0, 240)
		expectInBand(findPeakMinute(curve), BANDS.peak_min_bolus_full, 'peak vodka full')
	})
	it('B3.3: Beer-vs-vodka peak ordering — beer peaks LATER than vodka, both empty (Mitchell 2014)', () => {
		const t0 = new Date('2026-05-01T19:00:00Z')
		const dVodka = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const dBeer = [{ ...pintBeer('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const peakV = findPeakMinute(generateCurveForTests(dVodka, STANDARD_MALE, t0, 240))
		const peakB = findPeakMinute(generateCurveForTests(dBeer, STANDARD_MALE, t0, 240))
		if (peakB <= peakV) {
			throw new Error(`Mitchell 2014 violation: beer peak ${peakB}min ≤ vodka peak ${peakV}min`)
		}
	})
	it('B3.4: Empty-vs-full stomach ordering — full peaks LATER than empty (Wilkinson 1977)', () => {
		const t0 = new Date('2026-05-01T19:00:00Z')
		const dEmpty = [{ ...shotVodka('empty'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const dFull = [{ ...shotVodka('full'), startedAt: t0, finishedAt: addMinutes(t0, 1) }]
		const peakE = findPeakMinute(generateCurveForTests(dEmpty, STANDARD_MALE, t0, 240))
		const peakF = findPeakMinute(generateCurveForTests(dFull, STANDARD_MALE, t0, 240))
		if (peakF - peakE < 10) {
			throw new Error(`Stomach effect too small: empty=${peakE}, full=${peakF}, delta=${peakF-peakE}min < 10min`)
		}
	})
})
