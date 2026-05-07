export type Band = { lower: number; upper: number; source: string }

export const BANDS = {
	beta: {
		physiological: { lower: 0.10, upper: 0.35, source: 'Jones 2010' },
		forensic_moderate: { lower: 0.10, upper: 0.20, source: 'Jones 2010' },
	},
	r_male: {
		physiological: { lower: 0.60, upper: 0.87, source: 'Seidl 2000' },
		forensic: { lower: 0.65, upper: 0.75, source: 'Forrest 1986' },
	},
	r_female: {
		physiological: { lower: 0.44, upper: 0.80, source: 'Seidl 2000' },
		forensic: { lower: 0.50, upper: 0.65, source: 'Forrest 1986' },
	},
	ka_empty: { lower: 3.0, upper: 6.0, source: 'Wilkinson 1977' },
	ka_some: { lower: 1.5, upper: 3.5, source: 'Wilkinson 1977' },
	ka_full: { lower: 0.8, upper: 2.2, source: 'Wilkinson 1977' },
	peak_min_bolus_empty: { lower: 15, upper: 45, source: 'Mitchell 2014' },
	peak_min_bolus_some: { lower: 20, upper: 60, source: 'Wilkinson 1977' },
	peak_min_bolus_full: { lower: 30, upper: 90, source: 'Wilkinson 1977' },
} as const

export function expectInBand(value: number, band: Band, label?: string): void {
	if (value < band.lower || value > band.upper) {
		throw new Error(
			`${label ?? 'value'} = ${value} not in band [${band.lower}, ${band.upper}] ` +
			`(source: ${band.source})`
		)
	}
}

export function expectRelativeAgreement(
	actual: number,
	expected: number,
	tolerance: number,
	label?: string,
): void {
	const delta = Math.abs(actual - expected)
	if (delta / expected > tolerance) {
		throw new Error(
			`${label ?? 'value'}: actual=${actual}, expected=${expected}, ` +
			`relative delta=${(delta / expected * 100).toFixed(1)}% > ${(tolerance * 100).toFixed(1)}%`
		)
	}
}
