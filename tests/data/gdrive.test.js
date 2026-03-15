import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  openDB,
  closeDB,
  clearTypes,
  clearFleet,
  getAllInstances,
  getAllTypes,
  getSyncMeta,
  putType,
  putInstance,
  putSyncMeta,
  deleteSyncMeta,
} from '@/data/db.js';

// ─── Module under test ──────────────────────────────────────────────────────

// We need to import the module dynamically so we can reset state between tests.
// The module holds closure state (accessToken, userEmail, etc.) that persists
// across calls. _resetForTest() clears it.

import {
  loadGIS,
  signIn,
  signOut,
  isSignedIn,
  getSignedInEmail,
  getStoredEmail,
  getLastBackupTime,
  backup,
  restore,
  _resetForTest,
} from '@/data/gdrive.js';
import { storage } from '@/data/storage.js';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeFleetInstance(overrides = {}) {
  return {
    instanceId: 'inst-001',
    typeId: 'custom-rv7',
    registration: 'N123AB',
    displayName: 'My RV-7',
    emptyWeight: { value: 1100, unit: 'lbs' },
    emptyCG: null,
    notes: '',
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: '2026-03-10T00:00:00.000Z',
    ...overrides,
  };
}

function makeCustomType(overrides = {}) {
  return {
    typeId: 'custom-rv7',
    source: 'custom',
    schemaVersion: '2.0',
    dataVersion: 1,
    aircraft: { id: 'custom-rv7', name: "Van's RV-7", manufacturer: 'Vans', model: 'RV-7' },
    limits: { maxTakeoffWeight: { value: 1800, unit: 'lbs' } },
    fuel: { type: '100LL', capacity: { value: 42, unit: 'us_gal' }, usable: { value: 40, unit: 'us_gal' } },
    speeds: { Vs0: 49, Vs1: 54, Vfe: 100, Vno: 163, Vne: 200 },
    ...overrides,
  };
}

function makeBundledType(overrides = {}) {
  return {
    typeId: 'sling-lsa',
    source: 'bundled',
    schemaVersion: '2.0',
    dataVersion: 1,
    aircraft: { id: 'sling-lsa', name: 'Sling LSA', manufacturer: 'Sling', model: 'LSA' },
    limits: { maxTakeoffWeight: { value: 600, unit: 'kg' } },
    fuel: { type: '100LL', capacity: { value: 70, unit: 'L' }, usable: { value: 65, unit: 'L' } },
    speeds: { Vs0: 38, Vs1: 42, Vfe: 75, Vno: 108, Vne: 140 },
    ...overrides,
  };
}

function makeBackupPayload(overrides = {}) {
  return {
    version: 1,
    createdAt: '2026-03-14T12:00:00.000Z',
    app: 'flight-perf',
    data: {
      fleet: [makeFleetInstance()],
      customTypes: [makeCustomType()],
      preferences: {
        theme: 'dark',
        units: { altitude: 'm', fuel: 'L' },
        activeAircraftId: 'inst-001',
      },
    },
    ...overrides,
  };
}

// ─── Mock setup ─────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

// Mock localStorage for Node environment (Vitest doesn't provide a real one)
const localStorageStore = new Map();
const mockLocalStorage = {
  getItem: (key) => localStorageStore.get(key) ?? null,
  setItem: (key, value) => localStorageStore.set(key, String(value)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear(),
};

// Apply mock before any module code accesses localStorage
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.setItem !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
}

function stubGIS() {
  globalThis.google = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn((config) => {
          const client = {
            requestAccessToken: vi.fn(() => {
              // Simulate successful token response
              config.callback({ access_token: 'mock-token-123' });
            }),
            _config: config,
          };
          return client;
        }),
        revoke: vi.fn((_token, callback) => {
          if (callback) callback();
        }),
      },
    },
  };
}

function stubFetchForUserInfo(email = 'pilot@example.com') {
  globalThis.fetch = vi.fn((url, opts) => {
    if (url.includes('oauth2/v3/userinfo')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ email }),
      });
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
}

function stubFetchForDriveOps(options = {}) {
  const {
    email = 'pilot@example.com',
    searchFiles = [],
    uploadId = 'file-abc-123',
    fileContent = null,
  } = options;

  let capturedUploadBody = null;

  const mockFetch = vi.fn(async (url, opts = {}) => {
    // Userinfo
    if (url.includes('oauth2/v3/userinfo')) {
      return { ok: true, json: () => Promise.resolve({ email }) };
    }

    // File metadata check (GET /files/{id}?spaces=appDataFolder)
    if (url.match(/\/drive\/v3\/files\/[^?]+\?spaces=appDataFolder/)) {
      return { ok: true, json: () => Promise.resolve({ id: uploadId }) };
    }

    // File search (GET /files?spaces=appDataFolder&q=...)
    if (url.includes('/drive/v3/files?spaces=appDataFolder')) {
      return {
        ok: true,
        json: () => Promise.resolve({ files: searchFiles }),
      };
    }

    // File download (GET /files/{id}?alt=media)
    if (url.includes('alt=media')) {
      if (!fileContent) {
        return { ok: false, status: 404, json: () => Promise.resolve({ error: { message: 'Not found' } }) };
      }
      return { ok: true, json: () => Promise.resolve(fileContent) };
    }

    // Upload - multipart create (POST /upload/drive/v3/files?uploadType=multipart)
    if (url.includes('uploadType=multipart') && opts.method === 'POST') {
      capturedUploadBody = opts.body;
      return { ok: true, json: () => Promise.resolve({ id: uploadId }) };
    }

    // Upload - media update (PATCH /upload/drive/v3/files/{id}?uploadType=media)
    if (url.includes('uploadType=media') && opts.method === 'PATCH') {
      capturedUploadBody = opts.body;
      return { ok: true, json: () => Promise.resolve({ id: uploadId }) };
    }

    return { ok: false, status: 404, json: () => Promise.resolve({ error: { message: 'Not found' } }) };
  });

  globalThis.fetch = mockFetch;

  return {
    get capturedUploadBody() { return capturedUploadBody; },
    mockFetch,
  };
}

async function signInHelper() {
  stubGIS();
  stubFetchForUserInfo();
  await signIn();
}

// ─── Test lifecycle ─────────────────────────────────────────────────────────

beforeEach(async () => {
  _resetForTest();

  // Clear IDB stores rather than deleteDatabase (avoids fake-indexeddb blocking)
  await openDB();
  await clearTypes();
  await clearFleet();
  // Clear syncMeta entries individually (no clearSyncMeta export)
  await deleteSyncMeta('gdriveEmail').catch(() => {});
  await deleteSyncMeta('gdriveFileId').catch(() => {});
  await deleteSyncMeta('lastBackupTime').catch(() => {});

  // Clear any localStorage state from previous tests
  localStorageStore.clear();
});

afterEach(() => {
  _resetForTest();
  globalThis.fetch = originalFetch;
  delete globalThis.google;
});

// ─── loadGIS ────────────────────────────────────────────────────────────────

describe('loadGIS', () => {
  it('resolves immediately when google.accounts.oauth2 already exists', async () => {
    stubGIS();
    await expect(loadGIS()).resolves.toBeUndefined();
  });

  it('returns the same promise on duplicate calls', async () => {
    stubGIS();
    const p1 = loadGIS();
    const p2 = loadGIS();
    expect(p1).toBe(p2);
    await p1;
  });
});

// ─── signIn ─────────────────────────────────────────────────────────────────

describe('signIn', () => {
  it('initializes token client and returns email', async () => {
    stubGIS();
    stubFetchForUserInfo('test@gmail.com');
    const result = await signIn();
    expect(result.email).toBe('test@gmail.com');
  });

  it('stores access token so isSignedIn returns true', async () => {
    expect(isSignedIn()).toBe(false);
    await signInHelper();
    expect(isSignedIn()).toBe(true);
  });

  it('stores email accessible via getSignedInEmail', async () => {
    expect(getSignedInEmail()).toBeNull();
    stubGIS();
    stubFetchForUserInfo('pilot@example.com');
    await signIn();
    expect(getSignedInEmail()).toBe('pilot@example.com');
  });

  it('persists email in syncMeta for display on reload', async () => {
    stubGIS();
    stubFetchForUserInfo('pilot@example.com');
    await signIn();
    const stored = await getSyncMeta('gdriveEmail');
    expect(stored).toBe('pilot@example.com');
  });

  it('rejects when user cancels consent', async () => {
    globalThis.google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((config) => ({
            requestAccessToken: vi.fn(() => {
              config.callback({ error: 'access_denied', error_description: 'User cancelled' });
            }),
          })),
        },
      },
    };

    await expect(signIn()).rejects.toThrow('User cancelled');
    expect(isSignedIn()).toBe(false);
  });
});

// ─── signOut ────────────────────────────────────────────────────────────────

describe('signOut', () => {
  it('clears module state so isSignedIn returns false', async () => {
    await signInHelper();
    expect(isSignedIn()).toBe(true);
    await signOut();
    expect(isSignedIn()).toBe(false);
    expect(getSignedInEmail()).toBeNull();
  });

  it('clears syncMeta keys', async () => {
    await signInHelper();
    await putSyncMeta('gdriveFileId', 'file-123');
    await putSyncMeta('lastBackupTime', '2026-03-14T00:00:00Z');

    await signOut();

    expect(await getSyncMeta('gdriveEmail')).toBeNull();
    expect(await getSyncMeta('gdriveFileId')).toBeNull();
    expect(await getSyncMeta('lastBackupTime')).toBeNull();
  });

  it('is safe to call when not signed in', async () => {
    await expect(signOut()).resolves.toBeUndefined();
  });
});

// ─── isSignedIn / getSignedInEmail ──────────────────────────────────────────

describe('isSignedIn / getSignedInEmail', () => {
  it('returns false / null before sign-in', () => {
    expect(isSignedIn()).toBe(false);
    expect(getSignedInEmail()).toBeNull();
  });

  it('returns true / email after sign-in', async () => {
    stubGIS();
    stubFetchForUserInfo('test@test.com');
    await signIn();
    expect(isSignedIn()).toBe(true);
    expect(getSignedInEmail()).toBe('test@test.com');
  });

  it('returns false / null after sign-out', async () => {
    await signInHelper();
    await signOut();
    expect(isSignedIn()).toBe(false);
    expect(getSignedInEmail()).toBeNull();
  });
});

// ─── backup ─────────────────────────────────────────────────────────────────

describe('backup', () => {
  it('throws when not signed in', async () => {
    await expect(backup()).rejects.toThrow('Not signed in');
  });

  it('serializes fleet, custom types, and preferences', async () => {
    // Seed IDB
    await putInstance(makeFleetInstance());
    await putType(makeCustomType());
    storage.set('theme', 'dark');
    storage.set('global_units', { altitude: 'm' });
    storage.set('activeAircraftId', 'inst-001');

    // Sign in and set up Drive mock
    stubGIS();
    const drive = stubFetchForDriveOps();
    await signIn();

    const result = await backup();
    expect(result.timestamp).toBeTruthy();
    expect(result.fileId).toBe('file-abc-123');

    // Parse the uploaded body to verify content
    const uploadCall = drive.mockFetch.mock.calls.find(
      ([url, opts]) => url.includes('uploadType=multipart'),
    );
    expect(uploadCall).toBeTruthy();

    const body = uploadCall[1].body;
    // Extract JSON payload from multipart body (second part)
    const parts = body.split('flight_perf_boundary');
    const payloadPart = parts[2]; // Third segment (after second boundary)
    const jsonStart = payloadPart.indexOf('{');
    const jsonEnd = payloadPart.lastIndexOf('}');
    const payload = JSON.parse(payloadPart.slice(jsonStart, jsonEnd + 1));

    expect(payload.version).toBe(1);
    expect(payload.app).toBe('flight-perf');
    expect(payload.data.fleet).toHaveLength(1);
    expect(payload.data.fleet[0].instanceId).toBe('inst-001');
    expect(payload.data.customTypes).toHaveLength(1);
    expect(payload.data.customTypes[0].typeId).toBe('custom-rv7');
    expect(payload.data.preferences.theme).toBe('dark');
    expect(payload.data.preferences.units).toEqual({ altitude: 'm' });
  });

  it('excludes bundled types from backup', async () => {
    await putType(makeBundledType());
    await putType(makeCustomType());

    stubGIS();
    const drive = stubFetchForDriveOps();
    await signIn();

    await backup();

    const uploadCall = drive.mockFetch.mock.calls.find(
      ([url]) => url.includes('uploadType=multipart'),
    );
    const body = uploadCall[1].body;
    const parts = body.split('flight_perf_boundary');
    const payloadPart = parts[2];
    const jsonStart = payloadPart.indexOf('{');
    const jsonEnd = payloadPart.lastIndexOf('}');
    const payload = JSON.parse(payloadPart.slice(jsonStart, jsonEnd + 1));

    expect(payload.data.customTypes).toHaveLength(1);
    expect(payload.data.customTypes[0].source).toBe('custom');
    expect(payload.data.customTypes.find((t) => t.source === 'bundled')).toBeUndefined();
  });

  it('updates existing file when gdriveFileId is in syncMeta', async () => {
    await putSyncMeta('gdriveFileId', 'existing-file-id');

    stubGIS();
    const drive = stubFetchForDriveOps({ uploadId: 'existing-file-id' });
    await signIn();

    await backup();

    const patchCall = drive.mockFetch.mock.calls.find(
      ([url, opts]) => url.includes('uploadType=media') && opts?.method === 'PATCH',
    );
    expect(patchCall).toBeTruthy();
    expect(patchCall[0]).toContain('existing-file-id');
  });

  it('creates new file when no prior backup exists', async () => {
    stubGIS();
    const drive = stubFetchForDriveOps();
    await signIn();

    await backup();

    const postCall = drive.mockFetch.mock.calls.find(
      ([url, opts]) => url.includes('uploadType=multipart') && opts?.method === 'POST',
    );
    expect(postCall).toBeTruthy();
  });

  it('stores lastBackupTime and gdriveFileId in syncMeta', async () => {
    stubGIS();
    stubFetchForDriveOps();
    await signIn();

    const result = await backup();

    expect(await getSyncMeta('lastBackupTime')).toBe(result.timestamp);
    expect(await getSyncMeta('gdriveFileId')).toBe('file-abc-123');
  });

  it('handles empty fleet and no custom types', async () => {
    stubGIS();
    const drive = stubFetchForDriveOps();
    await signIn();

    const result = await backup();
    expect(result.fileId).toBe('file-abc-123');

    // Verify payload has empty arrays
    const uploadCall = drive.mockFetch.mock.calls.find(
      ([url]) => url.includes('uploadType=multipart'),
    );
    const body = uploadCall[1].body;
    const parts = body.split('flight_perf_boundary');
    const payloadPart = parts[2];
    const jsonStart = payloadPart.indexOf('{');
    const jsonEnd = payloadPart.lastIndexOf('}');
    const payload = JSON.parse(payloadPart.slice(jsonStart, jsonEnd + 1));

    expect(payload.data.fleet).toEqual([]);
    expect(payload.data.customTypes).toEqual([]);
  });
});

// ─── restore ────────────────────────────────────────────────────────────────

describe('restore', () => {
  it('throws when not signed in', async () => {
    await expect(restore()).rejects.toThrow('Not signed in');
  });

  it('throws when no backup file found', async () => {
    stubGIS();
    stubFetchForDriveOps({ searchFiles: [] });
    await signIn();

    await expect(restore()).rejects.toThrow('No backup found');
  });

  it('upserts fleet instances into IDB', async () => {
    const backupData = makeBackupPayload();
    stubGIS();
    stubFetchForDriveOps({
      searchFiles: [{ id: 'file-123', name: 'flight-perf-backup.json' }],
      fileContent: backupData,
    });
    await signIn();

    await restore();

    const instances = await getAllInstances();
    expect(instances).toHaveLength(1);
    expect(instances[0].instanceId).toBe('inst-001');
    expect(instances[0].registration).toBe('N123AB');
  });

  it('upserts custom types into IDB', async () => {
    const backupData = makeBackupPayload();
    stubGIS();
    stubFetchForDriveOps({
      searchFiles: [{ id: 'file-123', name: 'flight-perf-backup.json' }],
      fileContent: backupData,
    });
    await signIn();

    await restore();

    const types = await getAllTypes();
    expect(types).toHaveLength(1);
    expect(types[0].typeId).toBe('custom-rv7');
  });

  it('restores preferences to localStorage', async () => {
    const backupData = makeBackupPayload();
    stubGIS();
    stubFetchForDriveOps({
      searchFiles: [{ id: 'file-123', name: 'flight-perf-backup.json' }],
      fileContent: backupData,
    });
    await signIn();

    await restore();

    expect(storage.get('theme')).toBe('dark');
    expect(storage.get('global_units')).toEqual({ altitude: 'm', fuel: 'L' });
    expect(storage.get('activeAircraftId')).toBe('inst-001');
  });

  it('returns counts of restored items', async () => {
    const backupData = makeBackupPayload({
      data: {
        fleet: [makeFleetInstance(), makeFleetInstance({ instanceId: 'inst-002', registration: 'N456CD' })],
        customTypes: [makeCustomType()],
        preferences: {},
      },
    });
    stubGIS();
    stubFetchForDriveOps({
      searchFiles: [{ id: 'file-123', name: 'flight-perf-backup.json' }],
      fileContent: backupData,
    });
    await signIn();

    const result = await restore();
    expect(result.fleet).toBe(2);
    expect(result.customTypes).toBe(1);
    expect(result.timestamp).toBe('2026-03-14T12:00:00.000Z');
  });

  it('throws on invalid version', async () => {
    const backupData = makeBackupPayload({ version: 99 });
    stubGIS();
    stubFetchForDriveOps({
      searchFiles: [{ id: 'file-123', name: 'flight-perf-backup.json' }],
      fileContent: backupData,
    });
    await signIn();

    await expect(restore()).rejects.toThrow('Unsupported backup version');
  });

  it('throws on invalid app field', async () => {
    const backupData = makeBackupPayload({ app: 'wrong-app' });
    stubGIS();
    stubFetchForDriveOps({
      searchFiles: [{ id: 'file-123', name: 'flight-perf-backup.json' }],
      fileContent: backupData,
    });
    await signIn();

    await expect(restore()).rejects.toThrow('not a flight-perf backup');
  });

  it('throws on missing data field', async () => {
    const backupData = { version: 1, app: 'flight-perf', createdAt: '2026-01-01T00:00:00Z' };
    stubGIS();
    stubFetchForDriveOps({
      searchFiles: [{ id: 'file-123', name: 'flight-perf-backup.json' }],
      fileContent: backupData,
    });
    await signIn();

    await expect(restore()).rejects.toThrow('missing data');
  });

  it('handles backup with empty arrays gracefully', async () => {
    const backupData = makeBackupPayload({
      data: { fleet: [], customTypes: [], preferences: {} },
    });
    stubGIS();
    stubFetchForDriveOps({
      searchFiles: [{ id: 'file-123', name: 'flight-perf-backup.json' }],
      fileContent: backupData,
    });
    await signIn();

    const result = await restore();
    expect(result.fleet).toBe(0);
    expect(result.customTypes).toBe(0);
  });
});

// ─── getLastBackupTime / getStoredEmail ──────────────────────────────────────

describe('getLastBackupTime / getStoredEmail', () => {
  it('returns null before any backup', async () => {
    expect(await getLastBackupTime()).toBeNull();
  });

  it('returns timestamp after successful backup', async () => {
    stubGIS();
    stubFetchForDriveOps();
    await signIn();
    const result = await backup();

    const time = await getLastBackupTime();
    expect(time).toBe(result.timestamp);
  });

  it('getStoredEmail returns email after sign-in', async () => {
    stubGIS();
    stubFetchForUserInfo('stored@example.com');
    await signIn();

    const email = await getStoredEmail();
    expect(email).toBe('stored@example.com');
  });

  it('getStoredEmail returns null before any sign-in', async () => {
    expect(await getStoredEmail()).toBeNull();
  });
});
