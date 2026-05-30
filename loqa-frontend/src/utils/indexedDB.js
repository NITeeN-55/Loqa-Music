/**
 * IndexedDB wrapper for offline/local music storage.
 * Stores file metadata + File handles (where supported).
 */
const DB_NAME = 'loqa_local';
const DB_VER  = 1;
const STORE   = 'tracks';

function open() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function tx(db, mode = 'readonly') {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function saveLocalTrack(track) {
  const db = await open();
  return new Promise((res, rej) => {
    const req = tx(db, 'readwrite').put(track);
    req.onsuccess = () => res(track);
    req.onerror   = e => rej(e.target.error);
  });
}

export async function getAllLocalTracks() {
  const db = await open();
  return new Promise((res, rej) => {
    const req = tx(db).getAll();
    req.onsuccess = e => res(e.target.result || []);
    req.onerror   = e => rej(e.target.error);
  });
}

export async function deleteLocalTrack(id) {
  const db = await open();
  return new Promise((res, rej) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

export async function clearLocalTracks() {
  const db = await open();
  return new Promise((res, rej) => {
    const req = tx(db, 'readwrite').clear();
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}
