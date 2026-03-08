/**
 * Calculate wind components relative to a runway.
 *
 * @param {number} windDir   – Wind direction in degrees (magnetic, where wind is FROM)
 * @param {number} windSpeed – Wind speed
 * @param {number} runwayHdg – Runway heading in degrees (magnetic)
 * @returns {object} Wind components
 */
export function calculateWindComponents(windDir, windSpeed, runwayHdg) {
  const angleDeg = windDir - runwayHdg;
  const angleRad = (angleDeg * Math.PI) / 180;

  const headwind = windSpeed * Math.cos(angleRad);
  const crosswind = windSpeed * Math.sin(angleRad);

  return {
    headwind: Math.round(headwind * 10) / 10,
    crosswind: Math.round(Math.abs(crosswind) * 10) / 10,
    crosswindRaw: Math.round(crosswind * 10) / 10,
    crosswindDirection: crosswind > 0.05 ? 'right' : crosswind < -0.05 ? 'left' : 'none',
    isHeadwind: headwind >= 0,
    isTailwind: headwind < 0,
    tailwind: headwind < 0 ? Math.round(Math.abs(headwind) * 10) / 10 : 0,
    angleDeg: Math.round(angleDeg),
    angleNormalized: normalizeAngle(angleDeg),
  };
}

/**
 * Full crosswind calculation from user inputs.
 * Accepts wind speed in kt or km/h.
 *
 * @param {object} inputs
 * @param {number} inputs.windDirection – degrees
 * @param {number} inputs.windSpeed     – wind speed value
 * @param {string} inputs.windSpeedUnit – "kt" or "kmh"
 * @param {number} inputs.runwayHeading – degrees (runway number × 10 or exact heading)
 * @param {number} [inputs.gustSpeed]   – gust speed value (same unit as windSpeed)
 * @param {number} [inputs.maxCrosswind]– aircraft max demonstrated crosswind (kt)
 * @returns {object} results
 */
export function calculateCrosswind(inputs) {
  const { windDirection, windSpeed, windSpeedUnit, runwayHeading, gustSpeed, maxCrosswind } = inputs;

  const speedKt = windSpeedUnit === 'kmh' ? windSpeed * 0.539957 : windSpeed;
  const gustKt = gustSpeed != null && !isNaN(gustSpeed)
    ? (windSpeedUnit === 'kmh' ? gustSpeed * 0.539957 : gustSpeed)
    : null;

  const steady = calculateWindComponents(windDirection, speedKt, runwayHeading);

  const gust = gustKt != null
    ? calculateWindComponents(windDirection, gustKt, runwayHeading)
    : null;

  const reciprocalHeading = (runwayHeading + 180) % 360;
  const reciprocal = calculateWindComponents(windDirection, speedKt, reciprocalHeading);
  const gustReciprocal = gustKt != null
    ? calculateWindComponents(windDirection, gustKt, reciprocalHeading)
    : null;

  const effectiveCrosswind = gust ? gust.crosswind : steady.crosswind;

  let crosswindStatus = 'ok';
  if (maxCrosswind != null && maxCrosswind > 0) {
    if (effectiveCrosswind > maxCrosswind) {
      crosswindStatus = 'exceeds';
    } else if (effectiveCrosswind > maxCrosswind * 0.8) {
      crosswindStatus = 'caution';
    }
  }

  return {
    steady,
    gust,
    reciprocal,
    gustReciprocal,
    runwayHeading,
    reciprocalHeading,
    windDirection,
    crosswindStatus,
    maxCrosswind: maxCrosswind ?? null,
    windSpeedKt: Math.round(speedKt * 10) / 10,
    gustSpeedKt: gustKt != null ? Math.round(gustKt * 10) / 10 : null,
  };
}

function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}
