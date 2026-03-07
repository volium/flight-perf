const FUEL_TYPES = {
  '100LL': {
    id: '100LL',
    name: '100LL Avgas',
    densityKgPerL: 0.721,
    densityLbsPerGal: 6.02,
  },
  '91UL': {
    id: '91UL',
    name: '91 UL Avgas',
    densityKgPerL: 0.715,
    densityLbsPerGal: 5.97,
  },
  '94UL': {
    id: '94UL',
    name: '94 UL Avgas',
    densityKgPerL: 0.715,
    densityLbsPerGal: 5.97,
  },
  MOGAS: {
    id: 'MOGAS',
    name: 'Motor Gasoline (Auto Fuel)',
    densityKgPerL: 0.74,
    densityLbsPerGal: 6.18,
  },
  JET_A: {
    id: 'JET_A',
    name: 'Jet-A / Jet-A1',
    densityKgPerL: 0.804,
    densityLbsPerGal: 6.71,
  },
  DIESEL: {
    id: 'DIESEL',
    name: 'Diesel / Jet Fuel (piston)',
    densityKgPerL: 0.84,
    densityLbsPerGal: 7.01,
  },
};

export function getFuelType(typeId) {
  return FUEL_TYPES[typeId] || null;
}

export function getAllFuelTypes() {
  return Object.values(FUEL_TYPES);
}

export function fuelVolumeToWeight(volume, unit, fuelTypeId, overrideDensity) {
  const fuel = getFuelType(fuelTypeId);
  if (!fuel && !overrideDensity) return null;

  switch (unit) {
    case 'L': {
      const density = overrideDensity?.kgPerL ?? fuel.densityKgPerL;
      return { value: volume * density, unit: 'kg' };
    }
    case 'us_gal': {
      const density = overrideDensity?.lbsPerGal ?? fuel.densityLbsPerGal;
      return { value: volume * density, unit: 'lbs' };
    }
    case 'kg':
      return { value: volume, unit: 'kg' };
    case 'lbs':
      return { value: volume, unit: 'lbs' };
    default:
      return null;
  }
}
