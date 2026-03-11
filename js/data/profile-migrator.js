/**
 * Profile migrator — converts v1 profiles to v2 type + instance.
 *
 * When the app encounters a v1 profile (profileVersion: "1.0"),
 * this module splits it into a v2 type profile and an aircraft instance.
 *
 * @module data/profile-migrator
 */

/**
 * Migrate a v1 profile to v2 format.
 *
 * @param {object} v1Profile — a v1 profile (profileVersion: "1.0")
 * @param {object} [options]
 * @param {string} [options.source="custom"] — "bundled" or "custom"
 * @returns {{ type: object, instance: object | null }}
 *          instance is null if the v1 profile had no tailNumber
 */
export function migrateV1toV2(v1Profile, options = {}) {
  if (!v1Profile || typeof v1Profile !== 'object') {
    throw new Error('migrateV1toV2: profile is required');
  }

  const source = options.source || 'custom';
  const type = structuredClone(v1Profile);

  // 1. Schema version
  delete type.profileVersion;
  type.schemaVersion = '2.0';

  // 2. Source
  type.source = source;

  // 3. Set typeId from aircraft.id
  type.typeId = type.aircraft?.id || 'unknown';

  // 4. Extract tailNumber → instance
  const tailNumber = type.aircraft?.tailNumber || null;
  if (type.aircraft) {
    delete type.aircraft.tailNumber;
  }

  // 5. Rename limits.emptyWeight → limits.referenceEmptyWeight
  if (type.limits?.emptyWeight && !type.limits.referenceEmptyWeight) {
    type.limits.referenceEmptyWeight = type.limits.emptyWeight;
    delete type.limits.emptyWeight;
  }

  // 6. Remove limits.usefulLoad (computed at runtime by merger)
  if (type.limits) {
    delete type.limits.usefulLoad;
  }

  // 7. Move weightBalance.emptyCG → limits.referenceEmptyCG
  if (type.weightBalance?.emptyCG && !type.limits?.referenceEmptyCG) {
    if (!type.limits) type.limits = {};
    type.limits.referenceEmptyCG = type.weightBalance.emptyCG;
    delete type.weightBalance.emptyCG;
  }

  // 8. Convert performance data from ValueWithUnit to plain numbers + units
  if (type.performance) {
    for (const section of ['takeoff', 'landing', 'climb', 'cruise', 'fuelConsumption']) {
      if (type.performance[section]?.method === 'table_interpolation' && Array.isArray(type.performance[section].data)) {
        convertPerfDataToPlainNumbers(type.performance[section]);
      }
    }
  }

  // 9. Build instance (if tailNumber was present)
  let instance = null;
  if (tailNumber) {
    instance = {
      instanceId: generateId(),
      typeId: type.typeId,
      registration: tailNumber,
      displayName: tailNumber,
      emptyWeight: type.limits?.referenceEmptyWeight
        ? { ...type.limits.referenceEmptyWeight }
        : null,
      emptyCG: type.limits?.referenceEmptyCG
        ? { ...type.limits.referenceEmptyCG }
        : null,
      notes: 'Migrated from v1 profile',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return { type, instance };
}

/**
 * Detect whether a profile is v1 format.
 *
 * @param {object} profile
 * @returns {boolean}
 */
export function isV1Profile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return profile.profileVersion === '1.0' && !profile.schemaVersion;
}

/**
 * Detect whether a profile is v2 format.
 *
 * @param {object} profile
 * @returns {boolean}
 */
export function isV2Profile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return profile.schemaVersion === '2.0';
}

/**
 * Generate a simple unique ID.
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert a v1 table_interpolation data section from ValueWithUnit objects
 * to plain numbers, and add a `units` declaration.
 *
 * Scans the first data point to detect ValueWithUnit fields ({ value, unit }),
 * extracts units, then converts all data points to plain numbers.
 * Also flattens endurance objects ({ hours, minutes }) to enduranceHours/enduranceMinutes.
 */
function convertPerfDataToPlainNumbers(section) {
  const data = section.data;
  if (!data || data.length === 0) return;

  const units = {};
  const firstRow = data[0];

  // Detect ValueWithUnit fields and special objects from first row
  for (const [key, val] of Object.entries(firstRow)) {
    if (val != null && typeof val === 'object' && 'value' in val && 'unit' in val) {
      units[key] = val.unit;
    }
  }

  // Check for endurance { hours, minutes } pattern
  const hasEndurance = firstRow.endurance && typeof firstRow.endurance === 'object' && 'hours' in firstRow.endurance;

  // Convert all data points
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const converted = {};

    for (const [key, val] of Object.entries(row)) {
      if (key === 'endurance' && hasEndurance) {
        converted.enduranceHours = val?.hours ?? 0;
        converted.enduranceMinutes = val?.minutes ?? 0;
      } else if (val != null && typeof val === 'object' && 'value' in val) {
        converted[key] = val.value;
      } else {
        converted[key] = val;
      }
    }

    data[i] = converted;
  }

  // Add units declaration
  if (hasEndurance) {
    units.enduranceHours = 'hr';
    units.enduranceMinutes = 'min';
  }

  if (Object.keys(units).length > 0) {
    section.units = units;
  }
}
