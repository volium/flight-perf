import { interpolateFromTable, interpolate2D } from '../engine/interpolation.js';
import { pressureAltitude, densityAltitude, isaTemperature, densityRatio } from './density-altitude.js';
import { convert } from '../engine/units.js';
import { getFuelType } from '../data/fuel-types.js';

/**
 * Fuel planning calculation.
 *
 * Given trip distance, cruise settings, and fuel on board, computes
 * trip fuel, time en route, fuel remaining, and reserve status.
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs
 * @param {number} inputs.tripDistance     – Trip distance in NM
 * @param {number} inputs.cruiseAltitude   – Cruise field elevation in ft
 * @param {number} inputs.altimeter        – Altimeter setting in inHg
 * @param {number} inputs.rpm              – Cruise RPM
 * @param {number} inputs.fuelOnBoard      – Fuel on board in profile input units
 * @param {number} inputs.reserveMinutes   – Reserve fuel time in minutes
 * @returns {object} Fuel plan results
 */
export function calculateFuelPlan(profile, inputs) {
  const fuel = profile?.performance?.fuelConsumption;
  if (!fuel) return { error: 'No fuel consumption data in this profile.' };

  const fuelConfig = profile.fuel;
  const { tripDistance, cruiseAltitude, altimeter, rpm, fuelOnBoard, reserveMinutes } = inputs;

  // Fuel flow at selected RPM (reference altitude)
  const refLph = interpolateFromTable(fuel.data, 'rpm', 'fuelFlowLph', rpm);
  const refGph = interpolateFromTable(fuel.data, 'rpm', 'fuelFlowGph', rpm);

  // Density ratio correction for cruise altitude
  const pa = Math.round(pressureAltitude(cruiseAltitude, altimeter));
  const refAlt = fuel.referenceConditions?.altitude?.value ?? 3000;
  const sigmaRef = densityRatio(densityAltitude(refAlt, isaTemperature(refAlt)));
  const sigmaCruise = densityRatio(densityAltitude(pa, isaTemperature(pa)));
  const correction = sigmaCruise / sigmaRef;

  const flowLph = refLph.value * correction;
  const flowGph = refGph.value * correction;

  // Cruise TAS — try 2D interpolation from cruise table first
  let tasKt = 0;
  const cruise = profile?.performance?.cruise;
  if (cruise?.data) {
    const ktasResult = interpolate2D(
      cruise.data, 'pressureAltitude', 'rpm', 'ktas', pa, rpm,
    );
    tasKt = ktasResult.value;
  }

  // Fallback: use airspeed from fuel table
  if (!tasKt || isNaN(tasKt)) {
    const asResult = interpolateFromTable(fuel.data, 'rpm', 'airspeed', rpm);
    tasKt = asResult.value;
  }

  // Time en route
  const timeEnRouteHrs = tasKt > 0 ? tripDistance / tasKt : 0;
  const timeEnRouteMin = timeEnRouteHrs * 60;

  // Trip fuel
  const tripFuelL = flowLph * timeEnRouteHrs;
  const tripFuelGal = flowGph * timeEnRouteHrs;

  // Reserve fuel
  const reserveHrs = reserveMinutes / 60;
  const reserveFuelL = flowLph * reserveHrs;
  const reserveFuelGal = flowGph * reserveHrs;

  // Total fuel required
  const totalRequiredL = tripFuelL + reserveFuelL;
  const totalRequiredGal = tripFuelGal + reserveFuelGal;

  // Fuel on board in litres (total in tanks)
  const fobL = fuelToLitres(fuelOnBoard, fuelConfig);
  const fobGal = fobL * 0.264172;

  // Unusable fuel
  const unusableL = getUnusableFuelL(fuelConfig);
  const usableFobL = Math.max(0, fobL - unusableL);
  const usableFobGal = usableFobL * 0.264172;

  // Fuel remaining after trip (based on usable fuel)
  const remainingL = usableFobL - tripFuelL;
  const remainingGal = usableFobGal - tripFuelGal;

  // Endurance with usable fuel on board
  const enduranceHrs = flowLph > 0 ? usableFobL / flowLph : 0;
  const enduranceAfterTripHrs = flowLph > 0 ? Math.max(0, remainingL) / flowLph : 0;

  // Range with usable fuel on board
  const rangeNm = tasKt > 0 ? tasKt * enduranceHrs : 0;

  const sufficient = remainingL >= reserveFuelL;

  // RPM range
  const rpmValues = [...new Set(fuel.data.map((d) => d.rpm))].sort((a, b) => a - b);

  return {
    pressureAltitude: pa,
    rpm,
    tasKt: Math.round(tasKt),
    flowLph: Math.round(flowLph * 10) / 10,
    flowGph: Math.round(flowGph * 10) / 10,
    densityCorrected: Math.abs(correction - 1.0) > 0.005,

    tripDistance,
    timeEnRouteMin: Math.round(timeEnRouteMin * 10) / 10,
    tripFuelL: Math.round(tripFuelL * 10) / 10,
    tripFuelGal: Math.round(tripFuelGal * 10) / 10,

    reserveMinutes,
    reserveFuelL: Math.round(reserveFuelL * 10) / 10,
    reserveFuelGal: Math.round(reserveFuelGal * 10) / 10,

    totalRequiredL: Math.round(totalRequiredL * 10) / 10,
    totalRequiredGal: Math.round(totalRequiredGal * 10) / 10,

    fobL: Math.round(fobL * 10) / 10,
    fobGal: Math.round(fobGal * 10) / 10,
    unusableL: Math.round(unusableL * 10) / 10,
    usableFobL: Math.round(usableFobL * 10) / 10,
    usableFobGal: Math.round(usableFobGal * 10) / 10,

    remainingL: Math.round(remainingL * 10) / 10,
    remainingGal: Math.round(remainingGal * 10) / 10,

    enduranceMin: Math.round(enduranceHrs * 60),
    enduranceAfterTripMin: Math.round(enduranceAfterTripHrs * 60),
    rangeNm: Math.round(rangeNm),

    sufficient,
    fuelInputUnit: fuelConfig?.inputUnit || 'L',
    rpmRange: { min: rpmValues[0], max: rpmValues[rpmValues.length - 1] },
  };
}

function fuelToLitres(quantity, fuelConfig) {
  if (!quantity || isNaN(quantity) || quantity <= 0) return 0;
  const inputUnit = fuelConfig?.inputUnit || 'L';
  const fuelType = getFuelType(fuelConfig?.type || '100LL');

  switch (inputUnit) {
    case 'L':
      return quantity;
    case 'us_gal':
      return quantity * 3.785411784;
    case 'kg':
      return fuelType ? quantity / fuelType.densityKgPerL : quantity / 0.721;
    case 'lbs':
      return fuelType ? convert.lbsToKg(quantity) / fuelType.densityKgPerL : convert.lbsToKg(quantity) / 0.721;
    default:
      return quantity;
  }
}

function getUnusableFuelL(fuelConfig) {
  if (!fuelConfig?.capacity || !fuelConfig?.usableCapacity) return 0;
  const totalL = fuelConfig.capacity.unit === 'L'
    ? fuelConfig.capacity.value
    : fuelConfig.capacity.value * 3.785411784;
  const usableL = fuelConfig.usableCapacity.unit === 'L'
    ? fuelConfig.usableCapacity.value
    : fuelConfig.usableCapacity.value * 3.785411784;
  return Math.max(0, totalL - usableL);
}
