import { applyMargin } from './margins.js';
import { convert } from './units.js';

/**
 * Calculate distances from a reference_table performance section.
 * Shared by takeoff and landing calculators.
 *
 * @param {object} perfSection – profile.performance.takeoff or .landing
 * @param {object} inputs
 * @param {string} inputs.surface       – Surface type ID
 * @param {object} [inputs.margins]     – Margin config { groundRoll, totalOverObstacle }
 * @param {string} [inputs.distanceUnit] – "m" or "ft"
 * @returns {object} results
 */
export function calcReferenceTable(perfSection, inputs) {
  const { surface, margins, distanceUnit } = inputs;

  const row = perfSection.data.find((d) => d.surface === surface);
  if (!row) {
    return { error: `No data for surface type: ${surface}` };
  }

  const unit = distanceUnit || row.groundRoll.unit;
  const grRaw = getDistanceValue(row.groundRoll, distanceUnit);
  const toRaw = getDistanceValue(row.totalOverObstacle, distanceUnit);

  return {
    method: 'reference_table',
    surface: row.surfaceLabel,
    surfaceId: row.surface,
    groundRoll: applyMargin(grRaw, margins?.groundRoll),
    totalOverObstacle: applyMargin(toRaw, margins?.totalOverObstacle),
    obstacleLabel: formatObstacleLabel(perfSection.obstacleHeight),
    obstacleHeight: perfSection.obstacleHeight,
    distanceUnit: unit,
    referenceConditions: perfSection.referenceConditions,
    corrections: perfSection.corrections || [],
    description: perfSection.description || '',
  };
}

export function getDistanceValue(distObj, preferredUnit) {
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

export function formatObstacleLabel(obstacle) {
  if (!obstacle) return 'over obstacle';
  if (obstacle.unit === 'm') {
    const ft = obstacle.valueFt != null ? obstacle.valueFt : Math.round(convert.mToFt(obstacle.value));
    return `over ${obstacle.value} m (${ft} ft)`;
  }
  return `over ${obstacle.value} ${obstacle.unit}`;
}
