import { createClient } from "@supabase/supabase-js";

const projectUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = projectUrl && publishableKey
  ? createClient(projectUrl, publishableKey)
  : null;

const GUEST_MODE_KEY = "liongame.guest-mode.v1";

export function isSupabaseConfigured() {
  return supabase !== null;
}

export function isGuestMode() {
  try {
    return window.localStorage.getItem(GUEST_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setGuestMode(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(GUEST_MODE_KEY, "true");
    else window.localStorage.removeItem(GUEST_MODE_KEY);
  } catch {
    // Playing as a guest remains possible when browser storage is unavailable.
  }
}
