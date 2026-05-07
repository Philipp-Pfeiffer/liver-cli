/* tslint:disable */
/* eslint-disable */

/**
 * Calculate BAC from a set of drinks.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 *
 * # Returns
 * BAC as a number (e.g., 0.08 for 0.08%)
 */
export function calculateBAC(drinks: any, profile: any, formula: any): number;

/**
 * Calculate complete BAC snapshot.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 * - `sweetSpotMin`: Minimum BAC for sweet spot (e.g., 0.06)
 * - `sweetSpotMax`: Maximum BAC for sweet spot (e.g., 0.09)
 *
 * # Returns
 * Snapshot object with bac, trajectory, zone, and time_to_sober_secs
 */
export function calculateSnapshot(drinks: any, profile: any, formula: any, sweet_spot_min: number, sweet_spot_max: number): any;

/**
 * Calculate BAC trajectory (rising, falling, or stable).
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 *
 * # Returns
 * Trajectory object: "rising", "falling", or "stable"
 */
export function calculateTrajectory(drinks: any, profile: any, formula: any): any;

/**
 * Classify a BAC value into a zone.
 *
 * # Parameters
 * - `bac`: BAC level (e.g., 0.08)
 * - `sweetSpotMin`: Minimum BAC for sweet spot
 * - `sweetSpotMax`: Maximum BAC for sweet spot
 *
 * # Returns
 * Zone: "sober", "below_sweet_spot", "sweet_spot", "caution", or "danger"
 */
export function classifyZone(bac: number, sweet_spot_min: number, sweet_spot_max: number): any;

/**
 * Count drinks still being absorbed.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 *
 * # Returns
 * Number of drinks still absorbing
 */
export function countAbsorbingDrinks(drinks: any): number;

/**
 * Create a Drink object.
 *
 * # Parameters
 * - `volumeMl`: Volume in milliliters
 * - `abv`: Alcohol by volume (0.05 for 5%)
 * - `offsetSecs`: Seconds since now at which the user started the drink
 *   (negative for past drinks)
 * - `durationSecs`: How long the drink is/was consumed over, in seconds.
 *   Pass `0` for an instantaneous drink (e.g. a shot).
 * - `stomachState`: "empty", "some_food", or "full"
 */
export function createDrink(volume_ml: number, abv: number, offset_secs: number, duration_secs: number, stomach_state: any): any;

/**
 * Create a UserProfile object.
 *
 * # Parameters
 * - `weightKg`: Weight in kilograms
 * - `biologicalSex`: "male", "female", or "other"
 * - `heightCm`: Height in centimeters
 * - `age`: Age in years
 */
export function createUserProfile(weight_kg: number, biological_sex: any, height_cm: number, age: number): any;

/**
 * Estimate time to sober (in seconds).
 *
 * # Parameters
 * - `currentBac`: Current BAC level (e.g., 0.08)
 *
 * # Returns
 * Seconds until sober, or null if already sober
 */
export function estimateTimeToSober(current_bac: number): number | undefined;

/**
 * Generate a BAC curve over a time range.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 * - `fromOffsetSecs`: Start of the curve (seconds offset from t=0)
 * - `toOffsetSecs`: End of the curve (seconds offset from t=0)
 * - `stepSecs`: Step size in seconds
 * - `sweetSpotMin`: Minimum BAC for sweet spot
 * - `sweetSpotMax`: Maximum BAC for sweet spot
 *
 * # Returns
 * Array of CurvePoint objects with offset_secs, bac, and zone
 */
export function generateCurve(drinks: any, profile: any, formula: any, from_offset_secs: number, to_offset_secs: number, step_secs: number, sweet_spot_min: number, sweet_spot_max: number): any;

/**
 * Estimate minutes until BAC reaches zero, accounting for ongoing absorption.
 *
 * # Parameters
 * - `drinks`: JSON array of drink objects
 * - `profile`: JSON object with user profile
 * - `formula`: "widmark" or "watson"
 *
 * # Returns
 * Minutes until sober (0.0 if already sober)
 */
export function minutesUntilSober(drinks: any, profile: any, formula: any): number;
