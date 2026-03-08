import { calcReferenceTable } from '../engine/perf-common.js';

/**
 * Perform landing distance calculation from profile data.
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs  – { surface, margins, distanceUnit }
 * @returns {object} Calculation results
 */
export function calculateLanding(profile, inputs) {
  const landing = profile?.performance?.landing;
  if (!landing) {
    return { error: 'No landing performance data in this profile.' };
  }

  if (landing.method === 'reference_table') {
    return calcReferenceTable(landing, inputs);
  }

  return { error: `Unsupported landing method: ${landing.method}` };
}
