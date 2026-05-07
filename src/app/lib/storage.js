// localStorage helpers. IndexedDB session storage lives in storageDb.js (Step 3).

const SETTINGS_KEY = 'pdf-converter-settings';

export const loadSettings = (defaults) => {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
};

export const saveSettings = (settings) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage may be unavailable in private modes; silently ignore
  }
};
