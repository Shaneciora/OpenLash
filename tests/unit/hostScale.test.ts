import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clampHostScale,
  getHostScale,
  HOST_SCALE_DEFAULT,
  HOST_SCALE_MAX,
  HOST_SCALE_MIN,
  setHostScale,
} from "../../src/web/lib/hostScale";

function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("hostScale", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  it("clamps scale to configured bounds", () => {
    expect(clampHostScale(0.1)).toBe(HOST_SCALE_MIN);
    expect(clampHostScale(5)).toBe(HOST_SCALE_MAX);
    expect(clampHostScale(1.234)).toBe(1.23);
    expect(clampHostScale(Number.NaN)).toBe(HOST_SCALE_DEFAULT);
  });

  it("persists scale in localStorage", () => {
    expect(getHostScale()).toBe(HOST_SCALE_DEFAULT);
    expect(setHostScale(1.45)).toBe(1.45);
    expect(getHostScale()).toBe(1.45);
  });
});
