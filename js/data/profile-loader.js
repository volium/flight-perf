/**
 * Profile loader — handles seeding bundled types into IndexedDB,
 * resolving the active aircraft profile, and legacy URL-based loading.
 *
 * @module data/profile-loader
 */

import { openDB, getType, getAllTypes, putType, getInstance, getAllInstances, putInstance } from './db.js';
import { validateTypeProfile } from './profile-validator.js';
import { mergeProfile } from './profile-merger.js';
import { storage } from './storage.js';

/** Registry of bundled type profiles shipped with the app. */
const BUNDLED_TYPE_URLS = [
  { typeId: 'sling-lsa', url: 'profiles/types/sling-lsa.json' },
  // { typeId: 'cessna-172s', url: 'profiles/types/cessna-172s.json' },
];

// ─── Seeding ────────────────────────────────────────────────────────────────

/**
 * Seed bundled type profiles into IndexedDB.
 * Seeds new types and updates existing ones when the bundled version
 * has a newer dataVersion than what's stored in IDB.
 * Called once on app startup.
 */
export async function seedBundledTypes() {
  await openDB();
  for (const { typeId, url } of BUNDLED_TYPE_URLS) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch bundled profile ${url}: ${response.status}`);
        continue;
      }
      const profile = await response.json();
      profile.typeId = profile.typeId || profile.aircraft?.id || typeId;
      profile.source = 'bundled';

      const existing = await getType(typeId);
      if (existing && existing.dataVersion >= (profile.dataVersion || 0)) {
        continue; // already up to date
      }

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
 * Returns null if no active aircraft is set — the app should prompt
 * the user to add one via the fleet panel.
 *
 * @returns {Promise<object|null>} Merged runtime profile, or null
 */
export async function resolveActiveProfile() {
  const activeId = storage.get('activeAircraftId', null);

  // Try to load the active instance
  if (activeId) {
    const profile = await resolveProfile(activeId);
    if (profile) return profile;
    // Active ID references a deleted instance — clear it
    storage.remove('activeAircraftId');
  }

  // No aircraft configured — return null (fleet panel will prompt user)
  return null;
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
