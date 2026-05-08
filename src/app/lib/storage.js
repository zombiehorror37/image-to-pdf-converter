// localStorage helpers. IndexedDB session storage lives in storageDb.js.

const keyFor = (key) => `pdf-converter-settings-${key}`;

// key is 'convert' or 'pdfTools'
export const loadSettings = (key, defaults) => {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(keyFor(key));
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
};

export const saveSettings = (key, settings) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(keyFor(key), JSON.stringify(settings));
  } catch {
    // localStorage may be unavailable in private modes; silently ignore
  }
};
