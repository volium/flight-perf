const KG_PER_LB = 0.45359237;
const LB_PER_KG = 2.20462262;
const M_PER_FT = 0.3048;
const FT_PER_M = 3.28084;
const L_PER_US_GAL = 3.785411784;
const US_GAL_PER_L = 0.264172052;
const KM_PER_NM = 1.852;
const NM_PER_KM = 0.539957;
const MM_PER_IN = 25.4;
const IN_PER_MM = 1 / 25.4;
const KMH_PER_KT = 1.852;
const KT_PER_KMH = 0.539957;

export const convert = {
  // Weight
  kgToLbs: (kg) => kg * LB_PER_KG,
  lbsToKg: (lbs) => lbs * KG_PER_LB,

  // Distance
  mToFt: (m) => m * FT_PER_M,
  ftToM: (ft) => ft * M_PER_FT,
  mmToIn: (mm) => mm * IN_PER_MM,
  inToMm: (inches) => inches * MM_PER_IN,

  // Volume
  lToUSGal: (l) => l * US_GAL_PER_L,
  usGalToL: (gal) => gal * L_PER_US_GAL,

  // Speed
  ktToKmh: (kt) => kt * KMH_PER_KT,
  kmhToKt: (kmh) => kmh * KT_PER_KMH,

  // Distance (navigation)
  nmToKm: (nm) => nm * KM_PER_NM,
  kmToNm: (km) => km * NM_PER_KM,

  // Temperature
  cToF: (c) => (c * 9) / 5 + 32,
  fToC: (f) => ((f - 32) * 5) / 9,

  // Pressure
  inHgToHPa: (inHg) => inHg * 33.86389,
  hPaToInHg: (hPa) => hPa / 33.86389,
};

export function formatNumber(value, decimals = 0) {
  if (value == null || isNaN(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
