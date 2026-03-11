/**
 * Profile validator for v2 type profiles.
 *
 * Programmatic validation (no JSON Schema library — zero-dep constraint).
 * Returns errors (block import/save) and warnings (informational).
 *
 * @module data/profile-validator
 */

const VALID_AIRCRAFT_TYPES = [
  'single-engine-land', 'single-engine-sea',
  'multi-engine-land', 'multi-engine-sea',
  'glider', 'rotorcraft',
];

const VALID_CATEGORIES = [
  'normal', 'utility', 'acrobatic', 'light-sport', 'experimental', 'primary',
];

const VALID_FUEL_TYPES = ['100LL', '91UL', '94UL', 'MOGAS', 'JET_A', 'DIESEL', 'CUSTOM'];

const VALID_FUEL_INPUT_UNITS = ['L', 'us_gal', 'kg', 'lbs'];

const VALID_CG_REFERENCES = ['arm', 'percent_mac'];

const VALID_PERF_METHODS = ['reference_table', 'table_interpolation'];

/**
 * Validate a v2 type profile.
 *
 * @param {object} profile — the profile object to validate
 * @returns {{ valid: boolean, errors: ValidationIssue[], warnings: ValidationIssue[] }}
 */
export function validateTypeProfile(profile) {
  const errors = [];
  const warnings = [];

  if (!profile || typeof profile !== 'object') {
    errors.push(issue('', 'Profile must be a non-null object', 'structure'));
    return result(errors, warnings);
  }

  validateSchemaVersion(profile, errors);
  validateAircraft(profile.aircraft, errors, warnings);
  validateLimits(profile.limits, errors, warnings);
  validateFuel(profile.fuel, profile.limits, errors, warnings);
  validateSpeeds(profile.speeds, errors, warnings);
  validateWeightBalance(profile.weightBalance, profile.limits, errors, warnings);
  validatePerformance(profile.performance, errors, warnings);

  return result(errors, warnings);
}

/**
 * Validate an aircraft instance.
 *
 * @param {object} instance
 * @returns {{ valid: boolean, errors: ValidationIssue[], warnings: ValidationIssue[] }}
 */
export function validateInstance(instance) {
  const errors = [];
  const warnings = [];

  if (!instance || typeof instance !== 'object') {
    errors.push(issue('', 'Instance must be a non-null object', 'structure'));
    return result(errors, warnings);
  }

  requireString(instance, 'instanceId', 'instance', errors);
  requireString(instance, 'typeId', 'instance', errors);
  requireString(instance, 'registration', 'instance', errors);

  if (instance.emptyWeight != null) {
    validateValueWithUnit(instance.emptyWeight, 'instance.emptyWeight', errors);
  }

  return result(errors, warnings);
}

// ─── Section validators ─────────────────────────────────────────────────────

function validateSchemaVersion(profile, errors) {
  if (profile.schemaVersion == null && profile.profileVersion == null) {
    errors.push(issue('schemaVersion', 'Missing schemaVersion field', 'structure'));
  } else if (profile.schemaVersion && profile.schemaVersion !== '1.0') {
    errors.push(issue('schemaVersion', `Expected "1.0", got "${profile.schemaVersion}"`, 'structure'));
  }
}

function validateAircraft(aircraft, errors, warnings) {
  if (!aircraft || typeof aircraft !== 'object') {
    errors.push(issue('aircraft', 'Missing required section: aircraft', 'structure'));
    return;
  }

  requireString(aircraft, 'id', 'aircraft', errors);
  requireString(aircraft, 'name', 'aircraft', errors);
  requireString(aircraft, 'manufacturer', 'aircraft', errors);

  if (aircraft.type && !VALID_AIRCRAFT_TYPES.includes(aircraft.type)) {
    warnings.push(issue('aircraft.type', `Unknown aircraft type: "${aircraft.type}". Valid: ${VALID_AIRCRAFT_TYPES.join(', ')}`, 'enum'));
  }

  if (aircraft.category && !VALID_CATEGORIES.includes(aircraft.category)) {
    warnings.push(issue('aircraft.category', `Unknown category: "${aircraft.category}". Valid: ${VALID_CATEGORIES.join(', ')}`, 'enum'));
  }
}

function validateLimits(limits, errors, warnings) {
  if (!limits || typeof limits !== 'object') {
    errors.push(issue('limits', 'Missing required section: limits', 'structure'));
    return;
  }

  validateValueWithUnit(limits.maxTakeoffWeight, 'limits.maxTakeoffWeight', errors);
  validateValueWithUnit(limits.maxLandingWeight, 'limits.maxLandingWeight', errors);

  // Accept either v2 referenceEmptyWeight or v1 emptyWeight
  const emptyWeight = limits.referenceEmptyWeight || limits.emptyWeight;
  if (!emptyWeight) {
    errors.push(issue('limits.referenceEmptyWeight', 'Missing required field: referenceEmptyWeight (or emptyWeight)', 'structure'));
  } else {
    validateValueWithUnit(emptyWeight, 'limits.referenceEmptyWeight', errors);
  }

  // Accept either v2 referenceEmptyCG or v1-style emptyCG (may be in weightBalance)
  // This is not an error if missing — the instance or weightBalance.emptyCG may provide it

  // Physics checks
  const mtow = numVal(limits.maxTakeoffWeight);
  const ew = numVal(emptyWeight);
  if (mtow > 0 && ew > 0 && mtow <= ew) {
    errors.push(issue('limits', `maxTakeoffWeight (${mtow}) must be greater than referenceEmptyWeight (${ew})`, 'physics'));
  }

  const mlw = numVal(limits.maxLandingWeight);
  if (mlw > 0 && mtow > 0 && mlw > mtow) {
    warnings.push(issue('limits', `maxLandingWeight (${mlw}) exceeds maxTakeoffWeight (${mtow})`, 'physics'));
  }
}

function validateFuel(fuel, limits, errors, warnings) {
  if (!fuel || typeof fuel !== 'object') {
    errors.push(issue('fuel', 'Missing required section: fuel', 'structure'));
    return;
  }

  if (fuel.type && !VALID_FUEL_TYPES.includes(fuel.type)) {
    warnings.push(issue('fuel.type', `Unknown fuel type: "${fuel.type}". Valid: ${VALID_FUEL_TYPES.join(', ')}`, 'enum'));
  }

  if (fuel.inputUnit && !VALID_FUEL_INPUT_UNITS.includes(fuel.inputUnit)) {
    errors.push(issue('fuel.inputUnit', `Invalid inputUnit: "${fuel.inputUnit}". Valid: ${VALID_FUEL_INPUT_UNITS.join(', ')}`, 'enum'));
  }

  validateValueWithUnit(fuel.capacity, 'fuel.capacity', errors);

  if (fuel.usableCapacity) {
    validateValueWithUnit(fuel.usableCapacity, 'fuel.usableCapacity', errors);
    const cap = numVal(fuel.capacity);
    const usable = numVal(fuel.usableCapacity);
    if (cap > 0 && usable > 0 && usable > cap) {
      errors.push(issue('fuel', `usableCapacity (${usable}) exceeds capacity (${cap})`, 'physics'));
    }
  }

  // Tank capacity sum check
  if (fuel.tanks && Array.isArray(fuel.tanks) && fuel.tanks.length > 0) {
    const totalCap = numVal(fuel.capacity);
    const tankSum = fuel.tanks.reduce((sum, t) => sum + numVal(t?.capacity), 0);
    if (totalCap > 0 && tankSum > 0 && Math.abs(tankSum - totalCap) > 0.5) {
      warnings.push(issue('fuel.tanks', `Tank capacities sum to ${tankSum}, but total capacity is ${totalCap}`, 'consistency'));
    }
  }
}

function validateSpeeds(speeds, errors, warnings) {
  if (!speeds || typeof speeds !== 'object') {
    errors.push(issue('speeds', 'Missing required section: speeds', 'structure'));
    return;
  }

  if (!speeds.vne) {
    errors.push(issue('speeds.vne', 'Missing required speed: vne (never exceed)', 'structure'));
  }
  if (!speeds.vs0) {
    errors.push(issue('speeds.vs0', 'Missing required speed: vs0 (stall, landing config)', 'structure'));
  }

  const vne = numVal(speeds.vne);
  const vs0 = numVal(speeds.vs0);
  if (vne > 0 && vs0 > 0 && vs0 >= vne) {
    errors.push(issue('speeds', `vs0 (${vs0}) must be less than vne (${vne})`, 'physics'));
  }

  // Cross-check optional speeds
  const vy = numVal(speeds.vy);
  if (vy > 0 && vs0 > 0 && vy <= vs0) {
    warnings.push(issue('speeds', `vy (${vy}) should be greater than vs0 (${vs0})`, 'physics'));
  }

  const vno = numVal(speeds.vno);
  if (vno > 0 && vne > 0 && vno >= vne) {
    warnings.push(issue('speeds', `vno (${vno}) should be less than vne (${vne})`, 'physics'));
  }
}

function validateWeightBalance(wb, limits, errors, warnings) {
  if (!wb) return; // optional section

  if (!VALID_CG_REFERENCES.includes(wb.cgReference)) {
    errors.push(issue('weightBalance.cgReference', `Invalid cgReference: "${wb.cgReference}". Valid: ${VALID_CG_REFERENCES.join(', ')}`, 'enum'));
  }

  if (wb.cgReference === 'percent_mac') {
    if (!wb.macLeadingEdge) {
      errors.push(issue('weightBalance.macLeadingEdge', 'Required when cgReference is "percent_mac"', 'structure'));
    }
    if (!wb.macLength) {
      errors.push(issue('weightBalance.macLength', 'Required when cgReference is "percent_mac"', 'structure'));
    }
  }

  // Stations
  if (!Array.isArray(wb.stations) || wb.stations.length === 0) {
    errors.push(issue('weightBalance.stations', 'Must have at least one station', 'structure'));
  } else {
    const ids = new Set();
    let fuelStationCount = 0;

    for (let i = 0; i < wb.stations.length; i++) {
      const s = wb.stations[i];
      const path = `weightBalance.stations[${i}]`;

      if (!s.id) errors.push(issue(path, 'Station missing id', 'structure'));
      if (!s.name) errors.push(issue(path, 'Station missing name', 'structure'));
      if (!s.arm) errors.push(issue(path, 'Station missing arm', 'structure'));

      if (s.id && ids.has(s.id)) {
        errors.push(issue(path, `Duplicate station id: "${s.id}"`, 'structure'));
      }
      ids.add(s.id);

      if (s.fuelStation) fuelStationCount++;
    }

    if (fuelStationCount === 0) {
      warnings.push(issue('weightBalance.stations', 'No station marked as fuelStation — fuel weight will not be included in W&B', 'completeness'));
    }
    if (fuelStationCount > 1) {
      warnings.push(issue('weightBalance.stations', `${fuelStationCount} stations marked as fuelStation — only one expected`, 'completeness'));
    }
  }

  // Envelopes
  if (!Array.isArray(wb.envelopes) || wb.envelopes.length === 0) {
    errors.push(issue('weightBalance.envelopes', 'Must have at least one envelope', 'structure'));
  } else {
    for (let i = 0; i < wb.envelopes.length; i++) {
      const env = wb.envelopes[i];
      const path = `weightBalance.envelopes[${i}]`;

      if (!env.id) errors.push(issue(path, 'Envelope missing id', 'structure'));
      if (!env.name) errors.push(issue(path, 'Envelope missing name', 'structure'));

      if (!Array.isArray(env.points) || env.points.length < 3) {
        errors.push(issue(`${path}.points`, 'Envelope must have at least 3 points to form a polygon', 'structure'));
      }
    }
  }

  // Baggage constraints — validate referenced station IDs exist
  if (Array.isArray(wb.baggageConstraints) && Array.isArray(wb.stations)) {
    const stationIds = new Set(wb.stations.map((s) => s.id));
    for (let i = 0; i < wb.baggageConstraints.length; i++) {
      const c = wb.baggageConstraints[i];
      if (Array.isArray(c.stationIds)) {
        for (const sid of c.stationIds) {
          if (!stationIds.has(sid)) {
            warnings.push(issue(`weightBalance.baggageConstraints[${i}]`, `References unknown station id: "${sid}"`, 'reference'));
          }
        }
      }
    }
  }
}

function validatePerformance(performance, errors, warnings) {
  if (!performance) {
    warnings.push(issue('performance', 'No performance sections defined — calculators will have limited functionality', 'completeness'));
    return;
  }

  const sections = ['takeoff', 'landing', 'climb', 'cruise', 'fuelConsumption'];
  let hasSections = false;

  for (const section of sections) {
    if (performance[section]) {
      hasSections = true;
      validatePerfSection(performance[section], `performance.${section}`, errors, warnings);
    }
  }

  if (!hasSections) {
    warnings.push(issue('performance', 'No performance sub-sections defined — calculators will have limited functionality', 'completeness'));
  }
}

function validatePerfSection(section, path, errors, warnings) {
  if (!section.method) {
    errors.push(issue(`${path}.method`, 'Missing required field: method', 'structure'));
    return;
  }

  if (!VALID_PERF_METHODS.includes(section.method)) {
    errors.push(issue(`${path}.method`, `Unknown method: "${section.method}". Valid: ${VALID_PERF_METHODS.join(', ')}`, 'enum'));
  }

  if (section.method === 'table_interpolation' && (!section.units || typeof section.units !== 'object')) {
    errors.push(issue(`${path}.units`, 'Missing required units declaration for table_interpolation section', 'structure'));
  }

  if (!Array.isArray(section.data) || section.data.length === 0) {
    errors.push(issue(`${path}.data`, 'Missing or empty data array', 'structure'));
    return;
  }

  if (section.method === 'table_interpolation' && section.data.length < 2) {
    errors.push(issue(`${path}.data`, 'table_interpolation requires at least 2 data points', 'structure'));
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function issue(path, message, rule) {
  return { path, message, rule };
}

function result(errors, warnings) {
  return { valid: errors.length === 0, errors, warnings };
}

function requireString(obj, field, path, errors) {
  if (!obj[field] || typeof obj[field] !== 'string' || obj[field].trim() === '') {
    errors.push(issue(`${path}.${field}`, `Missing or empty required string: ${field}`, 'structure'));
  }
}

function validateValueWithUnit(val, path, errors) {
  if (!val || typeof val !== 'object') {
    errors.push(issue(path, `Missing required ValueWithUnit: ${path}`, 'structure'));
    return;
  }
  if (typeof val.value !== 'number' || isNaN(val.value)) {
    errors.push(issue(`${path}.value`, 'Must be a number', 'type'));
  }
  if (!val.unit || typeof val.unit !== 'string') {
    errors.push(issue(`${path}.unit`, 'Must be a non-empty string', 'type'));
  }
}

function numVal(obj) {
  if (!obj) return 0;
  if (typeof obj === 'number') return obj;
  if (typeof obj === 'object' && typeof obj.value === 'number') return obj.value;
  return 0;
}
