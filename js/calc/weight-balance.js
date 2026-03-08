import { getFuelType } from '../data/fuel-types.js';
import { convert } from '../engine/units.js';

/**
 * Calculate weight & balance from profile and station weights.
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs
 * @param {Object<string, number>} inputs.stationWeights – { stationId: weight } in profile weight units
 * @param {number} inputs.fuelQuantity    – Fuel quantity in the profile's fuel.inputUnit
 * @returns {object} W&B results
 */
export function calculateWeightBalance(profile, inputs) {
  const wb = profile?.weightBalance;
  if (!wb) return { error: 'No weight & balance data in this profile.' };

  const limits = profile.limits;
  const fuelConfig = profile.fuel;
  const { stationWeights, fuelQuantity } = inputs;

  // Resolve fuel weight in profile weight units (kg for Sling LSA)
  const fuelWeightKg = resolveFuelWeight(fuelQuantity, fuelConfig);

  // Compute total weight and moment from empty weight + stations
  const emptyWeight = limits.emptyWeight.value;
  const emptyArm = computeEmptyArm(wb);
  const emptyMoment = emptyWeight * emptyArm;

  let totalWeight = emptyWeight;
  let totalMoment = emptyMoment;
  const stationResults = [];

  for (const station of wb.stations) {
    let weight;
    if (station.fuelStation) {
      weight = fuelWeightKg;
    } else {
      weight = stationWeights[station.id] || 0;
    }

    const arm = station.arm.value;
    const moment = weight * arm;

    totalWeight += weight;
    totalMoment += moment;

    stationResults.push({
      id: station.id,
      name: station.name,
      weight,
      arm,
      moment,
      maxWeight: station.maxWeight?.value ?? null,
      overweight: station.maxWeight && !station.fuelStation ? weight > station.maxWeight.value : false,
    });
  }

  const cgArm = totalWeight > 0 ? totalMoment / totalWeight : 0;

  // Convert CG to %MAC if required
  let cgPercent = null;
  if (wb.cgReference === 'percent_mac') {
    const lemac = wb.macLeadingEdge.value;
    const macLen = wb.macLength.value;
    cgPercent = ((cgArm - lemac) / macLen) * 100;
    cgPercent = Math.round(cgPercent * 10) / 10;
  }

  // CG value for envelope checking (either arm or %MAC)
  const cgForEnvelope = wb.cgReference === 'percent_mac' ? cgPercent : cgArm;

  // Check envelopes
  const envelopeResults = wb.envelopes.map((env) => ({
    id: env.id,
    name: env.name,
    color: env.color,
    within: pointInPolygon(totalWeight, cgForEnvelope, env.points),
  }));

  const withinAny = envelopeResults.some((e) => e.within);
  const withinAll = envelopeResults.every((e) => e.within);

  // Check baggage constraints
  const constraintWarnings = checkBaggageConstraints(wb.baggageConstraints, stationWeights);

  // Weight limit checks
  const maxWeight = limits.maxTakeoffWeight.value;
  const overweight = totalWeight > maxWeight;
  const weightRemaining = maxWeight - totalWeight;

  return {
    emptyWeight,
    emptyArm: Math.round(emptyArm * 10) / 10,
    totalWeight: Math.round(totalWeight * 10) / 10,
    cgArm: Math.round(cgArm * 10) / 10,
    cgPercent,
    cgReference: wb.cgReference,
    cgUnit: wb.cgUnit,
    weightUnit: wb.weightUnit,
    armUnit: wb.armUnit,
    stations: stationResults,
    envelopes: envelopeResults,
    envelopePoints: wb.envelopes,
    withinAny,
    withinAll,
    overweight,
    maxWeight,
    weightRemaining: Math.round(weightRemaining * 10) / 10,
    fuelWeightKg: Math.round(fuelWeightKg * 10) / 10,
    fuelQuantity,
    fuelInputUnit: fuelConfig?.inputUnit || 'L',
    constraintWarnings,
  };
}

/**
 * Compute the empty weight arm from the %MAC CG.
 * arm = LEMAC + (%MAC / 100) × MAC_length
 */
function computeEmptyArm(wb) {
  if (wb.cgReference === 'percent_mac' && wb.emptyCG) {
    const lemac = wb.macLeadingEdge.value;
    const macLen = wb.macLength.value;
    return lemac + (wb.emptyCG.value / 100) * macLen;
  }
  return wb.emptyCG?.arm ?? 0;
}

/**
 * Convert fuel quantity to weight in kg.
 */
function resolveFuelWeight(quantity, fuelConfig) {
  if (quantity == null || isNaN(quantity) || quantity <= 0) return 0;

  const fuel = getFuelType(fuelConfig?.type || '100LL');
  const inputUnit = fuelConfig?.inputUnit || 'L';

  switch (inputUnit) {
    case 'L':
      return quantity * (fuel?.densityKgPerL || 0.721);
    case 'us_gal':
      return convert.lbsToKg(quantity * (fuel?.densityLbsPerGal || 6.02));
    case 'kg':
      return quantity;
    case 'lbs':
      return convert.lbsToKg(quantity);
    default:
      return quantity * 0.721;
  }
}

/**
 * Point-in-polygon test using ray casting.
 * Points are { weight, cg } objects.
 */
function pointInPolygon(weight, cg, points) {
  let inside = false;
  const n = points.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const wi = points[i].weight, ci = points[i].cg;
    const wj = points[j].weight, cj = points[j].cg;

    if ((wi > weight) !== (wj > weight) &&
        cg < ((cj - ci) * (weight - wi)) / (wj - wi) + ci) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check baggage constraints and return any warnings.
 */
function checkBaggageConstraints(constraints, stationWeights) {
  if (!constraints || constraints.length === 0) return [];

  return constraints
    .map((c) => {
      const combined = c.stationIds.reduce(
        (sum, id) => sum + (stationWeights[id] || 0),
        0,
      );
      if (combined > c.maxCombinedWeight.value) {
        return {
          description: c.description,
          combined: Math.round(combined * 10) / 10,
          max: c.maxCombinedWeight.value,
          unit: c.maxCombinedWeight.unit,
        };
      }
      return null;
    })
    .filter(Boolean);
}
