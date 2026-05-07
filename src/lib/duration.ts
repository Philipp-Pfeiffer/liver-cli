// Lookup: erste Zeile, deren Schwellwert >= volume_ml ist.
export const VOLUME_DURATION_TABLE = [
	{ maxMl: 50, minutes: 1 },     // Shot
	{ maxMl: 200, minutes: 20 },   // Glas Wein, kleines Glas
	{ maxMl: 350, minutes: 30 },   // 0.33L Bier, Longdrink
	{ maxMl: 550, minutes: 45 },   // 0.5L Bier, Pint
	{ maxMl: 800, minutes: 60 },   // 0.7L Wein-Anteil
	{ maxMl: 1100, minutes: 90 },  // Maa
	{ maxMl: Infinity, minutes: 120 },
] as const;

export type DurationSource = 'config_override' | 'volume_table' | 'fallback_20min';

export interface ResolvedDuration {
	minutes: number;
	source: DurationSource;
}

export interface DurationTableConfig {
	[key: string]: number;
}

export function resolveDefaultDuration(
	volumeMl: number,
	config: {
		default_duration_minutes?: number;
		duration_table?: DurationTableConfig;
	},
): ResolvedDuration {
	// Prio 1: config override
	if (config.default_duration_minutes !== undefined && config.default_duration_minutes > 0) {
		return { minutes: config.default_duration_minutes, source: 'config_override' };
	}

	// Prio 2: custom duration table from config
	if (config.duration_table) {
		const sortedKeys = Object.keys(config.duration_table)
			.map(k => parseInt(k, 10))
			.filter(k => !isNaN(k))
			.sort((a, b) => a - b);
		for (const key of sortedKeys) {
			if (volumeMl <= key) {
				return { minutes: config.duration_table[String(key)], source: 'volume_table' };
			}
		}
	}

	// Prio 3: default volume table
	for (const row of VOLUME_DURATION_TABLE) {
		if (volumeMl <= row.maxMl) {
			return { minutes: row.minutes, source: 'volume_table' };
		}
	}

	// Fallback (should never hit because Infinity covers all)
	return { minutes: 20, source: 'fallback_20min' };
}
