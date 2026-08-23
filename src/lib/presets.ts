"use client";

export interface SavedPreset {
  name: string;
  /** URL search params snapshot, e.g. { from: "...", to: "...", group: "hour" } */
  params: Record<string, string>;
}

const KEY = "ta-filter-presets";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadPresets(): SavedPreset[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (p): p is SavedPreset =>
            !!p &&
            typeof p === "object" &&
            typeof (p as SavedPreset).name === "string" &&
            typeof (p as SavedPreset).params === "object"
        )
      : [];
  } catch {
    return [];
  }
}

function persist(presets: SavedPreset[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(presets));
}

export function savePreset(name: string, params: Record<string, string>): SavedPreset[] {
  const presets = loadPresets().filter((p) => p.name !== name);
  presets.push({ name, params });
  persist(presets);
  return presets;
}

export function deletePreset(name: string): SavedPreset[] {
  const presets = loadPresets().filter((p) => p.name !== name);
  persist(presets);
  return presets;
}
