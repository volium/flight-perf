import { initTabs } from './ui/tabs.js';
import { initSettings } from './ui/settings.js';
import { initDensityAltitude } from './ui/density-altitude.js';
import { initCrosswind } from './ui/crosswind.js';
import { initTakeoff } from './ui/takeoff.js';
import { initLanding } from './ui/landing.js';
import { initClimb } from './ui/climb.js';
import { initCruise } from './ui/cruise.js';
import { initWeightBalance } from './ui/weight-balance.js';
import { loadProfile } from './data/profile-loader.js';
import { storage } from './data/storage.js';

const DEFAULT_PROFILE_URL = 'profiles/sling-lsa.json';

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
    const profileUrl = storage.get('profileUrl', DEFAULT_PROFILE_URL);
    state.profile = await loadProfile(profileUrl);
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

function initCalculators() {
  initTakeoff(document.getElementById('panel-takeoff'));
  initLanding(document.getElementById('panel-landing'));
  initClimb(document.getElementById('panel-climb'));
  initCruise(document.getElementById('panel-cruise'));
  initWeightBalance(document.getElementById('panel-wb'));
  initDensityAltitude(document.getElementById('panel-density'));
  initCrosswind(document.getElementById('panel-crosswind'));
}

function updateAircraftDisplay(profile) {
  const el = document.getElementById('aircraft-name');
  if (!el) return;

  if (profile) {
    const tail = profile.aircraft.tailNumber || '';
    const name = profile.aircraft.name || '';
    el.textContent = tail ? `${tail} — ${name}` : name;
  } else {
    el.textContent = 'No aircraft loaded';
  }
}

function updateOnlineStatus() {
  const dot = document.querySelector('.offline-indicator__dot');
  const label = document.querySelector('.offline-indicator__label');
  if (!dot || !label) return;

  const swReady = 'serviceWorker' in navigator;
  if (swReady) {
    dot.classList.remove('offline-indicator__dot--offline');
    label.textContent = 'Offline Ready';
  } else {
    dot.classList.add('offline-indicator__dot--offline');
    label.textContent = 'Online Only';
  }
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
