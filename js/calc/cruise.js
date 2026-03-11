import { interpolate2D, interpolateFromTable } from '../engine/interpolation.js';
import { pressureAltitude, densityAltitude, densityRatio, isaTemperature } from './density-altitude.js';
import { convert } from '../engine/units.js';

/**
 * Perform cruise performance calculation from profile data.
 *
 * Interpolates cruise speed (KIAS, KTAS) from the 2D altitude × RPM table,
 * and looks up fuel consumption from the 1D RPM table.
 *
 * @param {object} profile – Full aircraft profile
 * @param {object} inputs
 * @param {number} inputs.fieldElevation – Field elevation in ft
 * @param {number} inputs.altimeter      – Altimeter setting in inHg
 * @param {number} inputs.rpm            – Engine RPM
 * @returns {object} Calculation results
 */
export function calculateCruise(profile, inputs) {
  const cruise = profile?.performance?.cruise;
  if (!cruise) {
    return { error: 'No cruise performance data in this profile.' };
  }

  const fuel = profile?.performance?.fuelConsumption;
  const { fieldElevation, altimeter, rpm } = inputs;

  const pa = Math.round(pressureAltitude(fieldElevation, altimeter));

  // 2D interpolation: altitude × RPM → KIAS, KTAS
  const kias = interpolate2D(
    cruise.data, 'pressureAltitude', 'rpm', 'kias', pa, rpm,
  );
  const ktas = interpolate2D(
    cruise.data, 'pressureAltitude', 'rpm', 'ktas', pa, rpm,
  );

  // Fuel consumption: 1D interpolation by RPM, corrected for altitude
  let fuelFlow = null;
  let fuelDensityCorrected = false;
  if (fuel && fuel.data) {
    const refLph = interpolateFromTable(fuel.data, 'rpm', 'fuelFlowLph', rpm);
    const refGph = interpolateFromTable(fuel.data, 'rpm', 'fuelFlowGph', rpm);

    // Density ratio correction: adjust reference fuel flow for cruise altitude
    // adjusted_flow = ref_flow × (σ_cruise / σ_reference)
    const refAlt = fuel.referenceConditions?.altitude?.value ?? 3000;
    const isaRef = isaTemperature(refAlt);
    const isaPA = isaTemperature(pa);
    const daRef = densityAltitude(refAlt, isaRef); // ISA at reference altitude
    const daCruise = densityAltitude(pa, isaPA);    // ISA at cruise altitude (conservative)
    const sigmaRef = densityRatio(daRef);
    const sigmaCruise = densityRatio(daCruise);
    const correction = sigmaCruise / sigmaRef;

    fuelDensityCorrected = Math.abs(correction - 1.0) > 0.005;

    fuelFlow = {
      lph: Math.round(refLph.value * correction * 10) / 10,
      gph: Math.round(refGph.value * correction * 10) / 10,
      refLph: Math.round(refLph.value * 10) / 10,
      refGph: Math.round(refGph.value * 10) / 10,
      densityCorrected: fuelDensityCorrected,
      correctionFactor: Math.round(correction * 1000) / 1000,
    };
  }

  // Endurance & range based on usable fuel
  let endurance = null;
  let range = null;
  const usableCap = profile?.fuel?.usableCapacity || profile?.fuel?.capacity;

  if (fuelFlow && usableCap) {
    const usableLitres = usableCap.unit === 'L'
      ? usableCap.value
      : convert.usGalToL(usableCap.value);

    if (fuelFlow.lph > 0) {
      const hours = usableLitres / fuelFlow.lph;
      endurance = { hours: Math.floor(hours), minutes: Math.round((hours % 1) * 60) };

      if (ktas.value > 0) {
        range = Math.round(ktas.value * hours);
      }
    }
  }

  // RPM range from data
  const rpmValues = [...new Set(cruise.data.map((d) => d.rpm))].sort((a, b) => a - b);
  const altValues = [...new Set(cruise.data.map((d) => d.pressureAltitude))].sort((a, b) => a - b);

  return {
    pressureAltitude: pa,
    rpm,
    kias: Math.round(kias.value),
    ktas: Math.round(ktas.value),
    clamped: kias.clamped || ktas.clamped,
    fuelFlow,
    endurance,
    range,
    fuelReferenceConditions: fuel?.referenceConditions || null,
    cruiseDescription: cruise.description || '',
    rpmRange: { min: rpmValues[0], max: rpmValues[rpmValues.length - 1] },
    altRange: { min: altValues[0], max: altValues[altValues.length - 1] },
  };
}
