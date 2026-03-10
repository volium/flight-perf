import { initTabs } from './ui/tabs.js';
import { initSettings } from './ui/settings.js';
import { initDensityAltitude } from './ui/density-altitude.js';
import { initCrosswind } from './ui/crosswind.js';
import { initTakeoff } from './ui/takeoff.js';
import { initLanding } from './ui/landing.js';
import { initClimb } from './ui/climb.js';
import { initCruise } from './ui/cruise.js';
import { initWeightBalance } from './ui/weight-balance.js';
import { initFuel } from './ui/fuel.js';
import { seedBundledTypes, resolveActiveProfile, resolveProfile } from './data/profile-loader.js';
import { storage } from './data/storage.js';

const state = {
  profile: null,
};

async function init() {
  initTabs(
    document.getElementById('tab-bar'),
    document.getElementById('tab-panels'),
  );

  initSettings(
    document.getElementById('btn-settings'),
    document.getElementById('settings-overlay'),
    document.getElementById('settings-panel'),
  );

  try {
    await seedBundledTypes();
    state.profile = await resolveActiveProfile();
    updateAircraftDisplay(state.profile);
  } catch (err) {
    console.error('Failed to load aircraft profile:', err);
    updateAircraftDisplay(null);
  }

  initCalculators();

  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  registerServiceWorker();
}

export function initCalculators() {
  initTakeoff(document.getElementById('panel-takeoff'));
  initLanding(document.getElementById('panel-landing'));
  initClimb(document.getElementById('panel-climb'));
  initCruise(document.getElementById('panel-cruise'));
  initWeightBalance(document.getElementById('panel-wb'));
  initDensityAltitude(document.getElementById('panel-density'));
  initCrosswind(document.getElementById('panel-crosswind'));
  initFuel(document.getElementById('panel-fuel'));
}

function updateAircraftDisplay(profile) {
  const el = document.getElementById('aircraft-name');
  if (!el) return;

  if (profile) {
    const tail = profile.aircraft?.tailNumber || profile._instance?.registration || '';
    const name = profile.aircraft?.name || '';
    el.textContent = tail ? `${tail} — ${name}` : name;
  } else {
    el.textContent = 'No aircraft loaded';
  }
}

/**
 * Switch the active aircraft to a different instance.
 * Loads the instance + type from IDB, merges, updates state, and re-inits calculators.
 *
 * @param {string} instanceId
 * @returns {Promise<boolean>} true if switch succeeded
 */
export async function setActiveAircraft(instanceId) {
  const profile = await resolveProfile(instanceId);
  if (!profile) return false;

  state.profile = profile;
  storage.set('activeAircraftId', instanceId);
  updateAircraftDisplay(profile);
  initCalculators();
  return true;
}

async function updateOnlineStatus() {
  const dot = document.querySelector('.offline-indicator__dot');
  const label = document.querySelector('.offline-indicator__label');
  if (!dot || !label) return;

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.active) {
      dot.classList.remove('offline-indicator__dot--offline');
      label.textContent = 'Offline Ready';
      return;
    }
  }

  dot.classList.add('offline-indicator__dot--offline');
  label.textContent = 'Online Only';
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch (err) {
    console.warn('Service worker registration failed:', err);
  }
}

export function getProfile() {
  return state.profile;
}

document.addEventListener('DOMContentLoaded', init);
