import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getStoredLocale,
  LOCALE_STORAGE_KEY,
  setLocale,
  syncDocumentLang,
} from "./index.js";

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    configurable: true,
  });
  return store;
}

describe("i18n locale persistence", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installLocalStorageMock();
    Object.defineProperty(globalThis, "document", {
      value: { documentElement: { lang: "en" } },
      configurable: true,
    });
  });

  afterEach(() => {
    store.clear();
  });

  it("defaults to en when unset", () => {
    expect(getStoredLocale()).toBe("en");
  });

  it("reads stored locale", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "th");
    expect(getStoredLocale()).toBe("th");
  });

  it("ignores invalid stored locale", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
    expect(getStoredLocale()).toBe("en");
  });

  it("setLocale persists and updates document lang", async () => {
    await setLocale("th");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("th");
    expect(document.documentElement.lang).toBe("th");
  });

  it("syncDocumentLang sets html lang", () => {
    syncDocumentLang("th");
    expect(document.documentElement.lang).toBe("th");
  });
});

describe("i18n format helpers", () => {
  it("formats with th-TH when locale is th", async () => {
    installLocalStorageMock();
    Object.defineProperty(globalThis, "document", {
      value: { documentElement: { lang: "en" } },
      configurable: true,
    });
    const { formatDate } = await import("./format.js");
    await setLocale("th");
    const formatted = formatDate("2024-01-15T12:00:00Z");
    expect(formatted.length).toBeGreaterThan(0);
  });
});
