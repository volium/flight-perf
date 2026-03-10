/**
 * IndexedDB abstraction layer for flight-perf.
 *
 * Manages three object stores in a single `flightperf` database:
 *   - `types`    — Aircraft type profiles (bundled + custom)
 *   - `fleet`    — Aircraft instances (user's fleet)
 *   - `syncMeta` — Google Drive sync state (timestamps, file IDs)
 *
 * All methods return Promises. No external dependencies — vanilla IDB API only.
 *
 * @module data/db
 */

const DB_NAME = 'flightperf';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Open (or create) the IndexedDB database.
 * Reuses a cached connection if already open.
 *
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('types')) {
        const types = db.createObjectStore('types', { keyPath: 'typeId' });
        types.createIndex('source', 'source', { unique: false });
        types.createIndex('name', 'aircraft.name', { unique: false });
      }

      if (!db.objectStoreNames.contains('fleet')) {
        const fleet = db.createObjectStore('fleet', { keyPath: 'instanceId' });
        fleet.createIndex('typeId', 'typeId', { unique: false });
        fleet.createIndex('registration', 'registration', { unique: false });
        fleet.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('syncMeta')) {
        db.createObjectStore('syncMeta', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error(`IndexedDB open failed: ${event.target.error?.message}`));
    };
  });
}

/**
 * Close the database connection and clear the cached instance.
 * Useful for testing cleanup.
 */
export function closeDB() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// ─── Generic helpers ────────────────────────────────────────────────────────

function txGet(storeName, key) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(new Error(`get(${storeName}, ${key}) failed: ${request.error?.message}`));
  }));
}

function txGetAll(storeName) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(new Error(`getAll(${storeName}) failed: ${request.error?.message}`));
  }));
}

function txGetAllByIndex(storeName, indexName, value) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(new Error(`getByIndex(${storeName}, ${indexName}, ${value}) failed: ${request.error?.message}`));
  }));
}

function txPut(storeName, value) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`put(${storeName}) failed: ${request.error?.message}`));
  }));
}

function txDelete(storeName, key) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`delete(${storeName}, ${key}) failed: ${request.error?.message}`));
  }));
}

function txClear(storeName) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`clear(${storeName}) failed: ${request.error?.message}`));
  }));
}

// ─── Type profiles ──────────────────────────────────────────────────────────

/** @returns {Promise<object|null>} */
export function getType(typeId) {
  return txGet('types', typeId);
}

/** @returns {Promise<object[]>} */
export function getAllTypes() {
  return txGetAll('types');
}

/** @returns {Promise<object[]>} */
export function getTypesBySource(source) {
  return txGetAllByIndex('types', 'source', source);
}

/** @param {object} typeProfile — must include `typeId` */
export function putType(typeProfile) {
  return txPut('types', typeProfile);
}

/** @param {string} typeId */
export function deleteType(typeId) {
  return txDelete('types', typeId);
}

/** Remove all type profiles. */
export function clearTypes() {
  return txClear('types');
}

// ─── Fleet (aircraft instances) ─────────────────────────────────────────────

/** @returns {Promise<object|null>} */
export function getInstance(instanceId) {
  return txGet('fleet', instanceId);
}

/** @returns {Promise<object[]>} */
export function getAllInstances() {
  return txGetAll('fleet');
}

/** @returns {Promise<object[]>} */
export function getInstancesByType(typeId) {
  return txGetAllByIndex('fleet', 'typeId', typeId);
}

/** @param {object} instance — must include `instanceId` */
export function putInstance(instance) {
  return txPut('fleet', instance);
}

/** @param {string} instanceId */
export function deleteInstance(instanceId) {
  return txDelete('fleet', instanceId);
}

/** Remove all aircraft instances. */
export function clearFleet() {
  return txClear('fleet');
}

// ─── Sync metadata ──────────────────────────────────────────────────────────

/** @returns {Promise<any>} The value stored under `key`, or null. */
export function getSyncMeta(key) {
  return txGet('syncMeta', key).then((record) => record?.value ?? null);
}

/**
 * Store a sync metadata value.
 * @param {string} key
 * @param {any} value
 */
export function putSyncMeta(key, value) {
  return txPut('syncMeta', { key, value });
}

/** @param {string} key */
export function deleteSyncMeta(key) {
  return txDelete('syncMeta', key);
}
