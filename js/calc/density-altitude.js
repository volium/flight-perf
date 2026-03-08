import { convert } from '../engine/units.js';

/**
 * Calculate pressure altitude from field elevation and altimeter setting.
 *
 * @param {number} fieldElevation  – Field elevation in feet
 * @param {number} altimeter       – Altimeter setting in inHg
 * @returns {number} Pressure altitude in feet
 */
export function pressureAltitude(fieldElevation, altimeter) {
  return fieldElevation + (29.92 - altimeter) * 1000;
}

/**
 * ISA standard temperature at a given pressure altitude.
 *
 * @param {number} pressAlt – Pressure altitude in feet
 * @returns {number} ISA temperature in °C
 */
export function isaTemperature(pressAlt) {
  return 15 - 2 * (pressAlt / 1000);
}

/**
 * Calculate density altitude from pressure altitude and OAT.
 *
 * @param {number} pressAlt – Pressure altitude in feet
 * @param {number} oatC     – Outside air temperature in °C
 * @returns {number} Density altitude in feet
 */
export function densityAltitude(pressAlt, oatC) {
  const isa = isaTemperature(pressAlt);
  return pressAlt + 120 * (oatC - isa);
}

/**
 * ISA temperature deviation at a given pressure altitude.
 *
 * @param {number} pressAlt – Pressure altitude in feet
 * @param {number} oatC     – Outside air temperature in °C
 * @returns {number} Deviation from ISA in °C (positive = warmer than standard)
 */
export function isaDeviation(pressAlt, oatC) {
  return oatC - isaTemperature(pressAlt);
}

/**
 * Approximate relative air density ratio (σ = ρ/ρ₀).
 * Uses the density altitude to estimate the ratio compared to sea level ISA.
 *
 * @param {number} densAlt – Density altitude in feet
 * @returns {number} Density ratio (1.0 at sea level ISA)
 */
export function densityRatio(densAlt) {
  return Math.pow(1 - 0.0000068756 * densAlt, 4.2559);
}

/**
 * Full density altitude calculation from raw user inputs.
 * Accepts temperature in either °C or °F, pressure in inHg or hPa,
 * and field elevation in ft or m.
 *
 * @param {object} inputs
 * @param {number} inputs.fieldElevation – field elevation value
 * @param {string} inputs.elevUnit       – "ft" or "m"
 * @param {number} inputs.altimeter      – altimeter setting (in inHg or hPa)
 * @param {string} inputs.altimeterUnit  – "inHg" or "hPa"
 * @param {number} inputs.oat            – outside air temperature
 * @param {string} inputs.tempUnit       – "C" or "F"
 * @returns {object} results
 */
export function calculateDensityAltitude(inputs) {
  const { fieldElevation, elevUnit, altimeter, altimeterUnit, oat, tempUnit } = inputs;

  const fieldElevFt =
    elevUnit === 'm' ? convert.mToFt(fieldElevation) : fieldElevation;
  const altInHg =
    altimeterUnit === 'hPa' ? convert.hPaToInHg(altimeter) : altimeter;
  const oatC = tempUnit === 'F' ? convert.fToC(oat) : oat;

  const pressAlt = pressureAltitude(fieldElevFt, altInHg);
  const isa = isaTemperature(pressAlt);
  const deviation = oatC - isa;
  const densAlt = densityAltitude(pressAlt, oatC);
  const ratio = densityRatio(densAlt);

  return {
    pressureAltitude: Math.round(pressAlt),
    densityAltitude: Math.round(densAlt),
    isaTemperature: Math.round(isa * 10) / 10,
    isaDeviation: Math.round(deviation * 10) / 10,
    densityRatio: Math.round(ratio * 10000) / 10000,
    oatC: Math.round(oatC * 10) / 10,
    oatF: Math.round(convert.cToF(oatC) * 10) / 10,
    altimeterInHg: Math.round(altInHg * 100) / 100,
    altimeterHPa: Math.round(convert.inHgToHPa(altInHg) * 10) / 10,
  };
}
