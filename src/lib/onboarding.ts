const KEY = "nwep-onboarding-v1"

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(KEY) === "done"
}

export function markOnboardingComplete(): void {
  localStorage.setItem(KEY, "done")
}

export function resetOnboarding(): void {
  localStorage.removeItem(KEY)
}
