import { applyMargin } from '../engine/margins.js';
import { convert } from '../engine/units.js';

/**
 * Perform takeoff distance calculation from profile data.
 *
 * Supports two profile methods:
 *   - "reference_table" — single condition, select by surface type
 *   - "table_interpolation" — interpolate by altitude/temperature (future)
 *
 * @param {object} profile     – Full aircraft profile
 * @param {object} inputs      – User inputs
 * @param {string} inputs.surface       – Surface type ID (e.g., "concrete_asphalt")
 * @param {object} [inputs.margins]     – Margin config for this calculation
 * @param {string} [inputs.distanceUnit] – "m" or "ft" (display preference)
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

function calcReferenceTable(takeoff, inputs) {
  const { surface, margins, distanceUnit } = inputs;

  const row = takeoff.data.find((d) => d.surface === surface);
  if (!row) {
    return { error: `No data for surface type: ${surface}` };
  }

  const obstacleHeight = takeoff.obstacleHeight;
  const refConditions = takeoff.referenceConditions;

  const grRaw = getDistanceValue(row.groundRoll, distanceUnit);
  const toRaw = getDistanceValue(row.totalOverObstacle, distanceUnit);
  const unit = distanceUnit || row.groundRoll.unit;

  const groundRoll = applyMargin(grRaw, margins?.groundRoll);
  const totalOverObstacle = applyMargin(toRaw, margins?.totalOverObstacle);

  const obstacleLabel = formatObstacleLabel(obstacleHeight);

  return {
    method: 'reference_table',
    surface: row.surfaceLabel,
    surfaceId: row.surface,
    groundRoll,
    totalOverObstacle,
    obstacleLabel,
    obstacleHeight,
    distanceUnit: unit,
    referenceConditions: refConditions,
    corrections: takeoff.corrections || [],
    description: takeoff.description || '',
  };
}

function getDistanceValue(distObj, preferredUnit) {
  if (!preferredUnit || preferredUnit === distObj.unit) {
    return distObj.value;
  }
  if (preferredUnit === 'ft' && distObj.unit === 'm') {
    return distObj.valueFt != null ? distObj.valueFt : Math.round(convert.mToFt(distObj.value));
  }
  if (preferredUnit === 'm' && distObj.unit === 'ft') {
    return Math.round(convert.ftToM(distObj.value));
  }
  return distObj.value;
}

function formatObstacleLabel(obstacle) {
  if (!obstacle) return 'over obstacle';
  if (obstacle.unit === 'm') {
    const ft = obstacle.valueFt != null ? obstacle.valueFt : Math.round(convert.mToFt(obstacle.value));
    return `over ${obstacle.value} m (${ft} ft)`;
  }
  return `over ${obstacle.value} ${obstacle.unit}`;
}
