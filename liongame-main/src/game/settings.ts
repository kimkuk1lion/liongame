export type SoundSettings = {
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  bgmVolume: number;
  sfxVolume: number;
};

const SOUND_SETTINGS_KEY = "liongame.sound-settings.v1";
const MAP_SELECTION_KEY = "liongame.map-selection.v1";
const OBSTACLES_ENABLED_KEY = "liongame.obstacles-enabled.v1";

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
