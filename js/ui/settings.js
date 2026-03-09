import { storage } from '../data/storage.js';
import { getUnits, setUnit, convertValue } from '../data/unit-preferences.js';
import { initCalculators } from '../app.js';

const UNIT_FIELDS = ['altitude', 'altimeter', 'temperature', 'distance', 'weight', 'fuel'];

export function initSettings(triggerBtn, overlayEl, panelEl) {
  const closeBtn = panelEl.querySelector('.settings-panel__close');

  function open() {
    loadUnitValues(panelEl);
    overlayEl.setAttribute('aria-hidden', 'false');
    panelEl.querySelector('select, input, button')?.focus();
  }

  function close() {
    overlayEl.setAttribute('aria-hidden', 'true');
    triggerBtn.focus();
  }

  triggerBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) close();
  });

  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'Escape' &&
      overlayEl.getAttribute('aria-hidden') === 'false'
    ) {
      close();
    }
  });

  initThemeToggle(panelEl);
  initUnitToggles(panelEl);
  initResetButton(panelEl);

  return { open, close };
}

function initThemeToggle(panelEl) {
  const select = panelEl.querySelector('#setting-theme');
  if (!select) return;

  const saved = storage.get('theme', 'auto');
  select.value = saved;
  applyTheme(saved);

  select.addEventListener('change', () => {
    const value = select.value;
    storage.set('theme', value);
    applyTheme(value);
  });
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function loadUnitValues(panelEl) {
  const units = getUnits();
  for (const field of UNIT_FIELDS) {
    const el = panelEl.querySelector(`#setting-${field}`);
    if (el) el.value = units[field];
  }
}

function initUnitToggles(panelEl) {
  for (const field of UNIT_FIELDS) {
    const el = panelEl.querySelector(`#setting-${field}`);
    if (!el) continue;

    el.addEventListener('change', () => {
      const oldUnits = getUnits();
      const oldUnit = oldUnits[field];
      const newUnit = el.value;

      setUnit(field, newUnit);
      convertSavedInputs(field, oldUnit, newUnit);
      initCalculators();
    });
  }
}

/**
 * Convert saved numeric values in localStorage when a unit preference changes.
 */
function convertSavedInputs(unitType, fromUnit, toUnit) {
  if (fromUnit === toUnit) return;

  const conversions = UNIT_FIELD_MAP[unitType];
  if (!conversions) return;

  for (const { storageKey, fields } of conversions) {
    const saved = storage.get(storageKey);
    if (!saved) continue;

    let changed = false;
    for (const field of fields) {
      if (saved[field] != null && saved[field] !== '') {
        const converted = convertValue(saved[field], fromUnit, toUnit, unitType);
        if (converted !== saved[field]) {
          saved[field] = converted;
          changed = true;
        }
      }
    }

    if (changed) {
      storage.set(storageKey, saved);
    }
  }
}

/**
 * Maps each unit type to calculator localStorage keys and field names
 * that store values in that unit.
 */
const UNIT_FIELD_MAP = {
  altitude: [
    { storageKey: 'density_inputs', fields: ['fieldElevation'] },
    { storageKey: 'climb_inputs', fields: ['departureElevation', 'targetAltitude', 'transitionAltitude'] },
    { storageKey: 'cruise_inputs', fields: ['altitude'] },
    { storageKey: 'fuel_inputs', fields: ['cruiseAltitude'] },
  ],
  altimeter: [
    { storageKey: 'density_inputs', fields: ['altimeter'] },
    { storageKey: 'climb_inputs', fields: ['altimeter'] },
    { storageKey: 'cruise_inputs', fields: ['altimeter'] },
    { storageKey: 'fuel_inputs', fields: ['altimeter'] },
  ],
  temperature: [
    { storageKey: 'density_inputs', fields: ['oat'] },
  ],
  distance: [],
  weight: [
    { storageKey: 'wb_inputs', fields: ['pilot', 'passenger', 'baggage_front', 'baggage_rear'] },
  ],
  fuel: [
    { storageKey: 'wb_inputs', fields: ['_fuel'] },
    { storageKey: 'fuel_inputs', fields: ['fuelOnBoard'] },
  ],
};

/**
 * Calculator input storage keys to clear on reset.
 * Settings (theme, global_units, profileUrl) are preserved.
 */
const INPUT_STORAGE_KEYS = [
  'density_inputs',
  'takeoff_inputs',
  'landing_inputs',
  'climb_inputs',
  'cruise_inputs',
  'wb_inputs',
  'crosswind_inputs',
  'fuel_inputs',
];

function initResetButton(panelEl) {
  const btn = panelEl.querySelector('#setting-reset');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!confirm('Clear all saved calculator inputs? Unit preferences and theme will be kept.')) return;

    for (const key of INPUT_STORAGE_KEYS) {
      storage.remove(key);
    }

    initCalculators();
  });
}
