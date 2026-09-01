import type { AppState } from '../types';

const DB_NAME = 'hsk-memory-master';
const STORE = 'state';
const KEY = 'app';
const LS_KEY = 'hsk-memory-master:state';

/** Debounce so a fast quiz doesn't hammer the disk… */
const DEBOUNCE_MS = 400;
/** …but never let a write sit unsaved for longer than this. */
const MAX_WAIT_MS = 1500;

type Stamped = AppState & { savedAt?: number };

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (v: IDBDatabase | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
    } catch {
      done(null);
    }
  });
  return dbPromise;
}

function readLocal(): Stamped | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Stamped) : null;
  } catch {
    return null;
  }
}

function writeLocal(state: Stamped): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export interface LoadResult {
  state: AppState | null;
  /** False when storage exists but could not be read — callers must not clobber it. */
  ok: boolean;
}

export async function loadState(): Promise<LoadResult> {
  let fromIdb: Stamped | null = null;
  let idbOk = true;
  const db = await openDb();
  if (db) {
    fromIdb = await new Promise<Stamped | null>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve((req.result as Stamped) ?? null);
        req.onerror = () => {
          idbOk = false;
          resolve(null);
        };
      } catch {
        idbOk = false;
        resolve(null);
      }
    });
  } else {
    idbOk = false;
  }
  const fromLocal = readLocal();
  // The localStorage copy is the crash-safety mirror written on page hide, so it
  // can legitimately be newer than the IndexedDB record.
  const best =
    fromIdb && fromLocal
      ? (fromLocal.savedAt ?? 0) > (fromIdb.savedAt ?? 0)
        ? fromLocal
        : fromIdb
      : (fromIdb ?? fromLocal);
  return { state: best, ok: idbOk || fromLocal !== null || db !== null };
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxTimer: ReturnType<typeof setTimeout> | null = null;
let pending: Stamped | null = null;
let lastWritten: Stamped | null = null;

function clearTimers(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (maxTimer) {
    clearTimeout(maxTimer);
    maxTimer = null;
  }
}

async function flush(): Promise<void> {
  if (!pending) return;
  const state = pending;
  pending = null;
  clearTimers();
  lastWritten = state;
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(state, KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return;
    } catch {
      /* fall through to localStorage */
    }
  }
  writeLocal(state);
}

export function saveState(state: AppState): void {
  pending = { ...state, savedAt: Date.now() };
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flush();
  }, DEBOUNCE_MS);
  if (!maxTimer) {
    maxTimer = setTimeout(() => {
      maxTimer = null;
      void flush();
    }, MAX_WAIT_MS);
  }
}

export function saveNow(state: AppState): Promise<void> {
  pending = { ...state, savedAt: Date.now() };
  clearTimers();
  return flush();
}

/**
 * Best-effort synchronous save for page hide / unload, where an async
 * IndexedDB transaction is not guaranteed to complete. localStorage is
 * synchronous, so the pending answer survives even if the tab is closed
 * immediately after answering.
 */
export function flushSync(): void {
  const state = pending ?? lastWritten;
  if (!state) return;
  writeLocal(state);
}

if (typeof window !== 'undefined') {
  const onHide = () => {
    flushSync();
    void flush();
  };
  window.addEventListener('pagehide', onHide);
  window.addEventListener('beforeunload', onHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
}

export async function clearStorage(): Promise<void> {
  clearTimers();
  pending = null;
  lastWritten = null;
  const db = await openDb();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}
