import { calcReferenceTable, formatObstacleLabel } from '../engine/perf-common.js';
import { interpolate2D, interpolate3D } from '../engine/interpolation.js';
import { applyMargin } from '../engine/margins.js';
import { convert } from '../engine/units.js';

/**
 * Perform takeoff distance calculation from profile data.
 *
 * Supports two methods:
 *   - reference_table: surface-type lookup (Sling LSA)
 *   - table_interpolation: multi-dimensional interpolation (Cessna 172S)
 *     2D (altitude × temperature) or 3D (weight × altitude × temperature)
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs
 * @param {string} [inputs.surface]            – Surface type (reference_table only)
 * @param {number} [inputs.pressureAltitude]   – Pressure altitude in ft (table_interpolation)
 * @param {number} [inputs.temperature]        – OAT in °C (table_interpolation)
 * @param {number} [inputs.weight]             – Aircraft weight in profile units (table_interpolation, optional)
 * @param {object} [inputs.margins]            – Margin config { groundRoll, totalOverObstacle }
 * @param {string} [inputs.distanceUnit]       – "m" or "ft"
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

  if (takeoff.method === 'table_interpolation') {
    return calcTableInterpolation(takeoff, inputs, profile);
  }

  return { error: `Unsupported takeoff method: ${takeoff.method}` };
}

function calcTableInterpolation(perfSection, inputs, profile) {
  const { pressureAltitude, temperature, weight, margins, distanceUnit } = inputs;
  const variables = perfSection.variables || [];
  const hasWeight = variables.includes('weight');
  const profileDistUnit = perfSection.units?.groundRoll || 'ft';
  const outputUnit = distanceUnit || profileDistUnit;

  // Determine the weight to use (default to MTOW)
  const effectiveWeight = hasWeight
    ? (weight ?? profile?.limits?.maxTakeoffWeight?.value)
    : null;

  let grResult, toResult;
  const resultKey50 = perfSection.results?.includes('totalOver50ft') ? 'totalOver50ft' : 'totalOverObstacle';

  if (hasWeight) {
    grResult = interpolate3D(
      perfSection.data, 'weight', 'pressureAltitude', 'temperature', 'groundRoll',
      effectiveWeight, pressureAltitude, temperature,
    );
    toResult = interpolate3D(
      perfSection.data, 'weight', 'pressureAltitude', 'temperature', resultKey50,
      effectiveWeight, pressureAltitude, temperature,
    );
  } else {
    grResult = interpolate2D(
      perfSection.data, 'pressureAltitude', 'temperature', 'groundRoll',
      pressureAltitude, temperature,
    );
    toResult = interpolate2D(
      perfSection.data, 'pressureAltitude', 'temperature', resultKey50,
      pressureAltitude, temperature,
    );
  }

  let grRaw = grResult.value;
  let toRaw = toResult.value;

  // Apply corrections (surface, wind)
  if (inputs.corrections) {
    const corrDefs = perfSection.corrections || [];
    for (const applied of inputs.corrections) {
      const def = corrDefs.find((c) => c.type === applied.type);
      if (!def) continue;

      if (def.per) {
        // Per-unit correction (e.g., -10% per 9 kt headwind)
        const units = (applied.value || 0) / def.per.value;
        const factor = 1 + def.factor * units;
        if (def.appliesTo?.includes('groundRoll')) grRaw *= factor;
        if (def.appliesTo?.includes(resultKey50)) toRaw *= factor;
      } else {
        // Fixed correction (e.g., +15% for grass)
        const factor = 1 + def.factor;
        if (def.appliesTo?.includes('groundRoll')) grRaw *= factor;
        if (def.appliesTo?.includes(resultKey50)) toRaw *= factor;
      }
    }
  }

  // Convert distance unit if needed
  if (outputUnit !== profileDistUnit) {
    if (profileDistUnit === 'ft' && outputUnit === 'm') {
      grRaw = convert.ftToM(grRaw);
      toRaw = convert.ftToM(toRaw);
    } else if (profileDistUnit === 'm' && outputUnit === 'ft') {
      grRaw = convert.mToFt(grRaw);
      toRaw = convert.mToFt(toRaw);
    }
  }

  grRaw = Math.round(grRaw);
  toRaw = Math.round(toRaw);

  return {
    method: 'table_interpolation',
    groundRoll: applyMargin(grRaw, margins?.groundRoll),
    totalOverObstacle: applyMargin(toRaw, margins?.totalOverObstacle),
    obstacleLabel: formatObstacleLabel(perfSection.obstacleHeight),
    obstacleHeight: perfSection.obstacleHeight,
    distanceUnit: outputUnit,
    referenceConditions: perfSection.referenceConditions,
    corrections: perfSection.corrections || [],
    description: perfSection.description || '',
    pressureAltitude,
    temperature,
    weight: effectiveWeight,
    clamped: grResult.clamped || toResult.clamped,
  };
}
