import { useState, useEffect } from "react"
import { Globe, Palette, ShieldCheck, Code2, ChevronLeft, ChevronRight, Info, Download } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { t, TranslationKey } from "@/lib/i18n"
import type { BrowserSettings } from "@/lib/settings"


type Section = "general" | "appearance" | "privacy" | "developers" | "about"

const SECTIONS: {
  id: Section
  Icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "general",    Icon: Globe       },
  { id: "appearance", Icon: Palette     },
  { id: "privacy",    Icon: ShieldCheck },
  { id: "developers", Icon: Code2       },
  { id: "about",      Icon: Info        },
]


function SettingsGroup({ label, children, isMobile }: { label?: string; children: React.ReactNode; isMobile?: boolean }) {
  return (
    <div className="mb-5">
      {label && (
        <p className={cn(
          "font-medium uppercase tracking-widest text-foreground/40 mb-1.5 px-1",
          isMobile ? "text-[12px]" : "text-[11px]",
        )}>
          {label}
        </p>
      )}
      <div className={cn(
        "rounded-xl overflow-hidden",
        "bg-white dark:bg-[#2c2c2e]",
        "border border-black/[0.08] dark:border-white/[0.06]",
        "divide-y divide-black/[0.06] dark:divide-white/[0.05]",
      )}>
        {children}
      </div>
    </div>
  )
}

function SettingsRow({
  label,
  description,
  children,
  isMobile,
  stack,
}: {
  label: string
  description?: string
  children?: React.ReactNode
  isMobile?: boolean
  stack?: boolean
}) {
  if (stack) {
    return (
      <div className="px-4 py-3.5">
        <p className="text-[16px] text-foreground leading-snug">{label}</p>
        {description && (
          <p className="text-[13px] text-foreground/45 mt-0.5 leading-snug">{description}</p>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 px-4",
      isMobile ? "py-3.5 min-h-[54px]" : "py-3 min-h-[50px]",
    )}>
      <div className="min-w-0 flex-1">
        <p className={cn("text-foreground leading-tight", isMobile ? "text-[16px]" : "text-[13px]")}>{label}</p>
        {description && (
          <p className={cn("text-foreground/50 mt-0.5 leading-snug", isMobile ? "text-[13px]" : "text-[11.5px]")}>{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fullWidth,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  fullWidth?: boolean
}) {
  return (
    <div className={cn(
      "flex rounded-[7px] p-[3px] bg-black/[0.07] dark:bg-white/[0.07] gap-[2px]",
      fullWidth && "w-full",
    )}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[5px] font-medium leading-none transition-all",
            fullWidth ? "flex-1 py-[6px] text-[14px]" : "px-3 py-[4px] text-[12px]",
            value === opt.value
              ? "bg-white dark:bg-[#3a3a3c] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.10),0_0_0_0.5px_rgba(0,0,0,0.06)]"
              : "text-foreground/50 hover:text-foreground/70",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200",
        value ? "bg-[#0a84ff]" : "bg-black/20 dark:bg-white/20",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200",
          value ? "translate-x-[19px]" : "translate-x-[3px]",
        )}
      />
    </button>
  )
}

const inputCls = cn(
  "h-7 rounded-md px-2.5 text-[12px]",
  "border border-black/[0.1] dark:border-white/[0.1] bg-transparent",
  "text-foreground placeholder:text-foreground/30",
  "outline-none focus:ring-2 focus:ring-[#0a84ff]/30",
  "disabled:opacity-40 disabled:cursor-not-allowed transition-opacity",
)


const LOCALES = [
  { id: "en",    label: "English"            },
  { id: "fr",    label: "Français"           },
  { id: "es",    label: "Español"            },
  { id: "de",    label: "Deutsch"            },
  { id: "it",    label: "Italiano"           },
  { id: "pt-BR", label: "Português (Brasil)" },
  { id: "nl",    label: "Nederlands"         },
  { id: "sv",    label: "Svenska"            },
  { id: "nb",    label: "Norsk"              },
  { id: "da",    label: "Dansk"              },
  { id: "ru",    label: "Русский"            },
  { id: "pl",    label: "Polski"             },
  { id: "uk",    label: "Українська"         },
  { id: "zh-CN", label: "中文（简体）"        },
  { id: "zh-TW", label: "中文（繁體）"        },
  { id: "ja",    label: "日本語"             },
  { id: "ko",    label: "한국어"             },
  { id: "tr",    label: "Türkçe"            },
  { id: "cs",    label: "Čeština"           },
  { id: "ro",    label: "Română"            },
  { id: "hu",    label: "Magyar"            },
  { id: "el",    label: "Ελληνικά"          },
  { id: "id",    label: "Indonesia"         },
  { id: "vi",    label: "Tiếng Việt"        },
  { id: "hi",    label: "हिन्दी"            },
  { id: "mr",    label: "मराठी"             },
  { id: "bn",    label: "বাংলা"             },
  { id: "ta",    label: "தமிழ்"             },
  { id: "te",    label: "తెలుగు"            },
  { id: "ar",    label: "العربية"           },
  { id: "he",    label: "עברית"             },
  { id: "fa",    label: "فارسی"             },
  { id: "ur",    label: "اردو"              },
  { id: "ps",    label: "پښتو"              },
  { id: "sd",    label: "سنڌي"              },
  { id: "ug",    label: "ئۇيغۇرچە"          },
  { id: "ckb",   label: "کوردی"             },
  { id: "yi",    label: "ייִדיש"            },
]

function GeneralSection({
  settings,
  update,
  isMobile,
}: {
  settings: BrowserSettings
  update: <K extends keyof BrowserSettings>(key: K, val: BrowserSettings[K]) => void
  isMobile?: boolean
}) {
  const homepageActive = settings.newTabAction === "homepage"

  return (
    <>
      <SettingsGroup label={t("settings.language")} isMobile={isMobile}>
        <div className={cn("px-4", isMobile ? "py-3" : "py-2.5")}>
          <select
            value={localStorage.getItem("eclipse-locale") ?? "en"}
            onChange={(e) => {
              localStorage.setItem("eclipse-locale", e.target.value)
              window.location.reload()
            }}
            className={cn(selectCls, isMobile ? "w-full h-9 text-[15px]" : "w-full")}
          >
            {LOCALES.map(({ id: localeId, label }) => (
              <option key={localeId} value={localeId}>{label}</option>
            ))}
          </select>
        </div>
      </SettingsGroup>

      <SettingsGroup label={t("settings.newTab")} isMobile={isMobile}>
        <SettingsRow label={t("settings.openNewTabsWith")} isMobile={isMobile} stack={isMobile}>
          <SegmentedControl
            options={[
              { value: "empty",    label: t("settings.empty")    },
              { value: "homepage", label: t("settings.homepage")  },
            ]}
            value={settings.newTabAction}
            onChange={(v) => update("newTabAction", v)}
            fullWidth={isMobile}
          />
        </SettingsRow>
        <SettingsRow
          label={t("settings.homepageUrl")}
          description={
            homepageActive
              ? t("settings.homepageUrlActive")
              : t("settings.homepageUrlInactive")
          }
          isMobile={isMobile}
          stack={isMobile}
        >
          <input
            type="text"
            value={settings.homepage}
            onChange={(e) => update("homepage", e.target.value)}
            disabled={!homepageActive}
            placeholder="web://…"
            className={cn(inputCls, isMobile ? "w-full" : "w-44", "font-mono")}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup label={t("settings.addressBar")} isMobile={isMobile}>
        <SettingsRow
          label={t("settings.searchBookmarks")}
          description={t("settings.searchBookmarksDesc")}
          isMobile={isMobile}
        >
          <Toggle value={settings.searchBookmarks} onChange={(v) => update("searchBookmarks", v)} />
        </SettingsRow>
        <SettingsRow
          label={t("settings.searchHistory")}
          description={t("settings.searchHistoryDesc")}
          isMobile={isMobile}
        >
          <Toggle value={settings.searchHistory} onChange={(v) => update("searchHistory", v)} />
        </SettingsRow>
      </SettingsGroup>
    </>
  )
}


const selectCls = cn(
  "h-7 rounded-md ps-2.5 pe-7 text-[12px]",
  "border border-black/[0.1] dark:border-white/[0.1]",
  "bg-white dark:bg-[#3a3a3c] text-foreground",
  "outline-none focus:ring-2 focus:ring-[#0a84ff]/30",
  "appearance-none cursor-pointer",
)

const ZOOM_STEPS = [
  { value: 0.75, label: "75%"            },
  { value: 0.9,  label: "90%"            },
  { value: 1.0,  label: t("settings.zoomDefault", { percent: "100" }) },
  { value: 1.1,  label: "110%"           },
  { value: 1.25, label: "125%"           },
  { value: 1.5,  label: "150%"           },
  { value: 1.75, label: "175%"           },
  { value: 2.0,  label: "200%"           },
]

const UI_SCALE_STEPS = [
  { value: 0.75, label: "75%"            },
  { value: 0.85, label: "85%"            },
  { value: 0.9,  label: "90%"            },
  { value: 0.95, label: "95%"            },
  { value: 1.0,  label: t("settings.zoomDefault", { percent: "100" }) },
  { value: 1.05, label: "105%"           },
  { value: 1.1,  label: "110%"           },
  { value: 1.15, label: "115%"           },
  { value: 1.25, label: "125%"           },
]

function AppearanceSection({
  settings,
  update,
  isMobile,
}: {
  settings: BrowserSettings
  update: <K extends keyof BrowserSettings>(key: K, val: BrowserSettings[K]) => void
  isMobile?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const currentTheme = theme === "light" || theme === "dark" ? theme : "system"

  return (
    <>
      <SettingsGroup label={t("settings.theme")} isMobile={isMobile}>
        <SettingsRow label={t("settings.colorScheme")} isMobile={isMobile} stack={isMobile}>
          <SegmentedControl
            options={[
              { value: "light",  label: t("settings.light") },
              { value: "dark",   label: t("settings.dark")  },
              { value: "system", label: t("settings.auto")  },
            ]}
            value={currentTheme}
            onChange={setTheme}
            fullWidth={isMobile}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup label={t("settings.scaling")} isMobile={isMobile}>
        <SettingsRow label={t("settings.browserUiScale")} description={t("settings.browserUiScaleDesc")} isMobile={isMobile} stack={isMobile}>
          <select
            value={settings.uiScale}
            onChange={(e) => update("uiScale", parseFloat(e.target.value))}
            className={cn(selectCls, isMobile && "w-full h-9 text-[15px]")}
          >
            {UI_SCALE_STEPS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow label={t("settings.defaultPageZoom")} description={t("settings.defaultPageZoomDesc")} isMobile={isMobile} stack={isMobile}>
          <select
            value={settings.defaultZoom}
            onChange={(e) => update("defaultZoom", parseFloat(e.target.value))}
            className={cn(selectCls, isMobile && "w-full h-9 text-[15px]")}
          >
            {ZOOM_STEPS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </SettingsRow>
      </SettingsGroup>
    </>
  )
}


function PrivacySection({
  historyEnabled,
  onToggleHistory,
  onClearHistory,
  onOpenHistory,
  isMobile,
}: {
  historyEnabled: boolean
  onToggleHistory: (v: boolean) => void
  onClearHistory: () => void
  onOpenHistory: () => void
  isMobile?: boolean
}) {
  const [justCleared, setJustCleared] = useState(false)

  const handleClear = () => {
    onClearHistory()
    setJustCleared(true)
    setTimeout(() => setJustCleared(false), 2500)
  }

  return (
    <SettingsGroup label={t("settings.browsingData")} isMobile={isMobile}>
      <SettingsRow
        label={t("settings.recordBrowsingHistory")}
        description={t("settings.recordBrowsingHistoryDesc")}
        isMobile={isMobile}
      >
        <Toggle value={historyEnabled} onChange={onToggleHistory} />
      </SettingsRow>
      <SettingsRow
        label={t("settings.browsingHistory")}
        description={t("settings.browsingHistoryDesc")}
        isMobile={isMobile}
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenHistory}
            className={cn(
              "rounded-md font-medium transition-colors",
              "bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.09] dark:hover:bg-white/[0.11]",
              "text-foreground/70 hover:text-foreground",
              isMobile ? "h-8 px-4 text-[14px]" : "h-7 px-3 text-[12px]",
            )}
          >
            {t("settings.viewBtn")}
          </button>
          <button
            onClick={handleClear}
            disabled={justCleared}
            className={cn(
              "rounded-md font-medium transition-colors",
              isMobile ? "h-8 px-4 text-[14px]" : "h-7 px-3 text-[12px]",
              justCleared
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/15 dark:text-[#ff453a] dark:bg-[#ff453a]/10 dark:hover:bg-[#ff453a]/15",
            )}
          >
            {justCleared ? t("settings.clearedBtn") : t("settings.clearBtn")}
          </button>
        </div>
      </SettingsRow>
    </SettingsGroup>
  )
}


function DevResetButton({
  label,
  description,
  onReset,
  isMobile,
}: {
  label: string
  description: string
  onReset?: () => void
  isMobile?: boolean
}) {
  const [done, setDone] = useState(false)

  const handleClick = () => {
    onReset?.()
    setDone(true)
    setTimeout(() => setDone(false), 2500)
  }

  return (
    <SettingsRow label={label} description={description} isMobile={isMobile}>
      <button
        onClick={handleClick}
        disabled={done}
        className={cn(
          "rounded-md font-medium transition-colors",
          isMobile ? "h-8 px-4 text-[14px]" : "h-7 px-3 text-[12px]",
          done
            ? "bg-green-500/10 text-green-600 dark:text-green-400"
            : "bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.09] dark:hover:bg-white/[0.11] text-foreground/70 hover:text-foreground",
        )}
      >
        {done ? t("settings.doneBtn") : t("settings.resetBtn")}
      </button>
    </SettingsRow>
  )
}

function DevelopersSection({
  settings,
  update,
  onResetOnboarding,
  isMobile,
}: {
  settings: BrowserSettings
  update: <K extends keyof BrowserSettings>(key: K, val: BrowserSettings[K]) => void
  onResetOnboarding?: () => void
  isMobile?: boolean
}) {
  return (
    <>
      <SettingsGroup label={t("settings.interface")} isMobile={isMobile}>
        <SettingsRow
          label={t("settings.mobileUi")}
          description={t("settings.mobileUiDesc")}
          isMobile={isMobile}
          stack={isMobile}
        >
          <SegmentedControl
            options={[
              { value: "auto",    label: t("settings.mobileAuto")    },
              { value: "mobile",  label: t("settings.mobileMobile")  },
              { value: "desktop", label: t("settings.mobileDesktop") },
            ]}
            value={settings.developerForceMobileUi}
            onChange={(v) => update("developerForceMobileUi", v)}
            fullWidth={isMobile}
          />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup label={t("settings.onboarding")} isMobile={isMobile}>
        <DevResetButton
          label={t("settings.resetWelcomeGuide")}
          description={t("settings.resetWelcomeGuideDesc")}
          onReset={onResetOnboarding}
          isMobile={isMobile}
        />
      </SettingsGroup>
    </>
  )
}


function AboutSection({
  currentVersion,
  updateAvailable,
  onUpdate,
  isMobile,
}: {
  currentVersion: string
  updateAvailable: { version: string; releaseUrl: string } | null
  onUpdate: () => void
  isMobile?: boolean
}) {
  return (
    <SettingsGroup label="Eclipse Browser" isMobile={isMobile}>
      <SettingsRow label="Version" isMobile={isMobile}>
        <span className={cn("text-foreground/50", isMobile ? "text-[14px]" : "text-[12px]")}>
          {currentVersion ? `v${currentVersion}` : "…"}
        </span>
      </SettingsRow>
      {updateAvailable ? (
        <SettingsRow label={`Update available: v${updateAvailable.version}`} isMobile={isMobile}>
          <button
            onClick={onUpdate}
            className={cn(
              "rounded-md font-medium transition-colors flex items-center gap-1.5",
              "bg-[#0a84ff]/10 text-[#0a84ff] hover:bg-[#0a84ff]/15",
              isMobile ? "h-8 px-4 text-[14px]" : "h-7 px-3 text-[12px]",
            )}
          >
            <Download className={isMobile ? "size-[15px]" : "size-[12px]"} />
            Update Now
          </button>
        </SettingsRow>
      ) : currentVersion ? (
        <SettingsRow label="Up to date" isMobile={isMobile}>
          <span className={cn("text-green-600 dark:text-green-400 font-medium", isMobile ? "text-[14px]" : "text-[12px]")}>✓</span>
        </SettingsRow>
      ) : null}
    </SettingsGroup>
  )
}


function SectionContent({
  section,
  settings,
  update,
  onClearHistory,
  onOpenHistory,
  onResetOnboarding,
  isMobile,
  currentVersion,
  updateAvailable,
  onUpdate,
}: {
  section: Section
  settings: BrowserSettings
  update: <K extends keyof BrowserSettings>(key: K, val: BrowserSettings[K]) => void
  onClearHistory: () => void
  onOpenHistory: () => void
  onResetOnboarding?: () => void
  isMobile?: boolean
  currentVersion: string
  updateAvailable: { version: string; releaseUrl: string } | null
  onUpdate: () => void
}) {
  if (section === "general")    return <GeneralSection settings={settings} update={update} isMobile={isMobile} />
  if (section === "appearance") return <AppearanceSection settings={settings} update={update} isMobile={isMobile} />
  if (section === "privacy")    return <PrivacySection historyEnabled={settings.historyEnabled} onToggleHistory={(v) => update("historyEnabled", v)} onClearHistory={onClearHistory} onOpenHistory={onOpenHistory} isMobile={isMobile} />
  if (section === "developers") return <DevelopersSection settings={settings} update={update} onResetOnboarding={onResetOnboarding} isMobile={isMobile} />
  if (section === "about")      return <AboutSection currentVersion={currentVersion} updateAvailable={updateAvailable} onUpdate={onUpdate} isMobile={isMobile} />
  return null
}


export function SettingsPage({
  settings,
  onChange,
  onClearHistory,
  onOpenHistory,
  onResetOnboarding,
  isMobile = false,
  currentVersion = "",
  updateAvailable = null,
  onUpdate,
}: {
  settings: BrowserSettings
  onChange: (s: BrowserSettings) => void
  onClearHistory: () => void
  onOpenHistory: () => void
  onResetOnboarding?: () => void
  isMobile?: boolean
  currentVersion?: string
  updateAvailable?: { version: string; releaseUrl: string } | null
  onUpdate?: () => void
}) {
  const [section, setSection] = useState<Section | null>(null)

  useEffect(() => {
    if (!isMobile && section === null) setSection("general")
  }, [isMobile]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof BrowserSettings>(key: K, val: BrowserSettings[K]) =>
    onChange({ ...settings, [key]: val })

  const effectiveSection: Section = section ?? "general"

  if (isMobile) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f2f2f7] dark:bg-[#1c1c1e]">
        {section === null ? (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 pt-6 pb-4">
              <h1 className="text-[28px] font-bold text-foreground tracking-tight">{t("settings.settingsTitle")}</h1>
            </div>
            <div className="mx-4 rounded-xl overflow-hidden bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.06] divide-y divide-black/[0.06] dark:divide-white/[0.05]">
              {SECTIONS.map(({ id, Icon }) => (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-start active:bg-black/5 dark:active:bg-white/5 transition-colors"
                >
                  <Icon className="size-[18px] shrink-0 text-foreground/40" />
                  <span className="flex-1 text-[16px] text-foreground">{t(`settings.${id}` as TranslationKey)}</span>
                  <ChevronRight className="size-4 text-foreground/25 shrink-0 rtl:scale-x-[-1]" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">

            <div className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center px-3 pt-4 pb-2">
              <button
                onClick={() => setSection(null)}
                className="flex items-center gap-0.5 text-[#0a84ff] text-[16px] justify-self-start"
              >
                <ChevronLeft className="size-5 shrink-0 rtl:scale-x-[-1]" />
                <span className="hidden min-[260px]:inline truncate max-w-[80px]">{t("settings.settingsTitle")}</span>
              </button>
              <span className="text-[17px] font-semibold text-foreground text-center">
                {t(`settings.${section}` as TranslationKey)}
              </span>
              <div />
            </div>

            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-10">
              <SectionContent
                section={section}
                settings={settings}
                update={update}
                onClearHistory={onClearHistory}
                onOpenHistory={onOpenHistory}
                onResetOnboarding={onResetOnboarding}
                isMobile={true}
                currentVersion={currentVersion}
                updateAvailable={updateAvailable}
                onUpdate={onUpdate ?? (() => {})}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">


      <div className="w-[180px] shrink-0 flex flex-col py-2 px-1.5 gap-0.5 overflow-y-auto border-e border-black/[0.07] dark:border-white/[0.05] bg-white dark:bg-[#252527]">
        {SECTIONS.map(({ id, Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={cn(
              "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-[13px] transition-colors text-start",
              effectiveSection === id
                ? "bg-[#0a84ff] text-white"
                : "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/6 hover:text-foreground",
            )}
          >
            <Icon className="size-[13px] shrink-0" />
            {t(`settings.${id}` as TranslationKey)}
          </button>
        ))}
      </div>


      <div className="flex-1 overflow-y-auto bg-[#f5f5f7] dark:bg-[#1c1c1e]">
        <div className="max-w-[500px] mx-auto px-8 pt-7 pb-12">
          <h2 className="text-[18px] font-semibold text-foreground mb-5 tracking-tight">
            {t(`settings.${effectiveSection}` as TranslationKey)}
          </h2>
          <SectionContent
            section={effectiveSection}
            settings={settings}
            update={update}
            onClearHistory={onClearHistory}
            onOpenHistory={onOpenHistory}
            onResetOnboarding={onResetOnboarding}
            currentVersion={currentVersion}
            updateAvailable={updateAvailable}
            onUpdate={onUpdate ?? (() => {})}
          />
        </div>
      </div>

    </div>
  )
}
