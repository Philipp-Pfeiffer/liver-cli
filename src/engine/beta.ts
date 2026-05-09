// Engine-Einheit ist ‰/h. Niemals mit %/h oder mg/100mL/h vermischen.
// Konvertierung NUR in Kommentaren: 0.165 ‰/h ≡ 0.0165 %/h ≡ 16.5 mg/100mL/h
const BETA_PLAUSIBLE = { min: 0.10, max: 0.25 } as const;

export function defaultBeta(sex: 'm' | 'f' | 'o', age: number): number {
	if (sex === 'm') {
		if (age <= 25) return 0.165; // Barinskaia 2009, Dettling 2007, Maskell 2024
		if (age <= 60) return 0.15; // Jones 2010 population avg
		return 0.13; // Barinskaia 2009 elderly
	}
	if (sex === 'f') {
		if (age <= 25) return 0.16; // Dettling 2007
		if (age <= 60) return 0.15;
		return 0.14;
	}
	return 0.16; // 'other' conservative midpoint
}

export function clampBeta(beta: number): number {
	if (beta < BETA_PLAUSIBLE.min || beta > BETA_PLAUSIBLE.max) {
		console.warn(`[liver] β=${beta} ‰/h outside plausible range, clamping`);
	}
	return Math.max(BETA_PLAUSIBLE.min, Math.min(BETA_PLAUSIBLE.max, beta));
}

export const FED_BETA_MULT = { empty: 1.0, some: 1.2, full: 1.4 } as const;

export type StomachState = 'empty' | 'some' | 'full';

export function effectiveBeta(baseBeta: number, stomach: StomachState): number {
	return baseBeta * FED_BETA_MULT[stomach];
}
