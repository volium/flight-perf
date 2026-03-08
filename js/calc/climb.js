import { interpolateFromTable } from '../engine/interpolation.js';

/**
 * Perform climb performance calculation from profile data.
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs
 * @param {number} inputs.pressureAltitude – Pressure altitude in feet
 * @returns {object} Calculation results
 */
export function calculateClimb(profile, inputs) {
  const climb = profile?.performance?.climb;
  if (!climb) {
    return { error: 'No climb performance data in this profile.' };
  }

  if (climb.method !== 'table_interpolation') {
    return { error: `Unsupported climb method: ${climb.method}` };
  }

  const { pressureAltitude } = inputs;

  const roc = interpolateFromTable(
    climb.data, 'pressureAltitude', 'rateOfClimb', pressureAltitude,
  );

  const bcs = interpolateFromTable(
    climb.data, 'pressureAltitude', 'bestClimbSpeed', pressureAltitude,
  );

  return {
    rateOfClimb: Math.round(roc.value),
    bestClimbSpeed: Math.round(bcs.value),
    clamped: roc.clamped,
    clampedTo: roc.clampedTo,
    pressureAltitude,
    referenceConditions: climb.referenceConditions,
    description: climb.description || '',
  };
}
