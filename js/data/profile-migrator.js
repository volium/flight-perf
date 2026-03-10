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

  // 8. Build instance (if tailNumber was present)
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
 * Uses crypto.randomUUID() when available, otherwise falls back to a
 * timestamp-based ID.
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
