export type SoundSettings = {
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  bgmVolume: number;
  sfxVolume: number;
};

export type AnimalMarbleId = "lion" | "cat" | "dog" | "rabbit" | "fox" | "panda" | "bear";

export type MarbleAppearance =
  | { kind: "animal"; animal: AnimalMarbleId }
  | { kind: "custom"; dataUrl: string };

export const ANIMAL_MARBLE_OPTIONS: Array<{ id: AnimalMarbleId; name: string; emoji: string }> = [
  { id: "lion", name: "사자", emoji: "🦁" },
  { id: "cat", name: "고양이", emoji: "🐱" },
  { id: "dog", name: "강아지", emoji: "🐶" },
  { id: "rabbit", name: "토끼", emoji: "🐰" },
  { id: "fox", name: "여우", emoji: "🦊" },
  { id: "panda", name: "판다", emoji: "🐼" },
  { id: "bear", name: "곰", emoji: "🐻" },
];

const SOUND_SETTINGS_KEY = "liongame.sound-settings.v1";
const MAP_SELECTION_KEY = "liongame.map-selection.v1";
const OBSTACLES_ENABLED_KEY = "liongame.obstacles-enabled.v1";
const MARBLE_APPEARANCE_KEY = "liongame.marble-appearance.v1";

export function loadSoundSettings(): SoundSettings {
  const defaults: SoundSettings = {
    bgmEnabled: true,
    sfxEnabled: true,
    bgmVolume: 70,
    sfxVolume: 80,
  };
  try {
    const raw = window.localStorage.getItem(SOUND_SETTINGS_KEY);
    if (!raw) {
      return defaults;
    }

    const settings: unknown = JSON.parse(raw);
    if (
      !settings ||
      typeof settings !== "object" ||
      typeof (settings as SoundSettings).bgmEnabled !== "boolean" ||
      typeof (settings as Partial<SoundSettings>).sfxEnabled !== "boolean"
    ) {
      return defaults;
    }
    const saved = settings as Partial<SoundSettings>;
    return {
      ...defaults,
      bgmEnabled: saved.bgmEnabled!,
      sfxEnabled: saved.sfxEnabled!,
      bgmVolume: normalizeVolume(saved.bgmVolume, defaults.bgmVolume),
      sfxVolume: normalizeVolume(saved.sfxVolume, defaults.sfxVolume),
    };
  } catch {
    return defaults;
  }
}

function normalizeVolume(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}

export function saveSoundSettings(settings: SoundSettings) {
  try {
    window.localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The lobby remains usable when browser storage is unavailable.
  }
}

export function loadMapSelection(mapCount: number) {
  try {
    const mapIndex = Number(window.localStorage.getItem(MAP_SELECTION_KEY));
    return Number.isInteger(mapIndex) && mapIndex >= 0 && mapIndex < mapCount ? mapIndex : 0;
  } catch {
    return 0;
  }
}

export function saveMapSelection(mapIndex: number) {
  try {
    window.localStorage.setItem(MAP_SELECTION_KEY, String(mapIndex));
  } catch {
    // The lobby remains usable when browser storage is unavailable.
  }
}

export function loadObstaclesEnabled() {
  try {
    const saved = window.localStorage.getItem(OBSTACLES_ENABLED_KEY);
    return saved === null ? true : saved !== "false";
  } catch {
    return true;
  }
}

export function saveObstaclesEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(OBSTACLES_ENABLED_KEY, String(enabled));
  } catch {
    // Keep the current selection usable when browser storage is unavailable.
  }
}

export function loadMarbleAppearance(): MarbleAppearance {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(MARBLE_APPEARANCE_KEY) ?? "null");
    if (!value || typeof value !== "object") return { kind: "animal", animal: "lion" };
    const appearance = value as { kind?: unknown; animal?: unknown; dataUrl?: unknown };
    if (appearance.kind === "animal" && ANIMAL_MARBLE_OPTIONS.some(({ id }) => id === appearance.animal)) {
      return { kind: "animal", animal: appearance.animal as AnimalMarbleId };
    }
    if (
      appearance.kind === "custom" &&
      typeof appearance.dataUrl === "string" &&
      /^data:image\/(png|jpeg|webp);base64,/i.test(appearance.dataUrl) &&
      appearance.dataUrl.length <= 350_000
    ) {
      return { kind: "custom", dataUrl: appearance.dataUrl };
    }
  } catch {
    // Use the default marble when browser storage is unavailable or invalid.
  }
  return { kind: "animal", animal: "lion" };
}

export function saveMarbleAppearance(appearance: MarbleAppearance) {
  try {
    window.localStorage.setItem(MARBLE_APPEARANCE_KEY, JSON.stringify(appearance));
    return true;
  } catch {
    return false;
  }
}
