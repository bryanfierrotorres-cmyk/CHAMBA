// Mock en memoria de AsyncStorage para harnesses de validación (Node).
const store = {};
const AsyncStorage = {
  getItem: async (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: async (k, v) => { store[k] = String(v); },
  removeItem: async (k) => { delete store[k]; },
  clear: async () => { for (const k of Object.keys(store)) delete store[k]; },
  __dump: () => ({ ...store }),
};
module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
