const STORAGE_PREFIX = 'flightperf_';

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
      // storage full or unavailable — fail silently
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // fail silently
    }
  },

  clear() {
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith(STORAGE_PREFIX),
      );
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // fail silently
    }
  },
};
