/**
 * Profile loader — handles seeding bundled types into IndexedDB,
 * resolving the active aircraft profile, and legacy URL-based loading.
 *
 * @module data/profile-loader
 */

import { openDB, getType, getAllTypes, putType, getInstance, getAllInstances, putInstance } from './db.js';
import { validateTypeProfile } from './profile-validator.js';
import { mergeProfile } from './profile-merger.js';
import { migrateV1toV2, isV1Profile } from './profile-migrator.js';
import { storage } from './storage.js';

/** Registry of bundled type profiles shipped with the app. */
const BUNDLED_TYPE_URLS = [
  { typeId: 'sling-lsa', url: 'profiles/types/sling-lsa.json' },
  // { typeId: 'cessna-172s', url: 'profiles/types/cessna-172s.json' },
];

// ─── Seeding ────────────────────────────────────────────────────────────────

/**
 * Seed bundled type profiles into IndexedDB.
 * Idempotent — skips types that already exist in the store.
 * Called once on app startup.
 */
export async function seedBundledTypes() {
  await openDB();
  for (const { typeId, url } of BUNDLED_TYPE_URLS) {
    const existing = await getType(typeId);
    if (existing) continue;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch bundled profile ${url}: ${response.status}`);
        continue;
      }
      const profile = await response.json();
      profile.typeId = profile.typeId || profile.aircraft?.id || typeId;
      profile.source = 'bundled';
      await putType(profile);
    } catch (err) {
      console.warn(`Failed to seed bundled type ${typeId}:`, err);
    }
  }
}

/**
 * Seed type profiles from pre-loaded objects (for testing or manual import).
 *
 * @param {object[]} profiles — array of type profile objects
 */
export async function seedTypesFromData(profiles) {
  await openDB();
  for (const profile of profiles) {
    const typeId = profile.typeId || profile.aircraft?.id;
    if (!typeId) continue;
    profile.typeId = typeId;
    await putType(profile);
  }
}

// ─── Profile resolution ─────────────────────────────────────────────────────

/**
 * Resolve a full runtime profile for a given aircraft instance.
 * Loads the instance and its type from IDB, then merges them.
 *
 * @param {string} instanceId
 * @returns {Promise<object|null>} Merged runtime profile, or null if not found
 */
export async function resolveProfile(instanceId) {
  const instance = await getInstance(instanceId);
  if (!instance) return null;

  const type = await getType(instance.typeId);
  if (!type) return null;

  return mergeProfile(type, instance);
}

/**
 * Resolve a runtime profile using the first available bundled type
 * with no instance (type defaults only). Used as a fallback when
 * no fleet exists yet.
 *
 * @returns {Promise<object|null>}
 */
export async function resolveDefaultProfile() {
  const types = await getAllTypes();
  if (types.length === 0) return null;

  const bundled = types.find((t) => t.source === 'bundled') || types[0];
  return mergeProfile(bundled, null);
}

/**
 * Resolve the active aircraft profile.
 * Reads activeAircraftId from localStorage, loads from IDB, merges.
 * If no active aircraft is set or it can't be found, falls back to
 * auto-creating a default instance.
 *
 * @returns {Promise<object>} Merged runtime profile
 */
export async function resolveActiveProfile() {
  const activeId = storage.get('activeAircraftId', null);

  // Try to load the active instance
  if (activeId) {
    const profile = await resolveProfile(activeId);
    if (profile) return profile;
  }

  // No active instance — check if we need to auto-migrate from v1
  const oldProfileUrl = storage.get('profileUrl', null);
  if (oldProfileUrl) {
    const profile = await migrateFromV1Url(oldProfileUrl);
    if (profile) return profile;
  }

  // No v1 data either — auto-create default instance from first bundled type
  const instance = await autoCreateDefaultInstance();
  if (instance) {
    const profile = await resolveProfile(instance.instanceId);
    if (profile) return profile;
  }

  // Last resort — type defaults with no instance
  return resolveDefaultProfile();
}

// ─── Auto-creation ──────────────────────────────────────────────────────────

/**
 * Auto-create a default aircraft instance from the first bundled type.
 * Sets it as the active aircraft.
 *
 * @param {string} [typeId] — specific type to use. If omitted, uses first bundled type.
 * @returns {Promise<object|null>} The created instance, or null if no types exist
 */
export async function autoCreateDefaultInstance(typeId) {
  let type;
  if (typeId) {
    type = await getType(typeId);
  } else {
    const types = await getAllTypes();
    type = types.find((t) => t.source === 'bundled') || types[0];
  }
  if (!type) return null;

  const id = generateId();
  const ew = type.limits?.referenceEmptyWeight || type.limits?.emptyWeight || null;
  const cg = type.limits?.referenceEmptyCG || null;

  const instance = {
    instanceId: id,
    typeId: type.typeId,
    registration: '',
    displayName: type.aircraft?.name || type.typeId,
    emptyWeight: ew ? { ...ew } : null,
    emptyCG: cg ? { ...cg } : null,
    notes: 'Auto-created default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await putInstance(instance);
  storage.set('activeAircraftId', id);
  return instance;
}

// ─── v1 migration ───────────────────────────────────────────────────────────

/**
 * Attempt to migrate a v1 profile from a URL.
 * Fetches the profile, migrates to v2, stores type + instance in IDB,
 * sets the instance as active, and removes the old profileUrl setting.
 *
 * @param {string} url
 * @returns {Promise<object|null>} Merged runtime profile, or null on failure
 */
async function migrateFromV1Url(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const v1Profile = await response.json();
    if (!isV1Profile(v1Profile)) return null;

    const { type, instance } = migrateV1toV2(v1Profile, { source: 'bundled' });

    // Store type if not already present (may have been seeded)
    const existingType = await getType(type.typeId);
    if (!existingType) {
      await putType(type);
    }

    // Store instance and set active
    if (instance) {
      await putInstance(instance);
      storage.set('activeAircraftId', instance.instanceId);
      storage.remove('profileUrl');
      return mergeProfile(existingType || type, instance);
    }

    return null;
  } catch (err) {
    console.warn('v1 migration failed:', err);
    return null;
  }
}

// ─── Legacy API (kept for backwards compatibility) ──────────────────────────

/**
 * Load a profile from a URL. Supports both v1 and v2 formats.
 * @deprecated Use resolveActiveProfile() instead.
 */
export async function loadProfile(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load profile: ${response.status} ${response.statusText}`);
  }

  const profile = await response.json();

  // v2 profiles: validate with new validator
  if (profile.schemaVersion === '2.0') {
    const validation = validateTypeProfile(profile);
    if (!validation.valid) {
      throw new Error(`Invalid v2 profile:\n${validation.errors.map((e) => e.message).join('\n')}`);
    }
    return profile;
  }

  // v1 profiles: basic validation
  const validation = validateProfileLegacy(profile);
  if (!validation.valid) {
    throw new Error(`Invalid profile:\n${validation.errors.join('\n')}`);
  }
  return profile;
}

/** @deprecated Use profile-validator.js validateTypeProfile() instead. */
export function validateProfile(profile) {
  if (profile?.schemaVersion === '2.0') {
    const result = validateTypeProfile(profile);
    return { valid: result.valid, errors: result.errors.map((e) => e.message) };
  }
  return validateProfileLegacy(profile);
}

function validateProfileLegacy(profile) {
  const errors = [];
  const required = ['profileVersion', 'aircraft', 'limits'];
  for (const field of required) {
    if (!profile?.[field]) errors.push(`Missing required field: ${field}`);
  }
  if (!profile?.aircraft?.id) errors.push('Missing required field: aircraft.id');
  if (!profile?.aircraft?.name) errors.push('Missing required field: aircraft.name');
  return { valid: errors.length === 0, errors };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
