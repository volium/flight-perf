import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  openDB,
  closeDB,
  getType,
  getAllTypes,
  getTypesBySource,
  putType,
  deleteType,
  clearTypes,
  getInstance,
  getAllInstances,
  getInstancesByType,
  putInstance,
  deleteInstance,
  clearFleet,
  getSyncMeta,
  putSyncMeta,
  deleteSyncMeta,
} from '@/data/db.js';

// Reset IDB state between tests
beforeEach(() => {
  closeDB();
  // fake-indexeddb uses global indexedDB — delete the database between tests
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('flightperf');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

afterEach(() => {
  closeDB();
});

// ─── Database lifecycle ─────────────────────────────────────────────────────

describe('openDB', () => {
  it('opens database and creates object stores', async () => {
    const db = await openDB();
    expect(db).toBeDefined();
    expect(db.name).toBe('flightperf');
    expect(db.objectStoreNames.contains('types')).toBe(true);
    expect(db.objectStoreNames.contains('fleet')).toBe(true);
    expect(db.objectStoreNames.contains('syncMeta')).toBe(true);
  });

  it('returns the same instance on subsequent calls', async () => {
    const db1 = await openDB();
    const db2 = await openDB();
    expect(db1).toBe(db2);
  });

  it('returns fresh instance after closeDB', async () => {
    const db1 = await openDB();
    closeDB();
    const db2 = await openDB();
    expect(db1).not.toBe(db2);
  });
});

// ─── Type profiles CRUD ─────────────────────────────────────────────────────

describe('types store', () => {
  const slingType = {
    typeId: 'sling-lsa',
    source: 'bundled',
    schemaVersion: '2.0',
    aircraft: { id: 'sling-lsa', name: 'Sling LSA', manufacturer: 'Sling Aircraft' },
  };

  const cessnaType = {
    typeId: 'cessna-172s',
    source: 'bundled',
    schemaVersion: '2.0',
    aircraft: { id: 'cessna-172s', name: 'Cessna 172S Skyhawk SP', manufacturer: 'Cessna' },
  };

  const customType = {
    typeId: 'rv-7',
    source: 'custom',
    schemaVersion: '2.0',
    aircraft: { id: 'rv-7', name: 'Van\'s RV-7', manufacturer: 'Van\'s Aircraft' },
  };

  it('putType + getType round-trip', async () => {
    await putType(slingType);
    const result = await getType('sling-lsa');
    expect(result).toEqual(slingType);
  });

  it('getType returns null for missing key', async () => {
    const result = await getType('nonexistent');
    expect(result).toBeNull();
  });

  it('getAllTypes returns all stored types', async () => {
    await putType(slingType);
    await putType(cessnaType);
    const all = await getAllTypes();
    expect(all.length).toBe(2);
    expect(all.map((t) => t.typeId).sort()).toEqual(['cessna-172s', 'sling-lsa']);
  });

  it('getAllTypes returns empty array when store is empty', async () => {
    const all = await getAllTypes();
    expect(all).toEqual([]);
  });

  it('getTypesBySource filters by source index', async () => {
    await putType(slingType);
    await putType(cessnaType);
    await putType(customType);

    const bundled = await getTypesBySource('bundled');
    expect(bundled.length).toBe(2);

    const custom = await getTypesBySource('custom');
    expect(custom.length).toBe(1);
    expect(custom[0].typeId).toBe('rv-7');
  });

  it('putType overwrites existing type with same key', async () => {
    await putType(slingType);
    const updated = { ...slingType, aircraft: { ...slingType.aircraft, name: 'Sling LSA v2' } };
    await putType(updated);

    const result = await getType('sling-lsa');
    expect(result.aircraft.name).toBe('Sling LSA v2');

    const all = await getAllTypes();
    expect(all.length).toBe(1);
  });

  it('deleteType removes a type', async () => {
    await putType(slingType);
    await putType(cessnaType);
    await deleteType('sling-lsa');

    const result = await getType('sling-lsa');
    expect(result).toBeNull();

    const all = await getAllTypes();
    expect(all.length).toBe(1);
  });

  it('deleteType is safe for nonexistent key', async () => {
    await expect(deleteType('nonexistent')).resolves.toBeUndefined();
  });

  it('clearTypes removes all types', async () => {
    await putType(slingType);
    await putType(cessnaType);
    await clearTypes();

    const all = await getAllTypes();
    expect(all).toEqual([]);
  });
});

// ─── Fleet (aircraft instances) CRUD ────────────────────────────────────────

describe('fleet store', () => {
  const instance1 = {
    instanceId: 'inst-001',
    typeId: 'sling-lsa',
    registration: 'N246LT',
    emptyWeight: { value: 384, unit: 'kg' },
    updatedAt: '2026-03-10T01:00:00Z',
  };

  const instance2 = {
    instanceId: 'inst-002',
    typeId: 'cessna-172s',
    registration: 'N54321',
    emptyWeight: { value: 1680, unit: 'lbs' },
    updatedAt: '2026-03-10T02:00:00Z',
  };

  const instance3 = {
    instanceId: 'inst-003',
    typeId: 'cessna-172s',
    registration: 'N12345',
    emptyWeight: { value: 1690, unit: 'lbs' },
    updatedAt: '2026-03-10T03:00:00Z',
  };

  it('putInstance + getInstance round-trip', async () => {
    await putInstance(instance1);
    const result = await getInstance('inst-001');
    expect(result).toEqual(instance1);
  });

  it('getInstance returns null for missing key', async () => {
    const result = await getInstance('nonexistent');
    expect(result).toBeNull();
  });

  it('getAllInstances returns all stored instances', async () => {
    await putInstance(instance1);
    await putInstance(instance2);
    const all = await getAllInstances();
    expect(all.length).toBe(2);
  });

  it('getAllInstances returns empty array when store is empty', async () => {
    const all = await getAllInstances();
    expect(all).toEqual([]);
  });

  it('getInstancesByType filters by typeId index', async () => {
    await putInstance(instance1);
    await putInstance(instance2);
    await putInstance(instance3);

    const slings = await getInstancesByType('sling-lsa');
    expect(slings.length).toBe(1);
    expect(slings[0].registration).toBe('N246LT');

    const cessnas = await getInstancesByType('cessna-172s');
    expect(cessnas.length).toBe(2);
    expect(cessnas.map((i) => i.registration).sort()).toEqual(['N12345', 'N54321']);
  });

  it('putInstance overwrites existing instance with same key', async () => {
    await putInstance(instance1);
    const updated = { ...instance1, registration: 'N999XX' };
    await putInstance(updated);

    const result = await getInstance('inst-001');
    expect(result.registration).toBe('N999XX');

    const all = await getAllInstances();
    expect(all.length).toBe(1);
  });

  it('deleteInstance removes an instance', async () => {
    await putInstance(instance1);
    await putInstance(instance2);
    await deleteInstance('inst-001');

    const result = await getInstance('inst-001');
    expect(result).toBeNull();

    const all = await getAllInstances();
    expect(all.length).toBe(1);
  });

  it('deleteInstance is safe for nonexistent key', async () => {
    await expect(deleteInstance('nonexistent')).resolves.toBeUndefined();
  });

  it('clearFleet removes all instances', async () => {
    await putInstance(instance1);
    await putInstance(instance2);
    await clearFleet();

    const all = await getAllInstances();
    expect(all).toEqual([]);
  });
});

// ─── Sync metadata CRUD ────────────────────────────────────────────────────

describe('syncMeta store', () => {
  it('putSyncMeta + getSyncMeta round-trip', async () => {
    await putSyncMeta('lastSyncTime', '2026-03-10T01:00:00Z');
    const result = await getSyncMeta('lastSyncTime');
    expect(result).toBe('2026-03-10T01:00:00Z');
  });

  it('getSyncMeta returns null for missing key', async () => {
    const result = await getSyncMeta('nonexistent');
    expect(result).toBeNull();
  });

  it('stores complex objects', async () => {
    const data = { fleetFileId: 'abc123', typesFileId: 'def456', version: 3 };
    await putSyncMeta('driveState', data);
    const result = await getSyncMeta('driveState');
    expect(result).toEqual(data);
  });

  it('putSyncMeta overwrites existing value', async () => {
    await putSyncMeta('lastSyncTime', 'old');
    await putSyncMeta('lastSyncTime', 'new');
    const result = await getSyncMeta('lastSyncTime');
    expect(result).toBe('new');
  });

  it('deleteSyncMeta removes a key', async () => {
    await putSyncMeta('lastSyncTime', '2026-03-10');
    await deleteSyncMeta('lastSyncTime');
    const result = await getSyncMeta('lastSyncTime');
    expect(result).toBeNull();
  });
});

// ─── Cross-store isolation ──────────────────────────────────────────────────

describe('store isolation', () => {
  it('types and fleet stores are independent', async () => {
    await putType({ typeId: 'test-type', source: 'custom', aircraft: { name: 'Test' } });
    await putInstance({ instanceId: 'test-inst', typeId: 'test-type', registration: 'N999' });

    await clearTypes();

    const types = await getAllTypes();
    const instances = await getAllInstances();
    expect(types).toEqual([]);
    expect(instances.length).toBe(1);
  });
});
