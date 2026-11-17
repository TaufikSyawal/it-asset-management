import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PhysicalCondition } from "@/types";

export interface OfflineScanItem {
  id: string;
  sessionId: string;
  assetId: string;
  location: string;
  condition: PhysicalCondition;
  employeeId?: string | null;
  notes?: string | null;
  timestamp: string;
}

const DB_NAME = "itams_offline_audit";
const DB_VERSION = 1;
const STORE_NAME = "scan_queue";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enqueue a scan item when offline
 */
export async function enqueueOfflineScan(scan: Omit<OfflineScanItem, "id" | "timestamp">): Promise<OfflineScanItem> {
  const item: OfflineScanItem = {
    ...scan,
    id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(item);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return item;
  } catch (err) {
    console.error("Failed to enqueue offline scan:", err);
    throw err;
  }
}

/**
 * Get all queued offline scans
 */
export async function getOfflineScans(): Promise<OfflineScanItem[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Remove a successfully synced item
 */
export async function removeOfflineScan(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to remove offline scan item:", err);
  }
}

/**
 * Synchronize all queued offline scans to Supabase
 */
export async function syncOfflineScans(
  onProgress?: (synced: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return { synced: 0, failed: 0 };
  }

  const items = await getOfflineScans();
  if (items.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const { error } = await supabase.rpc("record_stock_opname_scan", {
        p_session_id: item.sessionId,
        p_asset_id: item.assetId,
        p_location: item.location,
        p_condition: item.condition,
        p_employee_id: item.employeeId || null,
        p_notes: item.notes ? `${item.notes} (Synced from offline scan)` : "Synced from offline audit",
      });

      if (!error) {
        await removeOfflineScan(item.id);
        synced++;
        if (onProgress) onProgress(synced, items.length);
      } else {
        console.error("Failed to sync item:", item.id, error);
        failed++;
      }
    } catch (err) {
      console.error("Sync error for item:", item.id, err);
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Setup auto-sync on browser online event
 */
export function registerAutoSyncListener(callback?: (result: { synced: number; failed: number }) => void) {
  if (typeof window === "undefined") return () => {};

  const handleOnline = async () => {
    console.log("Device is online. Attempting to sync offline scans...");
    const res = await syncOfflineScans();
    if (callback) callback(res);
  };

  window.addEventListener("online", handleOnline);
  return () => window.removeEventListener("online", handleOnline);
}

