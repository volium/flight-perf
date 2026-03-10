/**
 * Profile merger — combines a v2 type profile with an aircraft instance
 * to produce a runtime profile compatible with the existing calc layer.
 *
 * The merged profile has the same shape that calc modules expect from a v1
 * profile, so zero changes are needed in any calc/ or ui/ module.
 *
 * @module data/profile-merger
 */

/**
 * Merge a type profile with an aircraft instance to produce a runtime profile.
 *
 * @param {object} typeProfile — v2 type profile (or v1 for backwards compat)
 * @param {object} [instance]  — aircraft instance (optional — if null, type
 *        defaults are used with no tail number)
 * @returns {object} Merged runtime profile consumable by calc modules
 */
export function mergeProfile(typeProfile, instance) {
  if (!typeProfile) throw new Error('mergeProfile: typeProfile is required');

  const merged = structuredClone(typeProfile);

  // 1. Set tail number from instance
  if (!merged.aircraft) merged.aircraft = {};
  merged.aircraft.tailNumber = instance?.registration ?? null;

  // 2. Resolve effective empty weight
  //    Priority: instance override → type referenceEmptyWeight → type emptyWeight (v1)
  const effectiveEmptyWeight = resolveEmptyWeight(typeProfile, instance);
  if (!merged.limits) merged.limits = {};
  merged.limits.emptyWeight = effectiveEmptyWeight;

  // 3. Resolve effective empty CG
  //    Priority: instance override → type referenceEmptyCG → type weightBalance.emptyCG (v1)
  const effectiveEmptyCG = resolveEmptyCG(typeProfile, instance);
  if (merged.weightBalance) {
    merged.weightBalance.emptyCG = effectiveEmptyCG;
  }

  // 4. Compute useful load
  if (merged.limits.maxTakeoffWeight && effectiveEmptyWeight) {
    const mtow = merged.limits.maxTakeoffWeight.value;
    const ew = effectiveEmptyWeight.value;
    merged.limits.usefulLoad = {
      value: Math.round((mtow - ew) * 10) / 10,
      unit: merged.limits.maxTakeoffWeight.unit,
    };
  }

  // 5. Attach instance metadata for UI display
  merged._instance = instance
    ? {
      instanceId: instance.instanceId,
      registration: instance.registration,
      displayName: instance.displayName || instance.registration,
      notes: instance.notes || null,
      lastWeighed: instance.lastWeighed || null,
    }
    : null;

  return merged;
}

/**
 * Resolve the effective empty weight.
 *
 * @param {object} type
 * @param {object} [instance]
 * @returns {object|null} ValueWithUnit { value, unit }
 */
function resolveEmptyWeight(type, instance) {
  // Instance override takes priority
  if (instance?.emptyWeight?.value != null) {
    return instance.emptyWeight;
  }

  // v2: limits.referenceEmptyWeight
  if (type.limits?.referenceEmptyWeight?.value != null) {
    return type.limits.referenceEmptyWeight;
  }

  // v1 fallback: limits.emptyWeight
  if (type.limits?.emptyWeight?.value != null) {
    return type.limits.emptyWeight;
  }

  return null;
}

/**
 * Resolve the effective empty CG.
 *
 * @param {object} type
 * @param {object} [instance]
 * @returns {object|null} CG object — format depends on cgReference system
 */
function resolveEmptyCG(type, instance) {
  // Instance override takes priority
  if (instance?.emptyCG != null) {
    return instance.emptyCG;
  }

  // v2: limits.referenceEmptyCG
  if (type.limits?.referenceEmptyCG != null) {
    return type.limits.referenceEmptyCG;
  }

  // v1 fallback: weightBalance.emptyCG
  if (type.weightBalance?.emptyCG != null) {
    return type.weightBalance.emptyCG;
  }

  return null;
}
