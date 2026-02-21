export interface BrowserSettings {
  homepage: string
  newTabAction: "empty" | "homepage"
  defaultZoom: number
  uiScale: number
  searchBookmarks: boolean
  searchHistory: boolean
  historyEnabled: boolean
  developerForceMobileUi: "auto" | "mobile" | "desktop"
}

export const DEFAULT_SETTINGS: BrowserSettings = {
  homepage: "",
  newTabAction: "empty",
  defaultZoom: 1.0,
  uiScale: 1.0,
  searchBookmarks: true,
  searchHistory: true,
  historyEnabled: true,
  developerForceMobileUi: "auto",
}

const KEY = "nwep-settings-v1"

export function loadSettings(): BrowserSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: BrowserSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
