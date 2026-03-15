import { storage } from '../data/storage.js';
import { getUnits, setUnit, convertValue } from '../data/unit-preferences.js';
import { initCalculators, setActiveAircraft } from '../app.js';
import {
  signIn, signOut, backup, restore,
  getLastBackupTime, getStoredEmail, restoreSession, hasBackup,
} from '../data/gdrive.js';

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
  initGoogleDrive(panelEl);

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

// ─── Google Drive Backup ────────────────────────────────────────────────────

function initGoogleDrive(panelEl) {
  const disconnectedEl = panelEl.querySelector('#gdrive-disconnected');
  const connectedEl = panelEl.querySelector('#gdrive-connected');
  const connectBtn = panelEl.querySelector('#gdrive-connect');
  const backupBtn = panelEl.querySelector('#gdrive-backup');
  const restoreBtn = panelEl.querySelector('#gdrive-restore');
  const disconnectBtn = panelEl.querySelector('#gdrive-disconnect');
  const emailEl = panelEl.querySelector('#gdrive-email');
  const backupTimeEl = panelEl.querySelector('#gdrive-backup-time');
  const feedbackEl = panelEl.querySelector('#gdrive-feedback');

  if (!disconnectedEl || !connectedEl) return;

  // Restore session from sessionStorage (survives page refresh)
  restoreSession().then((result) => {
    if (result) {
      showConnected(result.email);
      updateBackupTime();
    } else {
      // No active session — check for stored email hint
      getStoredEmail().then((email) => {
        if (email) {
          const hint = disconnectedEl.querySelector('.form-hint');
          if (hint) hint.textContent = `Previously connected as ${email}. Connect to back up again.`;
        }
      });
    }
  });

  // Show last backup time if available
  updateBackupTime();

  function showConnected(email) {
    disconnectedEl.style.display = 'none';
    connectedEl.style.display = '';
    emailEl.textContent = email || '';
    clearFeedback();
  }

  function showDisconnected() {
    disconnectedEl.style.display = '';
    connectedEl.style.display = 'none';
    clearFeedback();
  }

  function showFeedback(message, type) {
    feedbackEl.textContent = message;
    feedbackEl.className = `gdrive-feedback gdrive-feedback--${type}`;
  }

  function clearFeedback() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'gdrive-feedback';
  }

  function updateBackupTime() {
    getLastBackupTime().then((time) => {
      if (time) {
        const date = new Date(time);
        backupTimeEl.textContent = `Last backup: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      } else {
        backupTimeEl.textContent = 'No backup yet';
      }
    });
  }

  function setLoading(btn, loading, label) {
    btn.disabled = loading;
    btn.textContent = loading ? `${label}\u2026` : label;
  }

  // Connect
  connectBtn?.addEventListener('click', async () => {
    try {
      setLoading(connectBtn, true, 'Connecting');
      const { email } = await signIn();
      showConnected(email);
      updateBackupTime();

      // Check if a backup exists and offer to restore
      const backupExists = await hasBackup();
      if (backupExists) {
        if (confirm('A backup was found on Google Drive. Would you like to restore it now?')) {
          restoreBtn?.click();
        }
      }
    } catch (err) {
      console.warn('Google Drive sign-in failed:', err);
      showFeedback('Connection failed. Please try again.', 'error');
    } finally {
      setLoading(connectBtn, false, 'Connect Google Drive');
    }
  });

  // Backup
  backupBtn?.addEventListener('click', async () => {
    try {
      setLoading(backupBtn, true, 'Backing up');
      await backup();
      showFeedback('Backup complete!', 'success');
      updateBackupTime();
    } catch (err) {
      console.warn('Backup failed:', err);
      showFeedback(`Backup failed: ${err.message}`, 'error');
    } finally {
      setLoading(backupBtn, false, 'Backup Now');
    }
  });

  // Restore
  restoreBtn?.addEventListener('click', async () => {
    if (!confirm('Restore will overwrite your current fleet, custom aircraft types, and preferences with the backup data. Continue?')) {
      return;
    }

    try {
      setLoading(restoreBtn, true, 'Restoring');
      const result = await restore();

      // Apply restored theme
      const restoredTheme = storage.get('theme', 'auto');
      const themeSelect = panelEl.querySelector('#setting-theme');
      if (themeSelect) themeSelect.value = restoredTheme;
      applyTheme(restoredTheme);

      // Reload unit selectors
      loadUnitValues(panelEl);

      // Re-resolve active profile from restored data and refresh fleet selector
      const restoredId = storage.get('activeAircraftId');
      if (restoredId) {
        await setActiveAircraft(restoredId);
      } else {
        initCalculators();
      }

      showFeedback(
        `Restored ${result.fleet} aircraft and ${result.customTypes} custom type${result.customTypes !== 1 ? 's' : ''}.`,
        'success',
      );
      updateBackupTime();
    } catch (err) {
      console.warn('Restore failed:', err);
      showFeedback(`Restore failed: ${err.message}`, 'error');
    } finally {
      setLoading(restoreBtn, false, 'Restore from Backup');
    }
  });

  // Disconnect
  disconnectBtn?.addEventListener('click', async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    showDisconnected();
  });
}
