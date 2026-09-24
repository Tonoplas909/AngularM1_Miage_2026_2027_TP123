/*
 * Fichier de préparation exécuté avant chaque fichier de test
 * (option `setupFiles` du builder `@angular/build:unit-test`).
 *
 * Pourquoi il est nécessaire : Node 26 expose un `localStorage` natif qui n'est
 * réellement disponible qu'avec l'option `--localstorage-file`. Ce global masque
 * celui fourni par jsdom, et toute lecture renvoie `undefined`. Or `AuthService`
 * lit `localStorage` dès sa construction : sans ce correctif, aucun test
 * touchant à l'authentification ne peut même instancier le service.
 *
 * On installe donc une implémentation en mémoire, suffisante pour les tests et
 * sans effet sur le code de l'application (qui, dans un navigateur réel,
 * utilise le vrai `localStorage`).
 */

const store = new Map<string, string>();

const memoryStorage: Storage = {
  get length(): number {
    return store.size;
  },
  clear(): void {
    store.clear();
  },
  getItem(key: string): string | null {
    return store.get(key) ?? null;
  },
  key(index: number): string | null {
    return [...store.keys()][index] ?? null;
  },
  removeItem(key: string): void {
    store.delete(key);
  },
  setItem(key: string, value: string): void {
    store.set(key, String(value));
  },
};

function hasUsableLocalStorage(): boolean {
  try {
    return typeof globalThis.localStorage?.getItem === 'function';
  } catch {
    // Certains environnements lèvent une exception à la simple lecture.
    return false;
  }
}

if (!hasUsableLocalStorage()) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}
