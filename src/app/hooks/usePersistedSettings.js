import { useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '../lib/storage';

// Load-once / save-on-change settings backed by localStorage.
// `migrate(loaded)` is optional and runs on the loaded value before commit.
export function usePersistedSettings(key, defaults, migrate) {
  const [settings, setSettings] = useState(defaults);

  useEffect(() => {
    const loaded = loadSettings(key, defaults);
    setSettings(migrate ? migrate(loaded) : loaded);
    // Defaults / key / migrate are component-stable; load runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveSettings(key, settings);
  }, [key, settings]);

  return [settings, setSettings];
}
