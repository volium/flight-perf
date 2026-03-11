import { calcReferenceTable, formatObstacleLabel } from '../engine/perf-common.js';
import { interpolate2D } from '../engine/interpolation.js';
import { applyMargin } from '../engine/margins.js';
import { convert } from '../engine/units.js';

/**
 * Perform landing distance calculation from profile data.
 *
 * Supports two methods:
 *   - reference_table: surface-type lookup (Sling LSA)
 *   - table_interpolation: 2D interpolation altitude × temperature (Cessna 172S)
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs
 * @param {string} [inputs.surface]            – Surface type (reference_table only)
 * @param {number} [inputs.pressureAltitude]   – Pressure altitude in ft (table_interpolation)
 * @param {number} [inputs.temperature]        – OAT in °C (table_interpolation)
 * @param {object} [inputs.margins]            – Margin config { groundRoll, totalOverObstacle }
 * @param {string} [inputs.distanceUnit]       – "m" or "ft"
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

  if (landing.method === 'table_interpolation') {
    return calcTableInterpolation(landing, inputs);
  }

  return { error: `Unsupported landing method: ${landing.method}` };
}

function calcTableInterpolation(perfSection, inputs) {
  const { pressureAltitude, temperature, margins, distanceUnit } = inputs;
  const profileDistUnit = perfSection.units?.groundRoll || 'ft';
  const outputUnit = distanceUnit || profileDistUnit;
  const resultKey50 = perfSection.results?.includes('totalOver50ft') ? 'totalOver50ft' : 'totalOverObstacle';

  const grResult = interpolate2D(
    perfSection.data, 'pressureAltitude', 'temperature', 'groundRoll',
    pressureAltitude, temperature,
  );
  const toResult = interpolate2D(
    perfSection.data, 'pressureAltitude', 'temperature', resultKey50,
    pressureAltitude, temperature,
  );

  let grRaw = grResult.value;
  let toRaw = toResult.value;

  // Apply corrections (surface, wind)
  if (inputs.corrections) {
    const corrDefs = perfSection.corrections || [];
    for (const applied of inputs.corrections) {
      const def = corrDefs.find((c) => c.type === applied.type);
      if (!def) continue;

      if (def.per) {
        const units = (applied.value || 0) / def.per.value;
        const factor = 1 + def.factor * units;
        if (def.appliesTo?.includes('groundRoll')) grRaw *= factor;
        if (def.appliesTo?.includes(resultKey50)) toRaw *= factor;
      } else {
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
    clamped: grResult.clamped || toResult.clamped,
  };
}
