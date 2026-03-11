import { interpolateFromTable, interpolate2D } from '../engine/interpolation.js';
import { pressureAltitude } from './density-altitude.js';

/**
 * Perform climb performance calculation from profile data (single altitude).
 *
 * Supports 1D (altitude only, e.g., Sling LSA) and 2D (altitude × temperature,
 * e.g., Cessna 172S) interpolation based on the profile's variables array.
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs
 * @param {number} inputs.pressureAltitude – Pressure altitude in feet
 * @param {number} [inputs.temperature]   – OAT in °C (required for 2D profiles)
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
  const variables = climb.variables || ['pressureAltitude'];
  const hasTemp = variables.includes('temperature');

  let roc, bcs;

  if (hasTemp && inputs.temperature != null) {
    roc = interpolate2D(
      climb.data, 'pressureAltitude', 'temperature', 'rateOfClimb',
      pressureAltitude, inputs.temperature,
    );
    bcs = interpolate2D(
      climb.data, 'pressureAltitude', 'temperature', 'bestClimbSpeed',
      pressureAltitude, inputs.temperature,
    );
  } else {
    roc = interpolateFromTable(
      climb.data, 'pressureAltitude', 'rateOfClimb', pressureAltitude,
    );
    bcs = interpolateFromTable(
      climb.data, 'pressureAltitude', 'bestClimbSpeed', pressureAltitude,
    );
  }

  return {
    rateOfClimb: Math.round(roc.value),
    bestClimbSpeed: Math.round(bcs.value),
    clamped: roc.clamped,
    clampedTo: roc.clampedTo,
    pressureAltitude,
    temperature: hasTemp ? inputs.temperature : null,
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
 * @param {number} [inputs.transitionElevation] – Altitude (ft, field elev) to switch
 *        from Vy climb to cruise climb. If omitted, full Vy climb is assumed.
 * @param {number} [inputs.cruiseClimbSpeed]     – Cruise climb IAS in knots. Used with
 *        profile Vy and Vh to compute an ROC reduction factor. If omitted, full Vy
 *        ROC is used above the transition altitude.
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
  const cruiseClimbFactor = deriveCruiseClimbFactor(
    inputs.cruiseClimbSpeed, profile.speeds,
  );

  const departurePa = Math.round(pressureAltitude(departureElevation, altimeter));
  const targetPa = Math.round(pressureAltitude(targetElevation, altimeter));
  const altitudeToClimb = targetPa - departurePa;

  const transitionPa = inputs.transitionElevation != null
    ? Math.round(pressureAltitude(inputs.transitionElevation, altimeter))
    : null;

  if (altitudeToClimb <= 0) {
    return { error: 'Target altitude must be higher than departure altitude.' };
  }

  const extrapolateOpts = { extrapolate: true };

  // ROC at departure and target (extrapolate beyond table range)
  const rocDep = interpolateFromTable(
    climb.data, 'pressureAltitude', 'rateOfClimb', departurePa, null, extrapolateOpts,
  );
  const rocTgt = interpolateFromTable(
    climb.data, 'pressureAltitude', 'rateOfClimb', targetPa, null, extrapolateOpts,
  );

  // Best climb speed at departure (representative Vy)
  const bcs = interpolateFromTable(
    climb.data, 'pressureAltitude', 'bestClimbSpeed', departurePa,
  );

  const extrapolated = rocDep.extrapolated || rocTgt.extrapolated;

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
      climb.data, 'pressureAltitude', 'rateOfClimb', midAlt, null, extrapolateOpts,
    );

    if (rocMid.value <= 0) {
      ceilingReached = true;
      ceilingAltitude = Math.round(stepBottom);
      break;
    }

    const inCruiseClimb = transitionPa != null && midAlt >= transitionPa;
    const effectiveRoc = inCruiseClimb ? rocMid.value * cruiseClimbFactor : rocMid.value;

    if (effectiveRoc <= 0) {
      ceilingReached = true;
      ceilingAltitude = Math.round(stepBottom);
      break;
    }

    totalMinutes += dAlt / effectiveRoc;
  }

  const averageRoc = ceilingReached ? null : Math.round(altitudeToClimb / totalMinutes);

  // If target is above transition, show the effective (reduced) ROC at target
  const targetAboveTransition = transitionPa != null && targetPa >= transitionPa;
  const effectiveRocAtTarget = ceilingReached
    ? 0
    : Math.round(rocTgt.value * (targetAboveTransition ? cruiseClimbFactor : 1));

  return {
    departurePa,
    targetPa,
    altitudeToClimb,
    rocAtDeparture: Math.round(rocDep.value),
    rocAtTarget: effectiveRocAtTarget,
    averageRoc,
    timeToClimb: ceilingReached ? null : Math.round(totalMinutes * 10) / 10,
    bestClimbSpeed: Math.round(bcs.value),
    transitionPa,
    cruiseClimbFactor,
    cruiseClimbSpeed: inputs.cruiseClimbSpeed ?? null,
    extrapolated,
    ceilingReached,
    ceilingAltitude,
    referenceConditions: climb.referenceConditions,
    description: climb.description || '',
  };
}

/**
 * Derive a ROC reduction factor from cruise climb speed using the
 * parabolic excess-power approximation for propeller aircraft:
 *
 *   factor = 1 − ((V − Vy) / (Vh − Vy))²
 *
 * Returns 1.0 (no reduction) when speed ≤ Vy or speeds are unavailable.
 *
 * @param {number|null|undefined} speed – Cruise climb IAS (knots)
 * @param {object} speeds               – Profile speeds object
 * @returns {number} Factor in range (0, 1]
 */
function deriveCruiseClimbFactor(speed, speeds) {
  if (speed == null) return 1.0;

  const vy = speeds?.vy?.value;
  const vh = speeds?.vh?.value;
  if (!vy || !vh || vh <= vy) return 1.0;

  if (speed <= vy) return 1.0;
  if (speed >= vh) return 0.01; // effectively zero but avoids division issues

  const ratio = (speed - vy) / (vh - vy);
  return 1 - ratio * ratio;
}
