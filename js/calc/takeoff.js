import { calcReferenceTable } from '../engine/perf-common.js';

/**
 * Perform takeoff distance calculation from profile data.
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs  – { surface, margins, distanceUnit }
 * @returns {object} Calculation results
 */
export function calculateTakeoff(profile, inputs) {
  const takeoff = profile?.performance?.takeoff;
  if (!takeoff) {
    return { error: 'No takeoff performance data in this profile.' };
  }

  if (takeoff.method === 'reference_table') {
    return calcReferenceTable(takeoff, inputs);
  }

  return { error: `Unsupported takeoff method: ${takeoff.method}` };
}
