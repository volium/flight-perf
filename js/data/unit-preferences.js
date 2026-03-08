import { storage } from './storage.js';
import { convert } from '../engine/units.js';

const STORAGE_KEY = 'global_units';

const DEFAULTS = {
  altitude: 'ft',
  altimeter: 'inHg',
  temperature: 'C',
  distance: 'ft',
  weight: 'kg',
  fuel: 'us_gal',
};

/**
 * Get global unit preferences.
 */
export function getUnits() {
  return { ...DEFAULTS, ...storage.get(STORAGE_KEY, DEFAULTS) };
}

/**
 * Set a single unit preference.
 */
export function setUnit(key, value) {
  const units = getUnits();
  units[key] = value;
  storage.set(STORAGE_KEY, units);
}

/**
 * Convert a numeric value when a unit preference changes.
 *
 * @param {number|string} value – Current input value
 * @param {string} fromUnit    – Old unit
 * @param {string} toUnit      – New unit
 * @param {string} type        – "altitude", "distance", "altimeter", "temperature", "weight", "fuel"
 * @returns {string} Converted value as string, or '' if empty/invalid
 */
export function convertValue(value, fromUnit, toUnit, type) {
  if (value === '' || value == null) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  if (fromUnit === toUnit) return value;

  let converted;

  switch (type) {
    case 'altitude':
    case 'distance':
      if (fromUnit === 'ft' && toUnit === 'm') converted = convert.ftToM(num);
      else if (fromUnit === 'm' && toUnit === 'ft') converted = convert.mToFt(num);
      else return value;
      return String(Math.round(converted));

    case 'altimeter':
      if (fromUnit === 'inHg' && toUnit === 'hPa') converted = convert.inHgToHPa(num);
      else if (fromUnit === 'hPa' && toUnit === 'inHg') converted = convert.hPaToInHg(num);
      else return value;
      return toUnit === 'inHg'
        ? String(Math.round(converted * 100) / 100)
        : String(Math.round(converted));

    case 'temperature':
      if (fromUnit === 'C' && toUnit === 'F') converted = convert.cToF(num);
      else if (fromUnit === 'F' && toUnit === 'C') converted = convert.fToC(num);
      else return value;
      return String(Math.round(converted));

    case 'weight':
      if (fromUnit === 'kg' && toUnit === 'lbs') converted = convert.kgToLbs(num);
      else if (fromUnit === 'lbs' && toUnit === 'kg') converted = convert.lbsToKg(num);
      else return value;
      return String(Math.round(converted));

    case 'fuel':
      if (fromUnit === 'us_gal' && toUnit === 'L') converted = convert.usGalToL(num);
      else if (fromUnit === 'L' && toUnit === 'us_gal') converted = convert.lToUSGal(num);
      else return value;
      return String(Math.round(converted * 10) / 10);

    default:
      return value;
  }
}

/**
 * Placeholder helpers based on unit.
 */
export function altitudePlaceholder(unit) {
  return unit === 'm' ? 'e.g. 1500' : 'e.g. 5000';
}

export function elevationPlaceholder(unit) {
  return unit === 'm' ? 'e.g. 365' : 'e.g. 1200';
}

export function altimeterPlaceholder(unit) {
  return unit === 'hPa' ? '1013' : '29.92';
}

export function altimeterDefault(unit) {
  return unit === 'hPa' ? '1013' : '29.92';
}

export function fuelUnitLabel(unit) {
  switch (unit) {
    case 'us_gal': return 'US gal';
    case 'L': return 'L';
    case 'kg': return 'kg';
    case 'lbs': return 'lbs';
    default: return unit;
  }
}
