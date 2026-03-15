/**
 * Google Drive backup/restore module for flight-perf.
 *
 * Uses Google Identity Services (GIS) for OAuth 2.0 and the Google Drive
 * REST API v3 to store a single backup file in the user's hidden
 * appDataFolder. No gapi client library required — plain fetch() calls.
 *
 * All auth state is session-only (not persisted). The user's email and
 * last backup timestamp are stored in IndexedDB syncMeta for display hints
 * across page reloads.
 *
 * @module data/gdrive
 */

import {
  getAllInstances, getAllTypes, putType, putInstance,
  getSyncMeta, putSyncMeta, deleteSyncMeta,
} from './db.js';
import { storage } from './storage.js';

// ─── Configuration ──────────────────────────────────────────────────────────

const CLIENT_ID = '805086512023-71vdhgur3kgeu3ovl1v0jogc77dk5gtn.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'flight-perf-backup.json';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_VERSION = 1;

// ─── Module state (session-only, not persisted) ─────────────────────────────

const SESSION_KEY = 'flightperf_gdrive_token';

let tokenClient = null;
let accessToken = null;
let userEmail = null;
let gisLoadPromise = null;

// ─── GIS Script Loading ─────────────────────────────────────────────────────

/**
 * Lazy-load the Google Identity Services script.
 * Inserts a <script> tag once; subsequent calls return the same promise.
 *
 * @returns {Promise<void>}
 */
export function loadGIS() {
  if (gisLoadPromise) return gisLoadPromise;

  // Already loaded (e.g., stubbed in tests)
  if (typeof google !== 'undefined' && google.accounts?.oauth2) {
    gisLoadPromise = Promise.resolve();
    return gisLoadPromise;
  }

  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null; // allow retry
      reject(new Error('Failed to load Google Identity Services'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

/**
 * Trigger OAuth sign-in via GIS token client.
 * Loads GIS if needed, creates the token client, and opens the consent popup.
 * Fetches the user's email after receiving the access token.
 *
 * @returns {Promise<{ email: string }>}
 */
export async function signIn() {
  await loadGIS();

  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }

        accessToken = response.access_token;

        try {
          const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (info.ok) {
            const data = await info.json();
            userEmail = data.email || null;
          }
        } catch {
          // Non-fatal — email is just a display hint
          userEmail = null;
        }

        // Persist email for display on page reload (not a security token)
        if (userEmail) {
          await putSyncMeta('gdriveEmail', userEmail).catch(() => {});
        }

        // Persist token to sessionStorage (survives refresh, clears on tab close)
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            access_token: accessToken,
            email: userEmail,
          }));
        } catch { /* sessionStorage unavailable */ }

        resolve({ email: userEmail });
      },
      error_callback: (err) => {
        reject(new Error(err.message || 'Sign-in was cancelled'));
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Restore session from sessionStorage after page refresh.
 * Validates the token is still alive with a lightweight API call.
 *
 * @returns {Promise<{ email: string }|null>} Result on success, null if no session or token expired.
 */
export async function restoreSession() {
  let saved;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    saved = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!saved?.access_token) return null;

  // Validate token is still alive
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${saved.access_token}` },
    });
    if (!response.ok) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    const data = await response.json();
    accessToken = saved.access_token;
    userEmail = data.email || saved.email || null;
    return { email: userEmail };
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/**
 * Check if a backup file exists on Google Drive.
 *
 * @returns {Promise<boolean>}
 */
export async function hasBackup() {
  if (!isSignedIn()) return false;

  try {
    const response = await driveFetch(
      `${DRIVE_API}/files?spaces=appDataFolder` +
      `&q=name='${BACKUP_FILENAME}'` +
      `&fields=files(id)` +
      `&pageSize=1`,
    );
    const result = await response.json();
    return result.files?.length > 0;
  } catch {
    return false;
  }
}

/**
 * Sign out: revoke the access token and clear all module + syncMeta state.
 */
export async function signOut() {
  if (accessToken) {
    try {
      google.accounts.oauth2.revoke(accessToken, () => {});
    } catch {
      // GIS may not be loaded if token was already expired
    }
  }

  accessToken = null;
  userEmail = null;
  tokenClient = null;

  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }

  await Promise.all([
    deleteSyncMeta('gdriveEmail').catch(() => {}),
    deleteSyncMeta('gdriveFileId').catch(() => {}),
    deleteSyncMeta('lastBackupTime').catch(() => {}),
  ]);
}

/**
 * @returns {boolean} Whether an access token is currently held in memory.
 */
export function isSignedIn() {
  return accessToken !== null;
}

/**
 * @returns {string|null} The signed-in user's email, or null.
 */
export function getSignedInEmail() {
  return userEmail;
}

/**
 * Get the stored email from the last sign-in (display hint, survives reload).
 * @returns {Promise<string|null>}
 */
export async function getStoredEmail() {
  return getSyncMeta('gdriveEmail');
}

/**
 * Get the timestamp of the last successful backup.
 * @returns {Promise<string|null>} ISO timestamp or null.
 */
export async function getLastBackupTime() {
  return getSyncMeta('lastBackupTime');
}

// ─── Drive API Helpers ──────────────────────────────────────────────────────

/**
 * Authenticated fetch wrapper for Drive API calls.
 * Throws on 401 (expired token) or non-2xx responses.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
async function driveFetch(url, options = {}) {
  if (!accessToken) throw new Error('Not signed in');

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    accessToken = null;
    userEmail = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    throw new Error('Session expired. Please reconnect Google Drive.');
  }

  if (!response.ok) {
    let message = `Drive API error (${response.status})`;
    try {
      const body = await response.json();
      message = body.error?.message || message;
    } catch { /* use default message */ }
    throw new Error(message);
  }

  return response;
}

/**
 * Build a multipart/related body for Drive file creation.
 *
 * @param {object} metadata - Drive file metadata (name, parents, etc.)
 * @param {string} content  - JSON string of the file content
 * @returns {{ body: string, contentType: string }}
 */
function buildMultipartBody(metadata, content) {
  const boundary = 'flight_perf_boundary';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

// ─── Backup ─────────────────────────────────────────────────────────────────

/**
 * Serialize app data and upload to Google Drive appDataFolder.
 *
 * Backs up:
 *   - Fleet instances (all)
 *   - Custom type profiles (source !== 'bundled')
 *   - User preferences (theme, units, activeAircraftId)
 *
 * Creates a new file on first backup, updates the existing file thereafter.
 *
 * @returns {Promise<{ timestamp: string, fileId: string }>}
 */
export async function backup() {
  if (!isSignedIn()) throw new Error('Not signed in');

  // Gather data
  const fleet = await getAllInstances();
  const allTypes = await getAllTypes();
  const customTypes = allTypes.filter((t) => t.source !== 'bundled');

  const payload = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: 'flight-perf',
    data: {
      fleet,
      customTypes,
      preferences: {
        theme: storage.get('theme', 'auto'),
        units: storage.get('global_units', null),
        activeAircraftId: storage.get('activeAircraftId', null),
      },
    },
  };

  const jsonContent = JSON.stringify(payload);

  // Check for existing backup file
  let fileId = await getSyncMeta('gdriveFileId');

  if (fileId) {
    // Verify the file still exists
    try {
      await driveFetch(`${DRIVE_API}/files/${fileId}?spaces=appDataFolder&fields=id`);
    } catch {
      fileId = null; // File was deleted or inaccessible — create new
    }
  }

  if (fileId) {
    // Update existing file
    const response = await driveFetch(
      `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: jsonContent,
      },
    );
    const result = await response.json();
    fileId = result.id;
  } else {
    // Create new file
    const metadata = { name: BACKUP_FILENAME, parents: ['appDataFolder'] };
    const { body, contentType } = buildMultipartBody(metadata, jsonContent);

    const response = await driveFetch(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      },
    );
    const result = await response.json();
    fileId = result.id;
  }

  // Persist sync metadata
  await putSyncMeta('gdriveFileId', fileId);
  await putSyncMeta('lastBackupTime', payload.createdAt);

  return { timestamp: payload.createdAt, fileId };
}

// ─── Restore ────────────────────────────────────────────────────────────────

/**
 * Download backup from Google Drive and merge into local state.
 *
 * - Custom types: upserted into IDB types store (by typeId)
 * - Fleet instances: upserted into IDB fleet store (by instanceId)
 * - Preferences: overwritten in localStorage
 *
 * @returns {Promise<{ timestamp: string, fleet: number, customTypes: number }>}
 */
export async function restore() {
  if (!isSignedIn()) throw new Error('Not signed in');

  // Find backup file in appDataFolder
  const searchResponse = await driveFetch(
    `${DRIVE_API}/files?spaces=appDataFolder` +
    `&q=name='${BACKUP_FILENAME}'` +
    `&fields=files(id,name,modifiedTime)` +
    `&orderBy=modifiedTime desc` +
    `&pageSize=1`,
  );
  const searchResult = await searchResponse.json();

  if (!searchResult.files?.length) {
    throw new Error('No backup found on Google Drive');
  }

  const fileId = searchResult.files[0].id;

  // Download file content
  const contentResponse = await driveFetch(
    `${DRIVE_API}/files/${fileId}?alt=media`,
  );
  const parsed = await contentResponse.json();

  // Validate backup structure
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup data');
  }
  if (parsed.app !== 'flight-perf') {
    throw new Error('Invalid backup: not a flight-perf backup file');
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${parsed.version}`);
  }
  if (!parsed.data) {
    throw new Error('Invalid backup: missing data');
  }

  const { fleet = [], customTypes = [], preferences = {} } = parsed.data;

  // Restore custom types
  for (const type of customTypes) {
    await putType(type);
  }

  // Restore fleet instances
  for (const instance of fleet) {
    await putInstance(instance);
  }

  // Restore preferences
  if (preferences.theme != null) {
    storage.set('theme', preferences.theme);
  }
  if (preferences.units != null) {
    storage.set('global_units', preferences.units);
  }
  if (preferences.activeAircraftId != null) {
    storage.set('activeAircraftId', preferences.activeAircraftId);
  }

  // Update sync metadata
  await putSyncMeta('lastBackupTime', parsed.createdAt);
  await putSyncMeta('gdriveFileId', fileId);

  return {
    timestamp: parsed.createdAt,
    fleet: fleet.length,
    customTypes: customTypes.length,
  };
}

// ─── Test helpers ───────────────────────────────────────────────────────────

/**
 * Reset module state. Exported only for testing — not part of public API.
 * @private
 */
export function _resetForTest() {
  tokenClient = null;
  accessToken = null;
  userEmail = null;
  gisLoadPromise = null;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
