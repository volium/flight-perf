import { initTabs } from './ui/tabs.js';
import { initSettings } from './ui/settings.js';
import { initFleet, refreshFleetSelector } from './ui/fleet.js';
import { initDensityAltitude } from './ui/density-altitude.js';
import { initCrosswind } from './ui/crosswind.js';
import { initTakeoff } from './ui/takeoff.js';
import { initLanding } from './ui/landing.js';
import { initClimb } from './ui/climb.js';
import { initCruise } from './ui/cruise.js';
import { initWeightBalance } from './ui/weight-balance.js';
import { initFuel } from './ui/fuel.js';
import { initAirport } from './ui/airport.js';
import { preload as preloadAirports } from './data/ourairports.js';
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

  const settingsApi = initSettings(
    document.getElementById('btn-settings'),
    document.getElementById('settings-overlay'),
    document.getElementById('settings-panel'),
  );

  try {
    await seedBundledTypes();
    state.profile = await resolveActiveProfile();
  } catch (err) {
    console.error('Failed to load aircraft profile:', err);
  }

  const fleetApi = await initFleet(
    document.getElementById('fleet-selector'),
    document.getElementById('fleet-overlay'),
    document.getElementById('fleet-panel'),
  );

  // "Manage Fleet" button in settings opens fleet panel
  const openFleetBtn = document.getElementById('setting-open-fleet');
  if (openFleetBtn) {
    openFleetBtn.addEventListener('click', () => {
      settingsApi?.close();
      fleetApi.open(() => settingsApi?.open());
    });
  }

  initCalculators();
  initAirport(document.getElementById('panel-airport'));

  // First run — no aircraft configured: open fleet panel automatically
  if (!state.profile) {
    fleetApi.open();
  }

  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  registerServiceWorker();

  // Preload OurAirports CSV data in the background (fire-and-forget)
  if (navigator.onLine) preloadAirports();
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
  await refreshFleetSelector();
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
