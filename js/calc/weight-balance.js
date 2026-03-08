import { getFuelType } from '../data/fuel-types.js';
import { convert } from '../engine/units.js';

/**
 * Calculate weight & balance from profile and station weights.
 *
 * All calculations are performed in the display weight unit to avoid
 * floating point errors from round-trip unit conversions on user inputs.
 * Profile values (empty weight, limits, envelope) are converted once
 * into the display unit before arithmetic.
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs
 * @param {Object<string, number>} inputs.stationWeights – { stationId: weight } in displayWeightUnit
 * @param {number} inputs.fuelQuantity    – Fuel quantity in displayFuelUnit
 * @param {string} inputs.displayWeightUnit – "kg" or "lbs"
 * @param {string} inputs.displayFuelUnit   – "L" or "us_gal"
 * @returns {object} W&B results
 */
export function calculateWeightBalance(profile, inputs) {
  const wb = profile?.weightBalance;
  if (!wb) return { error: 'No weight & balance data in this profile.' };

  const limits = profile.limits;
  const fuelConfig = profile.fuel;
  const { stationWeights, fuelQuantity, displayWeightUnit, displayFuelUnit } = inputs;

  const profileWU = wb.weightUnit || 'kg';
  const wu = displayWeightUnit || profileWU;

  // Convert profile values into display weight unit (done once)
  const emptyWeight = convertWeight(limits.emptyWeight.value, profileWU, wu);
  const maxWeight = Math.round(convertWeight(limits.maxTakeoffWeight.value, profileWU, wu));
  const emptyArm = computeEmptyArm(wb);
  const emptyMoment = emptyWeight * emptyArm;

  // Resolve fuel weight in display weight unit
  const fuelWeight = resolveFuelWeight(fuelQuantity, displayFuelUnit, wu, fuelConfig);

  let totalWeight = emptyWeight;
  let totalMoment = emptyMoment;
  const stationResults = [];

  for (const station of wb.stations) {
    let weight;
    if (station.fuelStation) {
      weight = fuelWeight;
    } else {
      weight = stationWeights[station.id] || 0;
    }

    const arm = station.arm.value;
    const moment = weight * arm;

    totalWeight += weight;
    totalMoment += moment;

    const stMaxWeight = station.maxWeight
      ? convertWeight(station.maxWeight.value, station.maxWeight.unit || profileWU, wu)
      : null;

    stationResults.push({
      id: station.id,
      name: station.name,
      weight,
      arm,
      moment,
      maxWeight: stMaxWeight,
      overweight: stMaxWeight != null && !station.fuelStation ? weight > stMaxWeight : false,
    });
  }

  const totalWeightRounded = Math.round(totalWeight * 10) / 10;
  const cgArm = totalWeight > 0 ? totalMoment / totalWeight : 0;

  // Convert CG to %MAC if required
  let cgPercent = null;
  if (wb.cgReference === 'percent_mac') {
    const lemac = wb.macLeadingEdge.value;
    const macLen = wb.macLength.value;
    cgPercent = ((cgArm - lemac) / macLen) * 100;
    cgPercent = Math.round(cgPercent * 10) / 10;
  }

  // Check envelopes — convert envelope points to display weight unit
  const cgForEnvelope = wb.cgReference === 'percent_mac' ? cgPercent : cgArm;
  const envelopeResults = wb.envelopes.map((env) => {
    const convertedPoints = env.points.map((pt) => ({
      weight: Math.round(convertWeight(pt.weight, profileWU, wu)),
      cg: pt.cg,
    }));
    return {
      id: env.id,
      name: env.name,
      color: env.color,
      within: pointInPolygon(totalWeightRounded, cgForEnvelope, convertedPoints),
      points: convertedPoints,
    };
  });

  const withinAny = envelopeResults.some((e) => e.within);
  const withinAll = envelopeResults.every((e) => e.within);

  // Check baggage constraints (convert limits to display weight unit)
  const constraintWarnings = checkBaggageConstraints(wb.baggageConstraints, stationWeights, profileWU, wu);

  const overweight = totalWeightRounded > maxWeight;
  const weightRemaining = maxWeight - totalWeightRounded;

  return {
    emptyWeight,
    emptyArm: Math.round(emptyArm * 10) / 10,
    totalWeight: totalWeightRounded,
    cgArm: Math.round(cgArm * 10) / 10,
    cgPercent,
    cgReference: wb.cgReference,
    cgUnit: wb.cgUnit,
    weightUnit: wu,
    armUnit: wb.armUnit,
    stations: stationResults,
    envelopes: envelopeResults,
    envelopePoints: envelopeResults.map((e) => ({
      id: e.id, name: e.name, color: e.color, points: e.points,
    })),
    withinAny,
    withinAll,
    overweight,
    maxWeight,
    weightRemaining: Math.round(weightRemaining * 10) / 10,
    fuelWeight: Math.round(fuelWeight * 10) / 10,
    fuelQuantity,
    constraintWarnings,
  };
}

/**
 * Compute the empty weight arm from the %MAC CG.
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
 * Convert fuel quantity to weight in the display weight unit.
 */
function resolveFuelWeight(quantity, fuelUnit, weightUnit, fuelConfig) {
  if (quantity == null || isNaN(quantity) || quantity <= 0) return 0;

  const fuel = getFuelType(fuelConfig?.type || '100LL');

  if (fuelUnit === 'L') {
    const kg = quantity * (fuel?.densityKgPerL || 0.721);
    return weightUnit === 'lbs' ? convert.kgToLbs(kg) : kg;
  }
  if (fuelUnit === 'us_gal') {
    const lbs = quantity * (fuel?.densityLbsPerGal || 6.02);
    return weightUnit === 'kg' ? convert.lbsToKg(lbs) : lbs;
  }
  if (fuelUnit === 'kg') {
    return weightUnit === 'lbs' ? convert.kgToLbs(quantity) : quantity;
  }
  if (fuelUnit === 'lbs') {
    return weightUnit === 'kg' ? convert.lbsToKg(quantity) : quantity;
  }
  return quantity;
}

function convertWeight(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'kg' && toUnit === 'lbs') return convert.kgToLbs(value);
  if (fromUnit === 'lbs' && toUnit === 'kg') return convert.lbsToKg(value);
  return value;
}

/**
 * Point-in-polygon test using ray casting.
 * Nudges test point toward centroid to handle boundary cases.
 */
function pointInPolygon(weight, cg, points) {
  const n = points.length;
  if (n < 3) return false;

  let centW = 0, centC = 0;
  for (const pt of points) { centW += pt.weight; centC += pt.cg; }
  centW /= n; centC /= n;

  const EPS = 0.05;
  const dw = centW - weight;
  const dc = centC - cg;
  const len = Math.sqrt(dw * dw + dc * dc);
  const testW = len > 0 ? weight + (dw / len) * EPS : weight;
  const testC = len > 0 ? cg + (dc / len) * EPS : cg;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const wi = points[i].weight, ci = points[i].cg;
    const wj = points[j].weight, cj = points[j].cg;

    if ((wi > testW) !== (wj > testW) &&
        testC < ((cj - ci) * (testW - wi)) / (wj - wi) + ci) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check baggage constraints — convert limits to display weight unit.
 */
function checkBaggageConstraints(constraints, stationWeights, profileWU, displayWU) {
  if (!constraints || constraints.length === 0) return [];

  return constraints
    .map((c) => {
      const combined = c.stationIds.reduce(
        (sum, id) => sum + (stationWeights[id] || 0),
        0,
      );
      const maxConverted = convertWeight(c.maxCombinedWeight.value, c.maxCombinedWeight.unit || profileWU, displayWU);
      if (combined > maxConverted) {
        return {
          description: c.description,
          combined: Math.round(combined * 10) / 10,
          max: Math.round(maxConverted * 10) / 10,
          unit: displayWU,
        };
      }
      return null;
    })
    .filter(Boolean);
}
