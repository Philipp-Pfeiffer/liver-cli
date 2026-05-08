import type {
  ProfileParams,
  DrinkInput,
  BACFormula,
} from './types.js';
import { generateCurve as ethanolGenerateCurve } from './ethanol.js';
import { nowUTC } from '../time/index.js';

export function projectedPeakFromCurve(
	profile: ProfileParams,
	drinks: DrinkInput[],
	formula: BACFormula,
	startSearch: Date,
	endSearch: Date,
): { timestamp: Date; bac: number } {
	const now = nowUTC();
	const startOffsetMinutes = (startSearch.getTime() - now.getTime()) / 60000;
	const endOffsetMinutes = (endSearch.getTime() - now.getTime()) / 60000;

	const curve = ethanolGenerateCurve(
		profile, drinks, formula,
		startOffsetMinutes, endOffsetMinutes, 1, // 1 minute step
		0, 10, // sweet spot defaults, not used for peak finding
	);

	let maxPoint = curve.points[0];
	if (!maxPoint) {
		return { timestamp: startSearch, bac: 0 };
	}
	for (const point of curve.points) {
		if (point.bacPercent > maxPoint.bacPercent) {
			maxPoint = point;
		}
	}

	const peakTimestamp = new Date(now.getTime() + maxPoint.offsetMinutes * 60000);
	return { timestamp: peakTimestamp, bac: maxPoint.bacPercent };
}
