type BrowserStorage = Pick<
  Storage,
  "getItem" | "key" | "length" | "removeItem"
>;

type BrowserStateTarget = {
  localStorage?: BrowserStorage;
  sessionStorage?: BrowserStorage;
};

function clearSupabaseKeys(storage?: BrowserStorage) {
  if (!storage) {
    return;
  }

  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith("sb-")) {
      keys.push(key);
    }
  }

  for (const key of keys) {
    storage.removeItem(key);
  }
}

export function clearSupabaseBrowserState(target?: BrowserStateTarget) {
  const localStorage = target?.localStorage ?? globalThis.localStorage;
  const sessionStorage = target?.sessionStorage ?? globalThis.sessionStorage;

  clearSupabaseKeys(localStorage);
  clearSupabaseKeys(sessionStorage);
}
