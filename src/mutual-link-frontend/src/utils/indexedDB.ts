interface CachedFile {
  cid: string;
  encryptedData: ArrayBuffer;
  encryptedAesKey: string;
  timestamp: number;
}

export class MedicalDataCache {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = "MedicalDataDB";
  private readonly STORE_NAME = "files";
  private readonly DB_VERSION = 1;

  async init() {
    return new Promise<void>((resolve, reject) => {
      if (!window.indexedDB) {
        console.log("이 브라우저는 IndexedDB를 지원하지 않습니다.");
        resolve();
        return;
      }

      const request = window.indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error("IndexedDB 열기 실패");
        resolve();
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log("IndexedDB 연결 성공");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: "cid" });
        }
      };
    });
  }

  async cacheFile(
    cid: string,
    encryptedData: ArrayBuffer,
    encryptedAesKey: string
  ): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([this.STORE_NAME], "readwrite");
    const store = transaction.objectStore(this.STORE_NAME);

    const file: CachedFile = {
      cid,
      encryptedData,
      encryptedAesKey,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(file);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedFile(cid: string): Promise<CachedFile | null> {
    if (!this.db) return null;

    const transaction = this.db.transaction([this.STORE_NAME], "readonly");
    const store = transaction.objectStore(this.STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(cid);
      request.onsuccess = () => {
        const file = request.result as CachedFile;
        if (!file) {
          resolve(null);
          return;
        }

        // 캐시 만료 체크 (7일)
        const now = Date.now();
        const cacheAge = now - file.timestamp;
        const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7일

        if (cacheAge > CACHE_DURATION) {
          // 만료된 캐시 삭제
          store.delete(cid);
          resolve(null);
          return;
        }

        resolve(file);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearCache(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([this.STORE_NAME], "readwrite");
    const store = transaction.objectStore(this.STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
