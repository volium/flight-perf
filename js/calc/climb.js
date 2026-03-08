import { interpolateFromTable } from '../engine/interpolation.js';
import { pressureAltitude } from './density-altitude.js';
import { convert } from '../engine/units.js';

/**
 * Perform climb performance calculation from profile data (single altitude).
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

/**
 * Full climb planner: computes pressure altitudes, numerically integrates
 * time to climb, and returns a detailed result object.
 *
 * All inputs are in native units (ft, inHg). Unit conversion is handled
 * by the UI layer before calling this function.
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs
 * @param {number} inputs.departureElevation – Departure field elevation in ft
 * @param {number} inputs.targetElevation    – Target altitude in ft (field elevation)
 * @param {number} inputs.altimeter          – Altimeter setting in inHg
 * @returns {object} Climb plan results
 */
export function calculateClimbPlan(profile, inputs) {
  const climb = profile?.performance?.climb;
  if (!climb) {
    return { error: 'No climb performance data in this profile.' };
  }

  if (climb.method !== 'table_interpolation') {
    return { error: `Unsupported climb method: ${climb.method}` };
  }

  const { departureElevation, targetElevation, altimeter } = inputs;

  const departurePa = pressureAltitude(departureElevation, altimeter);
  const targetPa = pressureAltitude(targetElevation, altimeter);
  const altitudeToClimb = targetPa - departurePa;

  if (altitudeToClimb <= 0) {
    return { error: 'Target altitude must be higher than departure altitude.' };
  }

  // ROC at departure and target
  const rocDep = interpolateFromTable(
    climb.data, 'pressureAltitude', 'rateOfClimb', departurePa,
  );
  const rocTgt = interpolateFromTable(
    climb.data, 'pressureAltitude', 'rateOfClimb', targetPa,
  );

  // Best climb speed at departure (representative Vy)
  const bcs = interpolateFromTable(
    climb.data, 'pressureAltitude', 'bestClimbSpeed', departurePa,
  );

  const clamped = rocDep.clamped || rocTgt.clamped;
  const clampedTo = rocDep.clamped ? rocDep.clampedTo : rocTgt.clamped ? rocTgt.clampedTo : null;

  // Numerical integration: step through altitude in 100 ft increments
  const STEP = 100;
  let totalMinutes = 0;
  let ceilingReached = false;
  let ceilingAltitude = null;
  const steps = Math.ceil(altitudeToClimb / STEP);

  for (let i = 0; i < steps; i++) {
    const stepBottom = departurePa + i * STEP;
    const stepTop = Math.min(stepBottom + STEP, targetPa);
    const midAlt = (stepBottom + stepTop) / 2;
    const dAlt = stepTop - stepBottom;

    const rocMid = interpolateFromTable(
      climb.data, 'pressureAltitude', 'rateOfClimb', midAlt,
    );

    if (rocMid.value <= 0) {
      ceilingReached = true;
      ceilingAltitude = Math.round(stepBottom);
      break;
    }

    totalMinutes += dAlt / rocMid.value;
  }

  const averageRoc = ceilingReached ? null : Math.round(altitudeToClimb / totalMinutes);

  return {
    departurePa: Math.round(departurePa),
    targetPa: Math.round(targetPa),
    altitudeToClimb: Math.round(altitudeToClimb),
    rocAtDeparture: Math.round(rocDep.value),
    rocAtTarget: Math.round(rocTgt.value),
    averageRoc,
    timeToClimb: ceilingReached ? null : Math.round(totalMinutes * 10) / 10,
    bestClimbSpeed: Math.round(bcs.value),
    clamped,
    clampedTo,
    ceilingReached,
    ceilingAltitude,
    referenceConditions: climb.referenceConditions,
    description: climb.description || '',
  };
}
