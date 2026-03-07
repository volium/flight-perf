const REQUIRED_FIELDS = [
  'profileVersion',
  'aircraft',
  'aircraft.id',
  'aircraft.name',
  'limits',
  'limits.maxTakeoffWeight',
  'limits.emptyWeight',
];

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
}

function validateProfile(profile) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (getNestedValue(profile, field) == null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (profile.profileVersion && profile.profileVersion !== '1.0') {
    errors.push(
      `Unsupported profile version: ${profile.profileVersion} (expected 1.0)`,
    );
  }

  return { valid: errors.length === 0, errors };
}

export async function loadProfile(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load profile: ${response.status} ${response.statusText}`);
  }

  const profile = await response.json();
  const validation = validateProfile(profile);

  if (!validation.valid) {
    throw new Error(
      `Invalid profile:\n${validation.errors.join('\n')}`,
    );
  }

  return profile;
}

export function loadProfileFromJSON(json) {
  let profile;
  if (typeof json === 'string') {
    profile = JSON.parse(json);
  } else {
    profile = json;
  }

  const validation = validateProfile(profile);
  if (!validation.valid) {
    throw new Error(
      `Invalid profile:\n${validation.errors.join('\n')}`,
    );
  }

  return profile;
}

export { validateProfile };
