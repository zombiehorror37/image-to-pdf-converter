const DB_NAME = 'pdf-converter';
const DB_VERSION = 2;
const SESSION_STORE = 'session';

let dbPromise;

const getDb = async () => {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    const { openDB } = await import('idb');
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          db.createObjectStore(SESSION_STORE);
        }
      },
    });
  }
  return dbPromise;
};

// key is 'convert' or 'pdfTools'
export const saveSession = async (key, session) => {
  try {
    const db = await getDb();
    if (!db) return;
    await db.put(SESSION_STORE, { ...session, updatedAt: Date.now() }, key);
  } catch {
    // session saves are best-effort; ignore failures
  }
};

export const loadSession = async (key) => {
  try {
    const db = await getDb();
    if (!db) return null;
    return await db.get(SESSION_STORE, key);
  } catch {
    return null;
  }
};

export const clearSession = async (key) => {
  try {
    const db = await getDb();
    if (!db) return;
    await db.delete(SESSION_STORE, key);
  } catch {
    // ignore
  }
};
