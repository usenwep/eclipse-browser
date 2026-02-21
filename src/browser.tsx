import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
  createContext,
  useContext,
  FormEvent,
} from "react"
import { createPortal } from "react-dom"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { useTheme } from "next-themes"
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  RotateCw,
  Minus,
  Maximize2,
  Plus,
  X,
  ShieldCheck,
  ShieldAlert,
  Check,
  WifiOff,
  Unplug,
  ServerCrash,
  CircleAlert,
  Scissors,
  Copy,
  Clipboard,
  ExternalLink,
  Download,
  Link2,
  Share2,
  Globe,
  MoreHorizontal,
  Bookmark,
  BookmarkPlus,
  BookmarkX,
  Folder,
  Pencil,
  Trash2,
  Settings,
  History,
  ZoomIn,
  ZoomOut,
  Search,
  Printer,
  Clock,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  BookmarkNode,
  BookmarkTree,
  loadBookmarks,
  saveBookmarks,
  addNode,
  updateNode,
  removeNode,
  removeByUrl,
  isBookmarked,
  flatBookmarks,
  getNodeAtPath,
  getFolderTitle,
  reorderInParent,
  moveNodeIntoFolder,
  genId,
} from "@/lib/bookmarks"
import { type BrowserSettings, loadSettings, saveSettings } from "@/lib/settings"
import { isOnboardingComplete, markOnboardingComplete, resetOnboarding } from "@/lib/onboarding"
import { save as saveDialog } from "@tauri-apps/plugin-dialog"
import { writeTextFile } from "@tauri-apps/plugin-fs"
import { openUrl } from "@tauri-apps/plugin-opener"
import { SettingsPage } from "@/components/settings-page"
import { OnboardingOverlay } from "@/components/onboarding-overlay"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

const appWindow = getCurrentWindow()

const MAX_TAB_W = 200
const MIN_TAB_W = 72


interface LogStep {
  name: string
  ok: boolean
  detail?: string | null
}

interface NwepResult {
  ok: boolean
  error?: string | null
  status?: string | null
  status_details?: string | null
  body?: string | null
  headers: Array<{ name: string; value: string }>
  connection?: {
    client_node_id: string
    server_node_id: string
    server_pubkey: string
  } | null
  log: LogStep[]
}

interface ConnectionInfo {
  clientNodeId?: string
  serverNodeId?: string
  serverPubkey?: string
  log: LogStep[]
}

interface Tab {
  id: string
  title: string
  url: string
  content?: string
  error?: string
  connectionInfo?: ConnectionInfo
  history: string[]
  historyIndex: number
}

interface HistoryEntry {
  url: string
  title: string
  timestamp?: number
}

interface Suggestion {
  type: "bookmark" | "history"
  url: string
  title: string
}


const HISTORY_KEY = "nwep-history-v1"
const MAX_HISTORY = 128

function loadGlobalHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") } catch { return [] }
}

function saveGlobalHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
}


function WindowControls() {
  return (
    <div className="flex items-stretch shrink-0 h-full">
      <button
        onClick={() => appWindow.minimize()}
        className="w-11 flex items-center justify-center text-foreground/50 hover:bg-black/8 dark:hover:bg-white/10 hover:text-foreground/80 transition-colors"
        aria-label={t("windowControls.minimize")}
      >
        <Minus className="size-[13px]" />
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        className="w-11 flex items-center justify-center text-foreground/50 hover:bg-black/8 dark:hover:bg-white/10 hover:text-foreground/80 transition-colors"
        aria-label={t("windowControls.maximize")}
      >
        <Maximize2 className="size-[12px]" />
      </button>
      <button
        onClick={() => appWindow.close()}
        className="w-11 flex items-center justify-center rounded-tr-[10px] text-foreground/50 hover:bg-red-500 hover:text-white transition-colors"
        aria-label={t("windowControls.close")}
      >
        <X className="size-[13px]" />
      </button>
    </div>
  )
}


function TabItem({
  tab,
  isActive,
  onSelect,
  onClose,
  canClose,
}: {
  tab: Tab
  isActive: boolean
  onSelect: () => void
  onClose: (e: React.MouseEvent) => void
  canClose: boolean
}) {
  const title = tab.url === "about:settings" ? t("tab.settings") : tab.url === "about:history" ? t("tab.history") : tab.url.startsWith("about:") ? t("tab.newTab") : tab.title || tab.url

  return (
    <button
      onClick={onSelect}
      title={title}
      data-active={isActive}
      className={cn("w-full",
        "group flex items-center gap-1.5 h-[26px] px-2.5 rounded-md transition-all select-none",
        isActive
          ? "bg-white dark:bg-[#3a3a3c] text-foreground shadow-[0_0_0_0.5px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.07)] dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.08)]"
          : "text-foreground/50 hover:bg-black/6 dark:hover:bg-white/6 hover:text-foreground/80"
      )}
    >
      <span className="size-3 shrink-0 rounded-sm bg-current opacity-20 flex-none" />
      <span className="flex-1 min-w-0 truncate text-start text-[12.5px] leading-none">
        {title}
      </span>
      {canClose && (
        <span
          role="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "size-[14px] shrink-0 rounded flex items-center justify-center",
            "opacity-40 hover:opacity-100",
            "hover:bg-black/10 dark:hover:bg-white/15",
            "transition-opacity"
          )}
        >
          <X className="size-[9px]" />
        </span>
      )}
    </button>
  )
}


function SortableTab({
  tab,
  isActive,
  width,
  onSelect,
  onClose,
  canClose,
}: {
  tab: Tab
  isActive: boolean
  width: number
  onSelect: () => void
  onClose: (e: React.MouseEvent) => void
  canClose: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        width,
        flexShrink: 0,
        flexGrow: 0,
        transform: CSS.Transform.toString(transform) ?? undefined,
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={cn("touch-none", isDragging && "opacity-50")}
      {...attributes}
      {...listeners}
    >
      <TabItem
        tab={tab}
        isActive={isActive}
        onSelect={onSelect}
        onClose={onClose}
        canClose={canClose}
      />
    </div>
  )
}

function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onReorderTabs,
}: {
  tabs: Tab[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onNewTab: () => void
  onReorderTabs: (reordered: Tab[]) => void
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [stripW, setStripW] = useState(800)

  const tabSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setStripW(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const active = scroll.querySelector("[data-active='true']") as HTMLElement | null
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
  }, [activeTabId])

  const NEW_TAB_BTN_W = 36
  const STRIP_PADDING = 6
  const availForTabs = Math.max(0, stripW - NEW_TAB_BTN_W - STRIP_PADDING)
  const tabW = Math.max(
    MIN_TAB_W,
    Math.min(MAX_TAB_W, tabs.length > 0 ? availForTabs / tabs.length : MAX_TAB_W)
  )
  const needsScroll = tabs.length * MIN_TAB_W + NEW_TAB_BTN_W + STRIP_PADDING > stripW

  const handleTabDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIdx = tabs.findIndex((tab) => tab.id === active.id)
    const newIdx = tabs.findIndex((tab) => tab.id === over.id)
    if (oldIdx !== -1 && newIdx !== -1) onReorderTabs(arrayMove(tabs, oldIdx, newIdx))
  }

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "flex items-center h-[38px] shrink-0 select-none",
        "bg-[#e9e9eb] dark:bg-[#1e1e21]",
        "border-b border-black/[0.08] dark:border-white/[0.05]",
      )}
    >
      <div ref={stripRef} className="flex-1 min-w-0 flex items-center overflow-hidden h-full">
        <DndContext sensors={tabSensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
          <SortableContext items={tabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
            <div
              ref={scrollRef}
              className={cn(
                "flex items-center ps-1.5 gap-0.5 h-full",
                needsScroll && "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              )}
            >
              {tabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  width={tabW}
                  onSelect={() => onSelectTab(tab.id)}
                  onClose={(e) => { e.stopPropagation(); onCloseTab(tab.id) }}
                  canClose={tabs.length > 1}
                />
              ))}
              <button
                onClick={onNewTab}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  "flex-none size-7 mx-0.5 rounded-md flex items-center justify-center",
                  "text-foreground/50 hover:bg-black/8 dark:hover:bg-white/10",
                  "hover:text-foreground/80 transition-colors"
                )}
                aria-label={t("nav.newTab")}
              >
                <Plus className="size-[14px]" />
              </button>
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <WindowControls />
    </div>
  )
}


const NWEP_DEFAULT_PORT = "6937"


function prettyNwepUrl(url: string): string {
  if (!url.startsWith("web://")) return url
  const rest = url.slice("web://".length)
  if (!rest.startsWith("[")) return url
  const close = rest.indexOf("]")
  if (close === -1) return url
  const nodeId = rest.slice(1, close)
  const afterBracket = rest.slice(close + 1) // e.g. ":6937/path" or "/path"
  const slashIdx = afterBracket.indexOf("/")
  const portPart = slashIdx === -1 ? afterBracket : afterBracket.slice(0, slashIdx)
  const path = slashIdx === -1 ? "/" : afterBracket.slice(slashIdx)
  const port = portPart.startsWith(":") ? portPart.slice(1) : NWEP_DEFAULT_PORT
  const portSuffix = port === NWEP_DEFAULT_PORT ? "" : `:${port}`
  return `web://${nodeId}${portSuffix}${path}`
}

function normalizeNwepUrl(raw: string): string {
  let s = raw.trim()
  if (!s.includes("://")) s = `web://${s}`

  const schemeEnd = s.indexOf("://") + 3
  const rest = s.slice(schemeEnd)

  let authority: string
  let path: string

  if (rest.startsWith("[")) {
    const close = rest.indexOf("]")
    if (close === -1) return `web://[${rest.slice(1)}]:6937/`
    const afterBracket = rest.slice(close + 1)
    const slashIdx = afterBracket.indexOf("/")
    authority = rest.slice(0, close + 1) + (slashIdx === -1 ? afterBracket : afterBracket.slice(0, slashIdx))
    path = slashIdx === -1 ? "/" : afterBracket.slice(slashIdx)
  } else {
    const slashIdx = rest.indexOf("/")
    authority = slashIdx === -1 ? rest : rest.slice(0, slashIdx)
    path = slashIdx === -1 ? "/" : rest.slice(slashIdx)
  }

  let nodeId: string
  let port: string

  if (authority.startsWith("[")) {
    const close = authority.indexOf("]")
    nodeId = authority.slice(1, close)
    const portPart = authority.slice(close + 1)
    port = portPart.startsWith(":") ? portPart.slice(1) : "6937"
  } else {
    const colonIdx = authority.indexOf(":")
    if (colonIdx === -1) {
      nodeId = authority
      port = "6937"
    } else {
      nodeId = authority.slice(0, colonIdx)
      port = authority.slice(colonIdx + 1)
    }
  }

  return `web://[${nodeId}]:${port}${path}`
}

function getDisplayHost(url: string): string {
  if (!url || url === "about:newtab") return ""
  if (url === "about:settings") return "Settings"
  if (url === "about:history") return "History"
  if (url.startsWith("about:")) return url
  if (url.startsWith("web://")) {
    const rest = url.slice(6)
    if (rest.startsWith("[")) {
      const close = rest.indexOf("]")
      return close === -1 ? rest : rest.slice(1, close)
    }
    return rest.split(/[:/]/)[0]
  }
  try { return new URL(url).hostname } catch { return url }
}

function SuggestionItem({
  suggestion,
  isSelected,
  onSelect,
  onHover,
}: {
  suggestion: Suggestion
  isSelected: boolean
  onSelect: () => void
  onHover: () => void
}) {
  const host = getDisplayHost(suggestion.url)
  const title = suggestion.title && suggestion.title !== suggestion.url ? suggestion.title : host
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-2 text-start transition-colors",
        isSelected
          ? "bg-black/[0.06] dark:bg-white/[0.08]"
          : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
      )}
    >
      {suggestion.type === "bookmark"
        ? <Bookmark className="size-3.5 shrink-0 text-foreground/40" />
        : <History className="size-3.5 shrink-0 text-foreground/40" />
      }
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-foreground truncate">{title}</p>
        {host && host !== title && (
          <p className="text-[11px] text-foreground/50 truncate">{host}</p>
        )}
      </div>
    </button>
  )
}

function UrlBar({
  url,
  onNavigate,
  bookmarks,
  globalHistory,
  searchBookmarks: enableSearchBookmarks,
  searchHistory: enableSearchHistory,
  connectionInfo,
  tall,
}: {
  url: string
  onNavigate: (url: string) => void
  bookmarks: BookmarkTree
  globalHistory: HistoryEntry[]
  searchBookmarks: boolean
  searchHistory: boolean
  connectionInfo?: ConnectionInfo
  tall?: boolean
}) {
  const [draft, setDraft] = useState(url)
  const [focused, setFocused] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(prettyNwepUrl(url)).catch(() => {})
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 1500)
  }
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)

  const isEmpty = !url || url === "about:newtab"

  const flatBks = useMemo(() => flatBookmarks(bookmarks), [bookmarks])

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = draft.trim().toLowerCase()
    if (!q) return []
    const results: Suggestion[] = []
    if (enableSearchBookmarks) {
      for (const b of flatBks) {
        if (b.url.toLowerCase().includes(q) || b.title.toLowerCase().includes(q)) {
          results.push({ type: "bookmark", url: b.url, title: b.title })
          if (results.length >= 5) break
        }
      }
    }
    if (enableSearchHistory) {
      const seen = new Set(results.map((r) => r.url))
      for (const h of globalHistory) {
        if (!seen.has(h.url) && (h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q))) {
          results.push({ type: "history", url: h.url, title: h.title })
          if (results.length >= 8) break
        }
      }
    }
    return results
  }, [draft, enableSearchBookmarks, enableSearchHistory, flatBks, globalHistory])

  const showSuggestions = focused && suggestions.length > 0

  useEffect(() => {
    if (!focused) return
    const el = formRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [focused])

  useEffect(() => {
    if (!showSuggestions) setSelectedIdx(-1)
  }, [showSuggestions])

  useEffect(() => {
    if (!focused) return
    const close = () => { setFocused(false); inputRef.current?.blur() }
    window.addEventListener("blur", close)
    return () => window.removeEventListener("blur", close)
  }, [focused])

  const doNavigate = (target: string) => {
    onNavigate(target)
    inputRef.current?.blur()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
      doNavigate(suggestions[selectedIdx].url)
      return
    }
    const trimmed = draft.trim()
    if (!trimmed) return
    doNavigate(trimmed.startsWith("about:") ? trimmed : normalizeNwepUrl(trimmed))
  }

  const handleFocus = () => {
    setDraft(isEmpty ? "" : url)
    setFocused(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, -1)) }
    else if (e.key === "Escape") { setSelectedIdx(-1); setFocused(false); inputRef.current?.blur() }
  }

  const bkSuggestions = suggestions.filter((s) => s.type === "bookmark")
  const histSuggestions = suggestions.filter((s) => s.type === "history")

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex-1 min-w-0">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex items-center gap-1.5 px-2.5 transition-all cursor-text",
          tall ? "h-[40px] rounded-xl" : "h-[26px] rounded-md",
          "bg-black/5 dark:bg-white/[0.07]",
          focused && "bg-white dark:bg-[#3a3a3c] ring-2 ring-[#0a84ff]/40 dark:ring-[#0a84ff]/50 shadow-sm"
        )}
      >
        {!focused && !isEmpty && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={copyUrl}
            aria-label="Copy link"
            className="shrink-0 text-foreground/35 hover:text-foreground/70 transition-colors"
          >
            {urlCopied
              ? <Check className="size-[12px] text-green-500" />
              : <Link2 className="size-[12px]" />}
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={focused ? draft : getDisplayHost(url)}
          onChange={(e) => { setDraft(e.target.value); setSelectedIdx(-1) }}
          onFocus={handleFocus}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={t("urlBar.placeholder")}
          className={cn(
            "flex-1 min-w-0 bg-transparent outline-none leading-none",
            tall ? "text-[16px]" : "text-[13px] tracking-[-0.003em]",
            focused ? "text-foreground" : isEmpty ? "text-foreground/30 text-center" : "text-foreground/70 text-center"
          )}
        />
        {!focused && connectionInfo && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <VerificationBadge info={connectionInfo} compact />
          </div>
        )}
      </div>

      {showSuggestions && dropdownRect && createPortal(
        <div
          style={{
            position: "fixed",
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 9999,
          }}
          className="rounded-lg overflow-hidden border border-black/[0.08] dark:border-white/[0.06] bg-white dark:bg-[#2c2c2e] shadow-[0_4px_20px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)]"
          onMouseDown={(e) => e.preventDefault()}
        >
          {bkSuggestions.length > 0 && (
            <div>
              <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/40">
                {t("urlBar.bookmarksGroup")}
              </p>
              {bkSuggestions.map((s) => (
                <SuggestionItem
                  key={s.url}
                  suggestion={s}
                  isSelected={suggestions.indexOf(s) === selectedIdx}
                  onSelect={() => doNavigate(s.url)}
                  onHover={() => setSelectedIdx(suggestions.indexOf(s))}
                />
              ))}
            </div>
          )}
          {bkSuggestions.length > 0 && histSuggestions.length > 0 && (
            <div className="border-t border-black/[0.06] dark:border-white/[0.05]" />
          )}
          {histSuggestions.length > 0 && (
            <div>
              <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/40">
                {t("urlBar.historyGroup")}
              </p>
              {histSuggestions.map((s) => (
                <SuggestionItem
                  key={s.url}
                  suggestion={s}
                  isSelected={suggestions.indexOf(s) === selectedIdx}
                  onSelect={() => doNavigate(s.url)}
                  onHover={() => setSelectedIdx(suggestions.indexOf(s))}
                />
              ))}
            </div>
          )}
          <div className="h-1" />
        </div>,
        document.getElementById("root") ?? document.body,
      )}
    </form>
  )
}


function IdentityRow({ label, nodeId, pubkey, note }: {
  label: string
  nodeId: string
  pubkey?: string
  note?: string
}) {
  const truncate = (hex: string) => `${hex.slice(0, 10)}…${hex.slice(-6)}`
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">{label}</p>
        {note && <p className="text-[10px] text-foreground/30 italic">{note}</p>}
      </div>
      <div className="font-mono text-[11px] space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-foreground/40 w-[52px] shrink-0">node_id</span>
          <span className="text-foreground/70">{truncate(nodeId)}</span>
        </div>
        {pubkey && (
          <div className="flex items-center gap-2">
            <span className="text-foreground/40 w-[52px] shrink-0">pubkey</span>
            <span className="text-foreground/70">{truncate(pubkey)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function VerificationBadge({ info, compact = false }: { info: ConnectionInfo; compact?: boolean }) {
  const allOk = info.log.every((s) => s.ok)
  const [open, setOpen] = useState(false)
  const triggerCls = compact
    ? "flex items-center justify-center outline-none shrink-0 rounded focus-visible:ring-2 focus-visible:ring-ring/50"
    : navMenuTriggerCls

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener("blur", close)
    return () => window.removeEventListener("blur", close)
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerCls} aria-label={t("nav.connectionSecurity")}>
        {allOk
          ? <ShieldCheck className="size-[14px] text-green-500 dark:text-green-400" />
          : <ShieldAlert className="size-[14px] text-amber-500 dark:text-amber-400" />
        }
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="w-[320px] p-0 gap-0 overflow-hidden">


        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border/50">
          {allOk
            ? <ShieldCheck className="size-[15px] text-green-500 dark:text-green-400 shrink-0" />
            : <ShieldAlert className="size-[15px] text-amber-500 dark:text-amber-400 shrink-0" />
          }
          <div>
            <p className="text-[13px] font-medium text-foreground">
              {allOk ? t("connection.authenticated") : t("connection.failed")}
            </p>
            <p className="text-[11px] text-foreground/50">
              {allOk ? t("connection.authVerified") : t("connection.handshakeIncomplete")}
            </p>
          </div>
        </div>


        <div className="px-3.5 py-2.5 border-b border-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40 mb-2">{t("connection.logLabel")}</p>
          <div className="space-y-2">
            {info.log.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                {step.ok
                  ? <Check className="size-3 text-green-500 dark:text-green-400 shrink-0 mt-[1px]" />
                  : <X className="size-3 text-red-500 dark:text-red-400 shrink-0 mt-[1px]" />
                }
                <div className="min-w-0">
                  <p className="text-[11.5px] font-mono text-foreground/80 leading-snug">{step.name}</p>
                  {step.detail && (
                    <p className="text-[10.5px] font-mono text-foreground/40 leading-snug break-all">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>


        {info.serverNodeId && (
          <div className="px-3.5 py-2.5 space-y-3">
            <IdentityRow label={t("connection.server")} nodeId={info.serverNodeId} pubkey={info.serverPubkey} />
            {info.clientNodeId && <IdentityRow label={t("connection.client")} nodeId={info.clientNodeId} note={t("connection.ephemeral")} />}
          </div>
        )}

      </PopoverContent>
    </Popover>
  )
}


function NavBtn({
  children, onClick, disabled, label,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="rounded-md text-foreground/60 hover:bg-black/8 dark:hover:bg-white/10 hover:text-foreground disabled:opacity-25"
    >
      {children}
    </Button>
  )
}

const navMenuTriggerCls = cn(
  "size-7 rounded-md flex items-center justify-center shrink-0",
  "text-foreground/60 hover:bg-black/8 dark:hover:bg-white/10 hover:text-foreground",
  "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
  "data-popup-open:bg-black/8 dark:data-popup-open:bg-white/10 data-popup-open:text-foreground"
)


const bkItemCls = cn(
  "flex items-center gap-1.5 w-full rounded-md px-1.5 py-1 text-sm text-start",
  "hover:bg-accent hover:text-accent-foreground transition-colors outline-none cursor-default select-none"
)
const bkItemDestructiveCls = cn(
  "flex items-center gap-1.5 w-full rounded-md px-1.5 py-1 text-sm text-start text-destructive",
  "hover:bg-destructive/10 transition-colors outline-none cursor-default select-none"
)
const bkInputCls = cn(
  "h-6 w-full rounded border border-input bg-transparent px-2 text-xs outline-none",
  "focus:ring-2 focus:ring-ring/50 focus:border-ring placeholder:text-muted-foreground"
)
const bkCrudBtn = "rounded p-0.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
const bkCrudDestructBtn = "rounded p-0.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"

function SortableBkRow({
  node,
  isEditing,
  editTitle,
  editUrl,
  isOverFolder,
  onEditTitle,
  onEditUrl,
  onCommitEdit,
  onCancelEdit,
  onEnterFolder,
  onNavigate,
  onStartEdit,
  onDelete,
  onClosePopover,
}: {
  node: BookmarkNode
  isEditing: boolean
  editTitle: string
  editUrl: string
  isOverFolder: boolean
  onEditTitle: (v: string) => void
  onEditUrl: (v: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onEnterFolder: (id: string) => void
  onNavigate: (url: string) => void
  onStartEdit: (node: BookmarkNode) => void
  onDelete: (id: string) => void
  onClosePopover: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })
  const style = isDragging
    ? {}
    : { transform: CSS.Transform.toString(transform) ?? undefined, transition }

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} {...attributes}
        className="flex flex-col gap-1 px-1 py-1.5 rounded-md bg-accent/30 mb-0.5"
      >
        <input
          autoFocus
          value={editTitle}
          onChange={(e) => onEditTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onCommitEdit(); if (e.key === "Escape") onCancelEdit() }}
          placeholder="Title"
          className={bkInputCls}
        />
        {node.type === "bookmark" && (
          <input
            value={editUrl}
            onChange={(e) => onEditUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onCommitEdit(); if (e.key === "Escape") onCancelEdit() }}
            placeholder="web://…"
            className={cn(bkInputCls, "font-mono")}
          />
        )}
        <div className="flex justify-end gap-1 mt-0.5">
          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[11px]" onClick={onCancelEdit}>{t("bookmarksMenu.cancel")}</Button>
          <Button size="sm" className="h-5 px-1.5 text-[11px]" onClick={onCommitEdit} disabled={!editTitle.trim()}>{t("bookmarksMenu.save")}</Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors overflow-hidden touch-none",
        "hover:bg-accent/50 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        isOverFolder && node.type === "folder" && "ring-2 ring-inset ring-ring/50 bg-accent/40"
      )}
    >
      {node.type === "folder"
        ? <Folder className="size-3.5 shrink-0 text-muted-foreground" />
        : <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
      }
      <button
        className="flex-1 min-w-0 text-start text-sm truncate cursor-grab active:cursor-grabbing"
        onClick={() => {
          if (node.type === "folder") onEnterFolder(node.id)
          else if (node.url) { onNavigate(node.url); onClosePopover() }
        }}
      >
        {node.title || getDisplayHost(node.url ?? "")}
      </button>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {node.type === "folder" && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEnterFolder(node.id)}
            className={bkCrudBtn} aria-label={t("bookmarksMenu.openFolder")}
          >
            <ChevronRight className="size-3" />
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onStartEdit(node)}
          className={bkCrudBtn} aria-label={t("bookmarksMenu.edit")}
        >
          <Pencil className="size-3" />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(node.id)}
          className={bkCrudDestructBtn} aria-label={t("bookmarksMenu.delete")}
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  )
}

const bkCollisionDetection: Parameters<typeof DndContext>[0]["collisionDetection"] = (args) => {
  const within = pointerWithin(args)
  return within.length > 0 ? within : closestCenter(args)
}

const noSortStrategy = () => null

const PARENT_DROP_ID = "__parent_drop__"

function BreadcrumbDropZone({ label }: { label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: PARENT_DROP_ID })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 mb-1 text-xs transition-colors",
        isOver
          ? "border-ring bg-accent text-foreground"
          : "border-border/60 text-muted-foreground"
      )}
    >
      <ChevronUp className="size-3 shrink-0" />
      <span>{t("bookmarksMenu.dropToMove", { label })}</span>
    </div>
  )
}

function BookmarksMenu({
  currentUrl,
  currentTitle,
  bookmarks,
  onAdd,
  onRemove,
  onNavigate,
  onAddAll,
  onTreeChange,
}: {
  currentUrl: string
  currentTitle: string
  bookmarks: BookmarkTree
  onAdd: (url: string, title: string) => void
  onRemove: (id: string) => void
  onNavigate: (url: string) => void
  onAddAll: () => void
  onTreeChange: (tree: BookmarkTree) => void
}) {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editUrl, setEditUrl] = useState("")
  const [addMode, setAddMode] = useState<"none" | "bookmark" | "folder">("none")
  const [addTitle, setAddTitle] = useState("")
  const [addUrl, setAddUrl] = useState("")
  const [bkActiveId, setBkActiveId] = useState<string | null>(null)
  const [overFolderId, setOverFolderId] = useState<string | null>(null)
  const overFolderIdRef = useRef<string | null>(null)
  const addTitleRef = useRef<HTMLInputElement>(null)

  const bkSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const isPage = !currentUrl.startsWith("about:")
  const bookmarkedId = flatBookmarks(bookmarks).find((b) => b.url === currentUrl)?.id
  const currentItems = getNodeAtPath(bookmarks, path)
  const parentId = path.length > 0 ? path[path.length - 1] : null
  const bkActiveNode = bkActiveId ? currentItems.find((n) => n.id === bkActiveId) ?? null : null

  const resetState = () => {
    setPath([])
    setEditingId(null)
    setAddMode("none")
    setAddTitle("")
    setAddUrl("")
  }

  useEffect(() => { if (!open) resetState() }, [open])
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener("blur", close)
    return () => window.removeEventListener("blur", close)
  }, [open])
  useEffect(() => { if (addMode !== "none") setTimeout(() => addTitleRef.current?.focus(), 0) }, [addMode])

  const enterFolder = (id: string) => { setPath((p) => [...p, id]); setEditingId(null); setAddMode("none") }
  const navBreadcrumb = (index: number) => { setPath((p) => p.slice(0, index)); setEditingId(null); setAddMode("none") }

  const startEdit = (node: BookmarkNode) => {
    setEditingId(node.id); setEditTitle(node.title); setEditUrl(node.url ?? ""); setAddMode("none")
  }
  const commitEdit = () => {
    if (!editingId || !editTitle.trim()) { setEditingId(null); return }
    const patch: Partial<BookmarkNode> = { title: editTitle.trim() }
    if (editUrl.trim()) patch.url = editUrl.trim()
    onTreeChange(updateNode(bookmarks, editingId, patch))
    setEditingId(null)
  }
  const handleDelete = (id: string) => {
    onTreeChange(removeNode(bookmarks, id))
    if (editingId === id) setEditingId(null)
  }
  const handleAdd = () => {
    if (!addTitle.trim()) return
    const node: BookmarkNode = addMode === "folder"
      ? { id: genId(), type: "folder", title: addTitle.trim(), children: [] }
      : { id: genId(), type: "bookmark", title: addTitle.trim(), url: addUrl.trim() || undefined }
    onTreeChange(addNode(bookmarks, parentId, node))
    setAddTitle(""); setAddUrl(""); setAddMode("none")
  }
  const toggleAddMode = (mode: "bookmark" | "folder") => {
    setAddMode((prev) => (prev === mode ? "none" : mode)); setAddTitle(""); setAddUrl("")
  }

  const handleBkDragStart = ({ active }: DragStartEvent) => {
    setBkActiveId(active.id as string)
    setEditingId(null)
  }
  const handleBkDragOver = ({ over, active }: DragOverEvent) => {
    if (!over || over.id === active.id || over.id === PARENT_DROP_ID) {
      overFolderIdRef.current = null
      setOverFolderId(null)
      return
    }
    const overNode = currentItems.find((n) => n.id === over.id)
    const id = overNode?.type === "folder" ? (over.id as string) : null
    overFolderIdRef.current = id
    setOverFolderId(id)
  }
  const handleBkDragEnd = ({ active, over }: DragEndEvent) => {
    const folderId = overFolderIdRef.current
    overFolderIdRef.current = null

    if (over?.id === PARENT_DROP_ID && path.length > 0) {
      const grandParentId = path.length > 1 ? path[path.length - 2] : null
      onTreeChange(moveNodeIntoFolder(bookmarks, active.id as string, grandParentId))
      navBreadcrumb(path.length - 1)
    } else if (folderId && folderId !== (active.id as string)) {
      onTreeChange(moveNodeIntoFolder(bookmarks, active.id as string, folderId))
    } else if (over && active.id !== over.id) {
      const oldIdx = currentItems.findIndex((n) => n.id === active.id)
      const newIdx = currentItems.findIndex((n) => n.id === over.id)
      if (oldIdx !== -1 && newIdx !== -1) {
        onTreeChange(reorderInParent(bookmarks, parentId, oldIdx, newIdx))
      }
    }
    setBkActiveId(null)
    setOverFolderId(null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={navMenuTriggerCls} aria-label={t("nav.bookmarks")}>
        <Bookmark className={cn("size-[14px]", bookmarkedId && "[&>path]:fill-current")} />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="w-64 p-0 gap-0 overflow-hidden">


        <div className="p-1 border-b border-border/50">
          {isPage && !bookmarkedId && (
            <button className={bkItemCls} onClick={() => { onAdd(currentUrl, currentTitle); setOpen(false) }}>
              <BookmarkPlus className="size-4 shrink-0" />
              <span className="flex-1 min-w-0 truncate">{t("bookmarksMenu.bookmarkPage")}</span>
              <span className="ms-1 text-[10px] text-muted-foreground tracking-widest shrink-0">Ctrl+D</span>
            </button>
          )}
          {isPage && bookmarkedId && (
            <button className={bkItemDestructiveCls} onClick={() => { onRemove(bookmarkedId); setOpen(false) }}>
              <BookmarkX className="size-4 shrink-0" />
              <span className="flex-1 min-w-0 truncate">{t("bookmarksMenu.removeBookmark")}</span>
              <span className="ms-1 text-[10px] tracking-widest shrink-0">Ctrl+D</span>
            </button>
          )}
          <button className={bkItemCls} onClick={() => { onAddAll(); setOpen(false) }}>
            <BookmarkPlus className="size-4 shrink-0" />
            <span className="flex-1 min-w-0 truncate">{t("bookmarksMenu.bookmarkAllTabs")}</span>
            <span className="ms-1 text-[10px] text-muted-foreground tracking-widest shrink-0">Ctrl+⇧D</span>
          </button>
        </div>


        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 min-h-[30px]">
          {path.length > 0 && (
            <button
              onClick={() => navBreadcrumb(path.length - 1)}
              className="shrink-0 rounded p-0.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("bookmarksMenu.goBack")}
            >
              <ChevronLeft className="size-3.5 rtl:scale-x-[-1]" />
            </button>
          )}
          <div className="flex items-center gap-0.5 min-w-0 flex-1">
            <button
              onClick={() => navBreadcrumb(0)}
              className={cn(
                "text-xs shrink-0 transition-colors",
                path.length === 0
                  ? "text-foreground font-medium pointer-events-none"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("nav.bookmarks")}
            </button>
            {path.map((id, i) => (
              <span key={id} className="flex items-center gap-0.5 min-w-0">
                <ChevronRight className="size-3 text-muted-foreground/40 shrink-0 rtl:scale-x-[-1]" />
                <button
                  onClick={() => navBreadcrumb(i + 1)}
                  className={cn(
                    "text-xs truncate max-w-[80px] transition-colors",
                    i === path.length - 1
                      ? "text-foreground font-medium pointer-events-none"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {getFolderTitle(bookmarks, id) ?? "…"}
                </button>
              </span>
            ))}
          </div>
        </div>


        <DndContext
          sensors={bkSensors}
          collisionDetection={bkCollisionDetection}
          onDragStart={handleBkDragStart}
          onDragOver={handleBkDragOver}
          onDragEnd={handleBkDragEnd}
        >
          <SortableContext items={currentItems.map((n) => n.id)} strategy={noSortStrategy}>
            <ScrollArea className="max-h-56">
              <div className="p-1">
                {bkActiveId && path.length > 0 && (
                  <BreadcrumbDropZone
                    label={path.length > 1 ? (getFolderTitle(bookmarks, path[path.length - 2]) ?? t("bookmarksMenu.parentLabel")) : t("bookmarksMenu.rootLabel")}
                  />
                )}
                {currentItems.length === 0 && addMode === "none" ? (
                  <p className="py-3 text-xs text-muted-foreground text-center">
                    {path.length === 0 ? t("bookmarksMenu.noBookmarks") : t("bookmarksMenu.emptyFolder")}
                  </p>
                ) : (
                  currentItems.map((node) => (
                    <SortableBkRow
                      key={node.id}
                      node={node}
                      isEditing={editingId === node.id}
                      editTitle={editTitle}
                      editUrl={editUrl}
                      isOverFolder={overFolderId === node.id}
                      onEditTitle={setEditTitle}
                      onEditUrl={setEditUrl}
                      onCommitEdit={commitEdit}
                      onCancelEdit={() => setEditingId(null)}
                      onEnterFolder={enterFolder}
                      onNavigate={onNavigate}
                      onStartEdit={startEdit}
                      onDelete={handleDelete}
                      onClosePopover={() => setOpen(false)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {bkActiveNode && (
              <div className={cn(
                "flex items-center gap-1.5 px-1.5 py-1 rounded-md shadow-lg text-sm cursor-grabbing",
                "bg-popover ring-1 ring-border max-w-[230px]"
              )}>
                {bkActiveNode.type === "folder"
                  ? <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                  : <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
                }
                <span className="truncate">{bkActiveNode.title || getDisplayHost(bkActiveNode.url ?? "")}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>


        {addMode !== "none" && (
          <div className="border-t border-border/30 px-2 py-2 flex flex-col gap-1">
            <input
              ref={addTitleRef}
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd()
                if (e.key === "Escape") { setAddMode("none"); setAddTitle(""); setAddUrl("") }
              }}
              placeholder={addMode === "folder" ? t("bookmarksMenu.folderNamePlaceholder") : t("bookmarksMenu.titlePlaceholder")}
              className={bkInputCls}
            />
            {addMode === "bookmark" && (
              <input
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd()
                  if (e.key === "Escape") { setAddMode("none"); setAddTitle(""); setAddUrl("") }
                }}
                placeholder="web://…"
                className={cn(bkInputCls, "font-mono")}
              />
            )}
            <div className="flex justify-end gap-1 mt-0.5">
              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[11px]" onClick={() => { setAddMode("none"); setAddTitle(""); setAddUrl("") }}>{t("bookmarksMenu.cancel")}</Button>
              <Button size="sm" className="h-5 px-1.5 text-[11px]" onClick={handleAdd} disabled={!addTitle.trim()}>
                {addMode === "folder" ? t("bookmarksMenu.addFolder") : t("bookmarksMenu.add")}
              </Button>
            </div>
          </div>
        )}


        <div className="grid grid-cols-2 gap-0.5 p-1 border-t border-border/50">
          <button
            className={cn(bkItemCls, "text-xs gap-1 justify-center", addMode === "bookmark" && "bg-accent text-accent-foreground")}
            onClick={() => toggleAddMode("bookmark")}
          >
            <Plus className="size-3 shrink-0" />
            <span className="truncate">{t("bookmarksMenu.addBookmark")}</span>
          </button>
          <button
            className={cn(bkItemCls, "text-xs gap-1 justify-center", addMode === "folder" && "bg-accent text-accent-foreground")}
            onClick={() => toggleAddMode("folder")}
          >
            <Folder className="size-3 shrink-0" />
            <span className="truncate">{t("bookmarksMenu.newFolder")}</span>
          </button>
        </div>

      </PopoverContent>
    </Popover>
  )
}


const iconBtnCls = cn(
  "size-7 rounded-md flex items-center justify-center shrink-0",
  "text-foreground/60 hover:bg-accent hover:text-accent-foreground transition-colors outline-none"
)

function OptionsMenu({
  zoom,
  tabHistory,
  tabHistoryIndex,
  canPrint,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFind,
  onPrint,
  onHistoryNavigate,
  onOpenHistory,
  onOpenSettings,
  updateAvailable,
  onUpdate,
}: {
  zoom: number
  tabHistory: string[]
  tabHistoryIndex: number
  canPrint: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onFind: () => void
  onPrint: () => void
  onHistoryNavigate: (index: number) => void
  onOpenHistory: () => void
  onOpenSettings: () => void
  updateAvailable: { version: string; releaseUrl: string } | null
  onUpdate: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger className={cn(navMenuTriggerCls, "relative")} aria-label={t("nav.options")}>
        <Settings className="size-[14px]" />
        {updateAvailable && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-[#ff3b30]" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-[220px]">

        <div className="flex items-center gap-0.5 px-1 py-0.5">
          <button className={iconBtnCls} onClick={onZoomOut} aria-label={t("optionsMenu.zoomOut")}>
            <ZoomOut className="size-[14px]" />
          </button>
          <button
            className="flex-1 rounded-md py-1 text-center text-sm hover:bg-accent hover:text-accent-foreground transition-colors outline-none"
            onClick={onZoomReset}
            aria-label={t("optionsMenu.resetZoom")}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button className={iconBtnCls} onClick={onZoomIn} aria-label={t("optionsMenu.zoomIn")}>
            <ZoomIn className="size-[14px]" />
          </button>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onFind}>
          <Search />
          {t("optionsMenu.findInPage")}
          <DropdownMenuShortcut>Ctrl+F</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint} disabled={!canPrint}>
          <Printer />
          {t("optionsMenu.print")}
          <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />


        {tabHistory.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger onClick={() => { onOpenHistory(); setMenuOpen(false) }}>
              <History />
              {t("optionsMenu.history")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
              {tabHistory.map((url, i) => (
                <DropdownMenuItem
                  key={i}
                  onClick={() => onHistoryNavigate(i)}
                  data-current={i === tabHistoryIndex || undefined}
                  className="data-[current]:font-medium"
                >
                  <span className="flex-1 min-w-0 truncate max-w-[240px]">
                    {getDisplayHost(url) || url}
                  </span>
                  {i === tabHistoryIndex && (
                    <span className="ms-2 text-xs text-muted-foreground shrink-0">{t("optionsMenu.current")}</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem onClick={onOpenHistory}>
            <History />
            {t("optionsMenu.history")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {updateAvailable && (
          <DropdownMenuItem onClick={onUpdate} className="text-[#0a84ff] focus:text-[#0a84ff]">
            <Download />
            Update available: v{updateAvailable.version}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenSettings}>
          <Settings />
          {t("optionsMenu.settings")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


function NavBar({
  url,
  isLoading,
  canGoBack,
  canGoForward,
  zoom,
  tabHistory,
  tabHistoryIndex,
  canPrint,
  currentTitle,
  bookmarks,
  onBack,
  onForward,
  onReload,
  onStop,
  onNavigate,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFind,
  onPrint,
  onHistoryNavigate,
  onAddBookmark,
  onRemoveBookmark,
  onAddAllBookmarks,
  onTreeChange,
  onOpenSettings,
  onOpenHistory,
  globalHistory,
  searchBookmarks,
  searchHistory,
  connectionInfo,
  updateAvailable,
  onUpdate,
}: {
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  zoom: number
  tabHistory: string[]
  tabHistoryIndex: number
  canPrint: boolean
  currentTitle: string
  bookmarks: BookmarkTree
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onStop: () => void
  onNavigate: (url: string) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onFind: () => void
  onPrint: () => void
  onHistoryNavigate: (index: number) => void
  onAddBookmark: (url: string, title: string) => void
  onRemoveBookmark: (id: string) => void
  onAddAllBookmarks: () => void
  onTreeChange: (tree: BookmarkTree) => void
  onOpenSettings: () => void
  onOpenHistory: () => void
  globalHistory: HistoryEntry[]
  searchBookmarks: boolean
  searchHistory: boolean
  connectionInfo?: ConnectionInfo
  updateAvailable: { version: string; releaseUrl: string } | null
  onUpdate: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center h-[40px] shrink-0 px-2 gap-0.5",
        "bg-white dark:bg-[#2c2c2e]",
        "border-b border-black/[0.07] dark:border-white/[0.05]",
      )}
    >
      <NavBtn label={t("nav.back")} disabled={!canGoBack} onClick={onBack}>
        <ChevronLeft className="size-[15px] rtl:scale-x-[-1]" />
      </NavBtn>
      <NavBtn label={t("nav.forward")} disabled={!canGoForward} onClick={onForward}>
        <ChevronRight className="size-[15px] rtl:scale-x-[-1]" />
      </NavBtn>

      <div className="w-2 shrink-0" />
      <UrlBar
        url={url}
        onNavigate={onNavigate}
        bookmarks={bookmarks}
        globalHistory={globalHistory}
        searchBookmarks={searchBookmarks}
        searchHistory={searchHistory}
        connectionInfo={connectionInfo}
      />
      <div className="w-1 shrink-0" />

      <NavBtn label={isLoading ? t("nav.stop") : t("nav.reload")} onClick={isLoading ? onStop : onReload}>
        {isLoading ? <X className="size-[14px]" /> : <RotateCw className="size-[14px]" />}
      </NavBtn>
      <BookmarksMenu
        currentUrl={url}
        currentTitle={currentTitle}
        bookmarks={bookmarks}
        onAdd={onAddBookmark}
        onRemove={onRemoveBookmark}
        onNavigate={onNavigate}
        onAddAll={onAddAllBookmarks}
        onTreeChange={onTreeChange}
      />
      <OptionsMenu
        zoom={zoom}
        tabHistory={tabHistory}
        tabHistoryIndex={tabHistoryIndex}
        canPrint={canPrint}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomReset={onZoomReset}
        onFind={onFind}
        onPrint={onPrint}
        onHistoryNavigate={onHistoryNavigate}
        onOpenHistory={onOpenHistory}
        onOpenSettings={onOpenSettings}
        updateAvailable={updateAvailable}
        onUpdate={onUpdate}
      />
    </div>
  )
}


function FindBar({
  onSearch,
  onNext,
  onPrev,
  onClose,
}: {
  onSearch: (term: string) => { total: number; current: number }
  onNext: () => { total: number; current: number }
  onPrev: () => { total: number; current: number }
  onClose: () => void
}) {
  const [term, setTerm] = useState("")
  const [result, setResult] = useState<{ total: number; current: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleChange = (value: string) => {
    setTerm(value)
    setResult(onSearch(value))
  }

  const noMatches = result !== null && term !== "" && result.total === 0

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 shrink-0",
      "bg-[#f0f0f2] dark:bg-[#28282a]",
      "border-t border-black/[0.07] dark:border-white/[0.05]",
    )}>
      <Search className="size-[13px] text-foreground/40 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={term}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setResult(e.shiftKey ? onPrev() : onNext())
          if (e.key === "Escape") onClose()
        }}
        placeholder={t("find.placeholder")}
        className={cn(
          "flex-1 min-w-0 bg-transparent outline-none text-[13px] text-foreground",
          "placeholder:text-foreground/30",
          noMatches && "text-destructive",
        )}
      />


      <span className={cn(
        "text-[11px] shrink-0 tabular-nums min-w-[3rem] text-end",
        noMatches ? "text-destructive" : "text-foreground/40",
      )}>
        {noMatches
          ? t("find.noResults")
          : result && result.total > 0
          ? t("find.countOf", { current: result.current, total: result.total })
          : ""}
      </span>

      <button
        onClick={() => setResult(onPrev())}
        disabled={!term || (result?.total ?? 0) === 0}
        className={iconBtnCls}
        aria-label={t("find.prevMatch")}
      >
        <ChevronUp className="size-[13px]" />
      </button>
      <button
        onClick={() => setResult(onNext())}
        disabled={!term || (result?.total ?? 0) === 0}
        className={iconBtnCls}
        aria-label={t("find.nextMatch")}
      >
        <ChevronDown className="size-[13px]" />
      </button>
      <button onClick={onClose} className={iconBtnCls} aria-label={t("find.close")}>
        <X className="size-[13px]" />
      </button>
    </div>
  )
}


function clearHighlights(doc: Document) {
  doc.querySelectorAll("mark[data-nwep-find]").forEach((el) => {
    el.replaceWith(doc.createTextNode(el.textContent ?? ""))
  })
  doc.body?.normalize()
}

function highlightAll(doc: Document, term: string): HTMLElement[] {
  clearHighlights(doc)
  if (!term || !doc.body) return []

  const lower = term.toLowerCase()
  const marks: HTMLElement[] = []

  const nodes: Text[] = []
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const el = (n as Text).parentElement
    if (!el) continue
    const tag = el.tagName.toLowerCase()
    if (["script", "style", "noscript", "textarea", "input"].includes(tag)) continue
    if ((n.textContent ?? "").toLowerCase().includes(lower)) nodes.push(n as Text)
  }

  for (const textNode of nodes) {
    const raw = textNode.textContent ?? ""
    const lowRaw = raw.toLowerCase()
    const parent = textNode.parentNode
    if (!parent) continue

    const frag = doc.createDocumentFragment()
    let last = 0
    let i = lowRaw.indexOf(lower)
    while (i !== -1) {
      if (i > last) frag.appendChild(doc.createTextNode(raw.slice(last, i)))
      const mark = doc.createElement("mark")
      mark.setAttribute("data-nwep-find", "true")
      mark.style.cssText = "background:#ffd60a;color:#1a1a1a;border-radius:2px;padding:0 1px;"
      mark.textContent = raw.slice(i, i + term.length)
      frag.appendChild(mark)
      marks.push(mark)
      last = i + term.length
      i = lowRaw.indexOf(lower, last)
    }
    if (last < raw.length) frag.appendChild(doc.createTextNode(raw.slice(last)))
    parent.replaceChild(frag, textNode)
  }

  return marks
}

interface ContentFrameHandle {
  print(): void
  search(term: string): { total: number; current: number }
  findNext(): { total: number; current: number }
  findPrev(): { total: number; current: number }
  clearSearch(): void
}

const ContentFrame = forwardRef<ContentFrameHandle, { url: string; content: string; zoom: number }>(
  function ContentFrame({ url, content, zoom }, ref) {
    const { resolvedTheme } = useTheme()
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const findState = useRef<{ marks: HTMLElement[]; idx: number }>({ marks: [], idx: 0 })

    const setActive = (idx: number) => {
      const { marks } = findState.current
      if (!marks.length) return
      marks.forEach((m) => { m.style.background = "#ffd60a"; m.style.outline = "none" })
      marks[idx].style.background = "#ff9f0a"
      marks[idx].style.outline = "2px solid #e65c00"
      marks[idx].scrollIntoView({ block: "nearest", inline: "nearest" })
      findState.current.idx = idx
    }

    useImperativeHandle(ref, () => ({
      print() {
        iframeRef.current?.contentWindow?.print()
      },
      search(term: string) {
        const doc = iframeRef.current?.contentDocument
        if (!doc) return { total: 0, current: 0 }
        if (!term) {
          clearHighlights(doc)
          findState.current = { marks: [], idx: 0 }
          return { total: 0, current: 0 }
        }
        const marks = highlightAll(doc, term)
        findState.current = { marks, idx: 0 }
        if (marks.length) setActive(0)
        return { total: marks.length, current: marks.length ? 1 : 0 }
      },
      findNext() {
        const { marks, idx } = findState.current
        if (!marks.length) return { total: 0, current: 0 }
        const next = (idx + 1) % marks.length
        setActive(next)
        return { total: marks.length, current: next + 1 }
      },
      findPrev() {
        const { marks, idx } = findState.current
        if (!marks.length) return { total: 0, current: 0 }
        const prev = (idx - 1 + marks.length) % marks.length
        setActive(prev)
        return { total: marks.length, current: prev + 1 }
      },
      clearSearch() {
        const doc = iframeRef.current?.contentDocument
        if (doc) clearHighlights(doc)
        findState.current = { marks: [], idx: 0 }
      },
    }))

    const srcDoc = useMemo(() => {
      const isDark = resolvedTheme === "dark"
      const defaults = isDark
        ? `<style>:root{color-scheme:dark}body{color:#fff;background:#1c1c1e}</style>`
        : `<style>:root{color-scheme:light}body{color:#000;background:#fff}</style>`
      const ctxScript = `<script>(function(){
        window.addEventListener('contextmenu',function(e){
          var p=false,o=e.preventDefault.bind(e);
          e.preventDefault=function(){p=true;o();};
          o();
          var s=window.getSelection(),h=!!(s&&s.toString().trim().length);
          var st=h?s.toString().trim():'';
          var t=e.target,i=!!(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.contentEditable==='true'));
          var a=t;while(a&&a.tagName!=='A')a=a.parentElement;
          var lh=(a&&a.tagName==='A')?a.href:null;
          var im=(t&&t.tagName==='IMG')?t.src:null;
          var x=e.clientX,y=e.clientY;
          setTimeout(function(){
            if(!p)try{window.parent.postMessage({type:'nwep-contextmenu',clientX:x,clientY:y,hasSelection:h,isInput:i,selectionText:st,linkHref:lh,imgSrc:im},'*')}catch(_){}
          },0);
        },true);
      }())<\/script>`
      const inject = defaults + ctxScript
      if (/<head[\s>]/i.test(content)) {
        return content.replace(/<head([\s>])/i, `<head$1${inject}`)
      }
      return inject + content
    }, [content, resolvedTheme])

    useEffect(() => {
      const iframe = iframeRef.current
      if (!iframe) return
      const apply = () => {
        try {
          const body = iframe.contentDocument?.body
          if (body) body.style.zoom = String(zoom)
        } catch {}
      }
      apply()
      iframe.addEventListener("load", apply)
      return () => iframe.removeEventListener("load", apply)
    }, [zoom])

    const pullCtx = useContext(PullRefreshContext)

    useEffect(() => {
      if (!pullCtx) return
      const iframe = iframeRef.current
      if (!iframe) return

      let startY = 0, startX = 0, active = false, trackingId = -1

      const attach = () => {
        const win = iframe.contentWindow
        if (!win) return

        const onPointerDown = (e: PointerEvent) => {
          if (win.scrollY > 0) return
          startY = e.clientY
          startX = e.clientX
          active = false
          trackingId = e.pointerId
        }
        const onPointerMove = (e: PointerEvent) => {
          if (e.pointerId !== trackingId) return
          const dy = e.clientY - startY
          const adx = Math.abs(e.clientX - startX)
          if (!active) {
            if (dy > 10 && dy > adx * 1.5 && win.scrollY <= 0) {
              active = true
              try { win.document.documentElement.style.overflowY = "hidden" } catch {}
            } else {
              return
            }
          }
          pullCtx.onPullY(dy)
        }
        const onPointerUp = (e: PointerEvent) => {
          if (e.pointerId !== trackingId) return
          trackingId = -1
          if (active) {
            active = false
            try { win.document.documentElement.style.overflowY = "" } catch {}
            pullCtx.onPullEnd()
          }
        }

        win.addEventListener("pointerdown", onPointerDown)
        win.addEventListener("pointermove", onPointerMove)
        win.addEventListener("pointerup", onPointerUp)
        win.addEventListener("pointercancel", onPointerUp)
        return () => {
          win.removeEventListener("pointerdown", onPointerDown)
          win.removeEventListener("pointermove", onPointerMove)
          win.removeEventListener("pointerup", onPointerUp)
          win.removeEventListener("pointercancel", onPointerUp)
        }
      }

      let cleanup: (() => void) | undefined
      const onLoad = () => { cleanup?.(); cleanup = attach() }
      iframe.addEventListener("load", onLoad)
      cleanup = attach()
      return () => { iframe.removeEventListener("load", onLoad); cleanup?.() }
    }, [pullCtx])


    return (
      <iframe
        key={url}
        ref={iframeRef}
        srcDoc={srcDoc}
        className="flex-1 min-h-0 w-full border-none"
        title="Page content"
      />
    )
  }
)


function ErrorPage({ error, url, onRetry }: { error: string; url: string; onRetry: () => void }) {
  const match = error.match(/^\[(\w+):(-?\d+)\]\s*(.*)/)
  const category = match?.[1] ?? null
  const code     = match?.[2] ?? null
  const message  = match?.[3] ?? error

  type Cfg = { Icon: React.ComponentType<{ className?: string }>; title: string; hint: string }
  const { Icon, title, hint }: Cfg = (() => {
    const msg = message.toLowerCase()
    if (category === "network") {
      if (msg.includes("timeout") || msg.includes("timed out"))
        return { Icon: WifiOff, title: t("error.timeout"), hint: t("error.timeoutHint") }
      return { Icon: Unplug, title: t("error.cantConnect"), hint: t("error.cantConnectHint") }
    }
    if (category === "crypto")
      return { Icon: ShieldAlert, title: t("error.authFailed"), hint: t("error.authFailedHint") }
    if (category === "identity") {
      if (msg.includes("addr"))
        return { Icon: Unplug, title: t("error.serverNotFound"), hint: t("error.serverNotFoundHint") }
      return { Icon: ShieldAlert, title: t("error.identityError"), hint: t("error.identityErrorHint") }
    }
    if (category === "protocol")
      return { Icon: ServerCrash, title: t("error.protocolError"), hint: t("error.protocolErrorHint") }
    return { Icon: CircleAlert, title: t("error.genericError"), hint: t("error.genericErrorHint") }
  })()

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1c1c1e] select-none">
      <div className="flex items-center min-h-full py-16 ps-[max(48px,10%)] pe-8">
        <div className="max-w-[520px] w-full">

          <Icon className="size-[52px] mb-8 text-[#1a1a1b] dark:text-[#2f2f31]" />

          <h1 className="text-[30px] font-bold text-foreground tracking-[-0.01em] leading-tight mb-3">
            {title}
          </h1>
          <p className="text-[15px] text-foreground/55 leading-relaxed mb-8 max-w-[420px]">
            {hint}
          </p>

          <button
            onClick={onRetry}
            className={cn(
              "px-5 py-2 rounded-md text-[13px] font-medium transition-colors",
              "bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.09] dark:hover:bg-white/[0.11]",
              "text-foreground/80 hover:text-foreground",
            )}
          >
            {t("error.tryAgain")}
          </button>

          <div className="mt-12 pt-6 border-t border-black/[0.07] dark:border-white/[0.06] space-y-1">
            <p className="font-mono text-[11.5px] text-foreground/30 truncate">{url}</p>
            <p className="font-mono text-[11.5px] text-foreground/30 break-all">
              {code && <span className="text-foreground/20">[{category}:{code}]</span>}
              {code ? " " : ""}{message}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}


function formatHistoryTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function groupHistory(entries: HistoryEntry[]): Array<{ label: string; items: HistoryEntry[] }> {
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const yestStart  = todayStart - 86_400_000

  const map = new Map<string, HistoryEntry[]>()
  const order: string[] = []

  for (const e of entries) {
    const ts = e.timestamp ?? 0
    let label: string
    if (!e.timestamp)         label = t("history.labelEarlier")
    else if (ts >= todayStart) label = t("history.labelToday")
    else if (ts >= yestStart)  label = t("history.labelYesterday")
    else                       label = new Date(ts).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })

    if (!map.has(label)) { map.set(label, []); order.push(label) }
    map.get(label)!.push(e)
  }

  return order.map((label) => ({ label, items: map.get(label)! }))
}

function HistoryPage({
  entries,
  onNavigate,
  onRemove,
  onClearAll,
  isMobile,
}: {
  entries: HistoryEntry[]
  onNavigate: (url: string) => void
  onRemove: (url: string) => void
  onClearAll: () => void
  isMobile?: boolean
}) {
  const groups = groupHistory(entries)

  if (isMobile) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f2f2f7] dark:bg-[#1c1c1e] select-none">

        <div className="shrink-0 px-5 pt-6 pb-4 flex items-center justify-between">
          <h1 className="text-[28px] font-bold text-foreground tracking-tight">{t("history.title")}</h1>
          {entries.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[#ff3b30] dark:text-[#ff453a] text-[15px] font-medium"
            >
              {t("history.clearAll")}
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-foreground/40">{t("history.empty")}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {groups.map(({ label: groupLabel, items }) => (
              <div key={groupLabel} className="mb-4">
                <p className="px-5 pb-1 text-[11px] font-medium uppercase tracking-widest text-foreground/40">
                  {groupLabel}
                </p>
                <div className="mx-4 rounded-xl overflow-hidden bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.05] divide-y divide-black/[0.06] dark:divide-white/[0.05]">
                  {items.map((entry) => (
                    <div
                      key={entry.url}
                      className="group flex items-center gap-3 px-4 active:bg-black/5 dark:active:bg-white/5 transition-colors"
                    >
                      <button
                        className="flex items-center gap-3 flex-1 min-w-0 py-3 text-start"
                        onClick={() => onNavigate(entry.url)}
                      >
                        <History className="size-4 shrink-0 text-foreground/25" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] text-foreground truncate">
                            {entry.title || getDisplayHost(entry.url)}
                          </p>
                          <p className="text-[12px] text-foreground/40 truncate">{getDisplayHost(entry.url)}</p>
                        </div>
                        {entry.timestamp && (
                          <span className="text-[12px] text-foreground/30 tabular-nums shrink-0">
                            {formatHistoryTime(entry.timestamp)}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => onRemove(entry.url)}
                        className="shrink-0 size-6 rounded-full flex items-center justify-center text-foreground/30 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                        aria-label={t("history.removeFromHistory")}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#2c2c2e] select-none">


      <div className={cn(
        "flex items-center justify-between shrink-0 px-6 py-4",
        "border-b border-black/[0.07] dark:border-white/[0.05]",
      )}>
        <h2 className="text-[18px] font-semibold text-foreground tracking-tight">{t("history.title")}</h2>
        {entries.length > 0 && (
          <button
            onClick={onClearAll}
            className={cn(
              "h-7 px-3 rounded-md text-[12px] font-medium transition-colors",
              "bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/15",
              "dark:text-[#ff453a] dark:bg-[#ff453a]/10 dark:hover:bg-[#ff453a]/15",
            )}
          >
            {t("history.clearAll")}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-foreground/40">{t("history.empty")}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">


          <div className={cn(
            "grid grid-cols-[1fr_260px] sticky top-0 z-10",
            "bg-[#f5f5f7] dark:bg-[#1e1e21]",
            "border-b border-black/[0.06] dark:border-white/[0.04]",
          )}>
            <div className="px-6 py-1.5">
              <p className="text-[11px] font-medium uppercase tracking-widest text-foreground/40">{t("history.websiteColumn")}</p>
            </div>
            <div className="px-4 py-1.5 border-s border-black/[0.06] dark:border-white/[0.04]">
              <p className="text-[11px] font-medium uppercase tracking-widest text-foreground/40">{t("history.addressColumn")}</p>
            </div>
          </div>


          {groups.map(({ label: groupLabel, items }) => (
            <div key={groupLabel}>


              <div className={cn(
                "px-6 py-1 border-b border-black/[0.05] dark:border-white/[0.03]",
                "bg-[#f0f0f2] dark:bg-[#242426]",
              )}>
                <p className="text-[11px] font-medium uppercase tracking-widest text-foreground/35">{groupLabel}</p>
              </div>


              {items.map((entry) => (
                <div
                  key={entry.url}
                  className={cn(
                    "group grid grid-cols-[1fr_260px] transition-colors",
                    "border-b border-black/[0.05] dark:border-white/[0.04]",
                    "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                  )}
                >

                  <button
                    className="flex items-center gap-2.5 px-6 py-[7px] text-start min-w-0"
                    onClick={() => onNavigate(entry.url)}
                  >
                    <History className="size-3 shrink-0 text-foreground/25" />
                    <span className="text-[13px] text-foreground truncate">
                      {entry.title || getDisplayHost(entry.url)}
                    </span>
                  </button>


                  <div className="flex items-center gap-2 px-4 min-w-0 border-s border-black/[0.05] dark:border-white/[0.04]">
                    <span className="text-[12px] text-foreground/45 truncate flex-1 min-w-0">
                      {getDisplayHost(entry.url)}
                    </span>
                    {entry.timestamp && (
                      <span className="text-[11px] text-foreground/30 tabular-nums shrink-0">
                        {formatHistoryTime(entry.timestamp)}
                      </span>
                    )}
                    <button
                      onClick={() => onRemove(entry.url)}
                      className={cn(
                        "opacity-0 group-hover:opacity-100 transition-opacity shrink-0",
                        "size-4 rounded flex items-center justify-center",
                        "text-foreground/40 hover:text-foreground hover:bg-black/8 dark:hover:bg-white/10",
                      )}
                      aria-label={t("history.removeFromHistory")}
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

        </div>
      )}

    </div>
  )
}


const ctxItemCls = cn(
  "flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm text-start outline-none cursor-default select-none",
  "transition-colors hover:bg-accent hover:text-accent-foreground",
  "disabled:pointer-events-none disabled:opacity-50",
)

function ContextMenuOverlay({
  onOpenInNewTab,
  canGoBack,
  canGoForward,
  canSave,
  pageUrl,
  onBack,
  onForward,
  onReload,
  onSavePage,
}: {
  onOpenInNewTab: (url: string) => void
  canGoBack: boolean
  canGoForward: boolean
  canSave: boolean
  pageUrl: string
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onSavePage: () => void
}) {
  const [ctx, setCtx] = useState<{
    x: number
    y: number
    hasSelection: boolean
    isEditable: boolean
    selectionText: string
    linkHref: string | null
    imgSrc: string | null
    fromIframe: boolean
  } | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      e.preventDefault()
      const sel = window.getSelection()
      const hasSelection = (sel?.toString().trim().length ?? 0) > 0
      const target = e.target as HTMLElement
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        !!target.closest("[contenteditable='true']")
      if (!hasSelection && !isEditable) return
      const x = Math.min(e.clientX, window.innerWidth  - 200)
      const y = Math.min(e.clientY, window.innerHeight - 200)
      setCtx({ x, y, hasSelection, isEditable, selectionText: sel?.toString().trim() ?? "", linkHref: null, imgSrc: null, fromIframe: false })
    }
    window.addEventListener("contextmenu", handler)
    return () => window.removeEventListener("contextmenu", handler)
  }, [])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== "nwep-contextmenu") return
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Page content"]')
      if (!iframe) return
      const rect = iframe.getBoundingClientRect()
      const x = Math.min(rect.left + e.data.clientX, window.innerWidth  - 200)
      const y = Math.min(rect.top  + e.data.clientY, window.innerHeight - 200)
      setCtx({
        x, y,
        hasSelection: !!e.data.hasSelection,
        isEditable: !!e.data.isInput,
        selectionText: e.data.selectionText ?? "",
        linkHref: e.data.linkHref ?? null,
        imgSrc: e.data.imgSrc ?? null,
        fromIframe: true,
      })
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  useEffect(() => {
    if (!ctx) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCtx(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [!!ctx]) // eslint-disable-line react-hooks/exhaustive-deps

  const [shareOpen, setShareOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [proxyCopied, setProxyCopied] = useState(false)
  const shareRef = useRef<HTMLButtonElement>(null)
  const [shareRect, setShareRect] = useState<DOMRect | null>(null)
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  if (!ctx) return null

  const exec = (cmd: string) => { document.execCommand(cmd); setCtx(null) }
  const writeClipboard = (text: string) => { navigator.clipboard.writeText(text).catch(() => {}); setCtx(null) }

  const hasLink      = !!ctx.linkHref
  const canCut       = ctx.hasSelection && ctx.isEditable
  const canCopy      = ctx.hasSelection
  const canPaste     = ctx.isEditable
  const canSelectAll = ctx.isEditable

  const doCopy = () => {
    if (ctx.selectionText) writeClipboard(ctx.selectionText)
    else exec("copy")
  }

  const openShare = () => {
    clearTimeout(shareTimer.current)
    if (shareRef.current) setShareRect(shareRef.current.getBoundingClientRect())
    setShareOpen(true)
  }
  const closeShare = () => { shareTimer.current = setTimeout(() => setShareOpen(false), 120) }

  const copyShareLink = () => {
    navigator.clipboard.writeText(prettyNwepUrl(pageUrl)).catch(() => {})
    setLinkCopied(true)
    setTimeout(() => { setLinkCopied(false); setCtx(null) }, 1000)
  }
  const copyProxyLink = () => {
    navigator.clipboard.writeText(`https://proxy.usenwep.org/?addr=${prettyNwepUrl(pageUrl)}`).catch(() => {})
    setProxyCopied(true)
    setTimeout(() => { setProxyCopied(false); setCtx(null) }, 1000)
  }

  const hasLinkSection = hasLink
  const hasEditSection = canCut || canCopy || canPaste || canSelectAll
  const hasPageSection = ctx.fromIframe

  return createPortal(
    <>

      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: "rgba(0,0,0,0.004)" }}
        onPointerDown={() => setCtx(null)}
      />


      <div
        style={{ position: "fixed", top: ctx.y, left: ctx.x, zIndex: 9999 }}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "min-w-[200px] overflow-hidden rounded-md p-1",
          "bg-popover text-popover-foreground",
          "border border-border/50",
          "shadow-[0_4px_20px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)]",
        )}
      >

        {hasLink && (
          <>
            <button onClick={() => { onOpenInNewTab(ctx.linkHref!); setCtx(null) }} className={ctxItemCls}>
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="flex-1">{t("contextMenu.openLinkNewTab")}</span>
            </button>
            <button onClick={() => writeClipboard(ctx.linkHref!)} className={ctxItemCls}>
              <Copy className="size-3.5 shrink-0" />
              <span className="flex-1">{t("contextMenu.copyLinkAddress")}</span>
            </button>
          </>
        )}

        {hasLinkSection && hasEditSection && <div className="h-px bg-border/50 my-1 -mx-1" />}


        {canCut && (
          <button onClick={() => exec("cut")} className={ctxItemCls}>
            <Scissors className="size-3.5 shrink-0" />
            <span className="flex-1">{t("contextMenu.cut")}</span>
            <span className="text-[11px] text-muted-foreground">Ctrl+X</span>
          </button>
        )}
        {canCopy && (
          <button onClick={doCopy} className={ctxItemCls}>
            <Copy className="size-3.5 shrink-0" />
            <span className="flex-1">{t("contextMenu.copy")}</span>
            <span className="text-[11px] text-muted-foreground">Ctrl+C</span>
          </button>
        )}
        {canPaste && (
          <button onClick={() => exec("paste")} className={ctxItemCls}>
            <Clipboard className="size-3.5 shrink-0" />
            <span className="flex-1">{t("contextMenu.paste")}</span>
            <span className="text-[11px] text-muted-foreground">Ctrl+V</span>
          </button>
        )}
        {(canCut || canCopy || canPaste) && canSelectAll && <div className="h-px bg-border/50 my-1 -mx-1" />}
        {canSelectAll && (
          <button onClick={() => exec("selectAll")} className={ctxItemCls}>
            <span className="size-3.5 shrink-0" />
            <span className="flex-1">{t("contextMenu.selectAll")}</span>
            <span className="text-[11px] text-muted-foreground">Ctrl+A</span>
          </button>
        )}

        {(hasLinkSection || hasEditSection) && hasPageSection && <div className="h-px bg-border/50 my-1 -mx-1" />}


        {hasPageSection && (
          <>
            <button onClick={() => { onBack(); setCtx(null) }} disabled={!canGoBack} className={ctxItemCls}>
              <ChevronLeft className="size-3.5 shrink-0 rtl:scale-x-[-1]" />
              <span className="flex-1">{t("contextMenu.back")}</span>
            </button>
            <button onClick={() => { onForward(); setCtx(null) }} disabled={!canGoForward} className={ctxItemCls}>
              <ChevronRight className="size-3.5 shrink-0 rtl:scale-x-[-1]" />
              <span className="flex-1">{t("contextMenu.forward")}</span>
            </button>
            <button onClick={() => { onReload(); setCtx(null) }} className={ctxItemCls}>
              <RotateCw className="size-3.5 shrink-0" />
              <span className="flex-1">{t("contextMenu.reload")}</span>
            </button>
            <div className="h-px bg-border/50 my-1 -mx-1" />
            <button
              ref={shareRef}
              onMouseEnter={openShare}
              onMouseLeave={closeShare}
              className={ctxItemCls}
            >
              <Share2 className="size-3.5 shrink-0" />
              <span className="flex-1">{t("contextMenu.share")}</span>
              <ChevronRight className="size-3 shrink-0 text-muted-foreground rtl:scale-x-[-1]" />
            </button>
            {canSave && (
              <button onClick={() => { onSavePage(); setCtx(null) }} className={ctxItemCls}>
                <Download className="size-3.5 shrink-0" />
                <span className="flex-1">{t("contextMenu.savePageAs")}</span>
              </button>
            )}
            <button
              onClick={() => {
                document.querySelector<HTMLIFrameElement>('iframe[title="Page content"]')?.contentWindow?.print()
                setCtx(null)
              }}
              className={ctxItemCls}
            >
              <Printer className="size-3.5 shrink-0" />
              <span className="flex-1">{t("contextMenu.print")}</span>
            </button>
          </>
        )}
      </div>


      {shareOpen && shareRect && (
        <div
          style={{ position: "fixed", top: shareRect.top, left: shareRect.right + 4, zIndex: 10000 }}
          onMouseEnter={() => clearTimeout(shareTimer.current)}
          onMouseLeave={closeShare}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "min-w-[200px] overflow-hidden rounded-md p-1",
            "bg-popover text-popover-foreground",
            "border border-border/50",
            "shadow-[0_4px_20px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)]",
          )}
        >
          <button onClick={copyShareLink} className={ctxItemCls}>
            {linkCopied
              ? <Check className="size-3.5 shrink-0 text-green-500" />
              : <Link2 className="size-3.5 shrink-0" />}
            <span className="flex-1">{linkCopied ? t("contextMenu.copied") : t("contextMenu.copyLink")}</span>
          </button>
          <button onClick={copyProxyLink} className={ctxItemCls}>
            {proxyCopied
              ? <Check className="size-3.5 shrink-0 text-green-500" />
              : <Globe className="size-3.5 shrink-0" />}
            <span className="flex-1">{proxyCopied ? t("contextMenu.copied") : t("contextMenu.copyProxyLink")}</span>
          </button>
        </div>
      )}
    </>,
    document.getElementById("root") ?? document.body,
  )
}


const TAB_ACCENT_COLORS = [
  "#0a84ff", // blue
  "#30d158", // green
  "#ff9f0a", // orange
  "#bf5af2", // purple
  "#ff453a", // red
  "#00c7be", // teal
  "#ffd60a", // yellow
  "#64d2ff", // sky
]

function getTabAccentColor(url: string): string {
  if (url === "about:settings") return "#bf5af2"
  if (url === "about:history") return "#0a84ff"
  if (url.startsWith("about:")) return "#8e8e93"
  const domain = getDisplayHost(url)
  let h = 5381
  for (let i = 0; i < domain.length; i++) h = (((h << 5) + h) + domain.charCodeAt(i)) >>> 0
  return TAB_ACCENT_COLORS[h % TAB_ACCENT_COLORS.length]
}

function tabIconFor(url: string): React.ComponentType<{ className?: string; style?: React.CSSProperties }> {
  if (url === "about:settings") return Settings
  if (url === "about:history") return History
  return Globe
}


function MobileStartPage({
  bookmarks,
  onNavigate,
}: {
  bookmarks: BookmarkTree
  onNavigate: (url: string) => void
}) {
  const favs = flatBookmarks(bookmarks).slice(0, 8)

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1c1c1e] select-none">
      <div className="px-5 pt-8 pb-10">

        <section className="mb-9">
          <h2 className="text-[21px] font-bold text-foreground tracking-[0.3px] mb-4">{t("mobileStart.favorites")}</h2>
          {favs.length > 0 ? (
            <div className="grid grid-cols-4 gap-x-6 gap-y-5">
              {favs.map((fav) => (
                <button
                  key={fav.id}
                  onClick={() => onNavigate(fav.url)}
                  className="flex flex-col items-center gap-1 active:opacity-60 transition-opacity"
                >
                  <div className="size-[55px] rounded-[12px] bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.06] shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center justify-center">
                    <Globe className="size-5 text-foreground/25" />
                  </div>
                  <span className="text-[11px] text-foreground text-center line-clamp-1 leading-tight w-full">{fav.title || getDisplayHost(fav.url)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="size-16 rounded-[22px] bg-foreground/[0.06] flex items-center justify-center">
                <Bookmark className="size-7 text-foreground/20" />
              </div>
              <p className="text-[14px] text-foreground/40 text-center leading-snug px-4">
                {t("mobileStart.noFavoritesHint")}
              </p>
            </div>
          )}
        </section>


        <section>
          <h2 className="text-[21px] font-bold text-foreground mb-3">{t("mobileStart.readingList")}</h2>
          <p className="text-[15px] text-[#8a8a8d] leading-[1.45]">
            {t("mobileStart.readingListHint")}
          </p>
        </section>
      </div>
    </div>
  )
}


const TIP_BG = "#2c2c2e"

function TourTip({ title, body, onDismiss, arrowLeft, arrowRight }: {
  title: string
  body: string
  onDismiss: () => void
  arrowLeft?: number
  
  arrowRight?: number
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 30)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setShow(false)
    setTimeout(onDismiss, 200)
  }

  const justify = arrowLeft !== undefined ? "justify-start px-4"
    : arrowRight !== undefined ? "justify-end px-4"
    : "justify-center px-8"

  const items = arrowLeft !== undefined ? "items-start"
    : arrowRight !== undefined ? "items-end"
    : "items-center"

  return (
    <div className={cn("fixed z-[150] inset-x-0 bottom-[5.5rem] flex pointer-events-none", justify)}>
      <div
        className={cn(
          "pointer-events-auto flex flex-col w-full max-w-[280px]",
          items,
          "transition-all duration-200",
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        )}
      >
        <div
          onClick={dismiss}
          className="w-full rounded-2xl px-4 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
          style={{ backgroundColor: TIP_BG, boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 2px 12px rgba(0,0,0,0.5)" }}
        >
          <p className="text-[13px] font-semibold text-white mb-1">{title}</p>
          <p className="text-[13px] leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>{body}</p>
        </div>

        <div
          style={{
            marginLeft: arrowLeft,
            marginRight: arrowRight,
            width: 0, height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: `7px solid ${TIP_BG}`,
          }}
        />
      </div>
    </div>
  )
}

function MobileTabCard({
  tab,
  isActive,
  onSelect,
  onClose,
  canClose,
}: {
  tab: Tab
  isActive: boolean
  onSelect: () => void
  onClose: () => void
  canClose: boolean
}) {
  const pageTitle = tab.title || getDisplayHost(tab.url) || t("tab.newTab")
  const siteLabel = tab.url === "about:settings" ? t("tab.settings")
    : tab.url === "about:history" ? t("tab.history")
    : tab.url.startsWith("about:") ? t("tab.newTab")
    : getDisplayHost(tab.url) || t("tab.newTab")
  const accent = getTabAccentColor(tab.url)
  const TabIcon = tabIconFor(tab.url)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const themedSrcDoc = useMemo(() => {
    if (!tab.content) return undefined
    const defaults = isDark
      ? `<style>:root{color-scheme:dark}body{color:#fff;background:#1c1c1e}</style>`
      : `<style>:root{color-scheme:light}body{color:#000;background:#fff}</style>`
    if (/<head[\s>]/i.test(tab.content)) {
      return tab.content.replace(/<head([\s>])/i, `<head$1${defaults}`)
    }
    return defaults + tab.content
  }, [tab.content, isDark])

  const DISMISS_THRESHOLD = 80

  const [dragY, setDragY] = useState(0)
  const [releasing, setReleasing] = useState(false)
  const startY = useRef(0)
  const dragging = useRef(false)
  const didDrag = useRef(false)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canClose) return
    dragging.current = true
    didDrag.current = false
    startY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const delta = e.clientY - startY.current
    if (Math.abs(delta) > 6) didDrag.current = true
    setDragY(Math.min(0, delta)) // only upward
  }

  const handlePointerUp = () => {
    if (!dragging.current) return
    dragging.current = false
    setReleasing(true)
    if (dragY < -DISMISS_THRESHOLD) {
      setDragY(-380) // fly out
      setTimeout(() => onClose(), 220)
    } else {
      setDragY(0) // spring back
      setTimeout(() => setReleasing(false), 280)
    }
  }

  const opacity = Math.max(0, 1 - Math.abs(dragY) / 140)

  return (
    <div
      className="flex flex-col items-center gap-[6px] shrink-0 w-[160px] select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: `translateY(${dragY}px)`,
        opacity,
        transition: releasing ? "transform 0.26s cubic-bezier(0.32,0,0.67,0), opacity 0.22s ease" : "none",
      }}
    >

      <div
        onClick={() => { if (!didDrag.current) onSelect() }}
        className={cn(
          "relative w-full rounded-[10px] overflow-hidden cursor-pointer active:scale-[0.97]",
          "bg-white dark:bg-[#2c2c2e]",
          "shadow-[0_1px_17px_rgba(0,0,0,0.10)]",
          isActive && "ring-[2px] ring-[#0a84ff]",
          !releasing && "transition-transform",
        )}
        style={{ height: 210 }}
      >
        {themedSrcDoc ? (
          
          <>
            <div className={cn("absolute inset-0 overflow-hidden", isDark ? "bg-[#1c1c1e]" : "bg-white")}>
              <iframe
                srcDoc={themedSrcDoc}
                sandbox="allow-same-origin"
                scrolling="no"
                tabIndex={-1}
                title={pageTitle}
                style={{
                  width: 375,
                  height: 492,
                  transform: "scale(0.4267)",
                  transformOrigin: "top left",
                  pointerEvents: "none",
                  border: "none",
                  display: "block",
                }}
              />
            </div>

            <div className="absolute bottom-0 inset-x-0 px-2.5 py-1.5 bg-gradient-to-t from-black/30 to-transparent">
              <p className="text-[10px] font-medium text-white/80 truncate">{siteLabel}</p>
            </div>
          </>
        ) : (
          
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ backgroundColor: accent + "12" }}>
            <div className="absolute inset-0" style={{ backgroundColor: accent + "08" }} />
            <div
              className="relative size-[52px] rounded-[16px] flex items-center justify-center"
              style={{ backgroundColor: accent + "22" }}
            >
              <TabIcon className="size-[26px]" style={{ color: accent }} />
            </div>
            <p className="relative text-[12px] font-medium text-foreground/50 text-center px-3 line-clamp-2 leading-snug">{siteLabel}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MobileTabSwitcher({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onNewTab,
  onOpenBookmarks,
  onMenu,
  onDone,
  onReload,
  showSwipeToCloseTip,
  onSwipeToCloseTipDismiss,
}: {
  tabs: Tab[]
  activeTabId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewTab: () => void
  onOpenBookmarks: () => void
  onMenu: () => void
  onDone: () => void
  onReload: () => void
  showSwipeToCloseTip?: boolean
  onSwipeToCloseTipDismiss?: () => void
}) {
  const [tabSearch, setTabSearch] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const [dragY, setDragY] = useState(0)
  const [releasing, setReleasing] = useState(false)
  const dragStartY = useRef(0)
  const isDragging = useRef(false)

  const handleSpacerPointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY
    isDragging.current = true
    setReleasing(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handleSpacerPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    setDragY(Math.max(0, e.clientY - dragStartY.current))
  }
  const handleSpacerPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    const dy = e.clientY - dragStartY.current
    setReleasing(true)
    if (dy > 80) {
      setDragY(window.innerHeight)
      setTimeout(() => { onDone(); setDragY(0); setReleasing(false) }, 250)
    } else {
      setDragY(0)
      setTimeout(() => setReleasing(false), 300)
    }
  }

  useEffect(() => {
    if (!scrollRef.current) return
    const activeIdx = tabs.findIndex((tab) => tab.id === activeTabId)
    if (activeIdx >= 0) {
      const offset = 16 + activeIdx * (160 + 12) - (window.innerWidth / 2 - 80)
      scrollRef.current.scrollLeft = Math.max(0, offset)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [swipeTipVisible, setSwipeTipVisible] = useState(false)
  useEffect(() => {
    if (!showSwipeToCloseTip) { setSwipeTipVisible(false); return }
    if (scrollRef.current) {
      const lastIdx = tabs.length - 1
      const offset = 16 + lastIdx * (160 + 12) - (window.innerWidth / 2 - 80)
      scrollRef.current.scrollTo({ left: Math.max(0, offset), behavior: "smooth" })
    }
    const t = setTimeout(() => setSwipeTipVisible(true), 30)
    return () => clearTimeout(t)
  }, [showSwipeToCloseTip]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredTabs = tabSearch.trim()
    ? tabs.filter((tab) => {
        const q = tabSearch.toLowerCase()
        const title = (tab.title || getDisplayHost(tab.url) || t("tab.newTab")).toLowerCase()
        return title.includes(q) || tab.url.toLowerCase().includes(q)
      })
    : tabs

  return (
    <div className="fixed inset-0 z-50 flex flex-col animate-in fade-in duration-150" style={{ backdropFilter: "blur(30px) saturate(1.8)" }}>

      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />


      <div
        className="relative flex flex-col h-full"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: releasing ? "transform 0.25s ease" : "none",
        }}
      >

        <div
          className="flex-1 touch-none"
          onPointerDown={handleSpacerPointerDown}
          onPointerMove={handleSpacerPointerMove}
          onPointerUp={handleSpacerPointerUp}
          onPointerCancel={handleSpacerPointerUp}
        />


        {showSwipeToCloseTip && (
          <div className="shrink-0 flex justify-center pb-2 px-4 pointer-events-none">
            <div
              className={cn(
                "pointer-events-auto flex flex-col items-center w-[200px]",
                "transition-all duration-200",
                swipeTipVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
              )}
            >
              <div
                onClick={() => { setSwipeTipVisible(false); setTimeout(() => onSwipeToCloseTipDismiss?.(), 200) }}
                className="w-full rounded-2xl px-4 py-3.5 cursor-pointer active:opacity-70 transition-opacity"
                style={{ backgroundColor: TIP_BG, boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 2px 12px rgba(0,0,0,0.5)" }}
              >
                <p className="text-[13px] font-semibold text-white mb-1">{t("mobileTabs.closeTabTipTitle")}</p>
                <p className="text-[13px] leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>{t("mobileTabs.closeTabTipBody")}</p>
              </div>

              <div style={{ width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: `7px solid ${TIP_BG}` }} />
            </div>
          </div>
        )}


        <div
          ref={scrollRef}
          className="shrink-0 overflow-x-auto overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex gap-3 px-4 py-3" style={{ paddingRight: 16 }}>
            {filteredTabs.map((tab) => (
              <div key={tab.id} style={{ scrollSnapAlign: "start" }}>
                <MobileTabCard
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onSelect={() => { onSelect(tab.id); onDone() }}
                  onClose={() => { onClose(tab.id); if (showSwipeToCloseTip) onSwipeToCloseTipDismiss?.() }}
                  canClose={tabs.length > 1}
                />
              </div>
            ))}
          </div>
        </div>


        <div className="shrink-0 px-4 py-3">
          <div className="flex items-center gap-2 bg-white/15 dark:bg-white/10 rounded-xl px-3 py-2.5">
            <Search className="size-4 text-white/60 shrink-0" />
            <input
              value={tabSearch}
              onChange={(e) => setTabSearch(e.target.value)}
              placeholder={t("mobileTabs.searchPlaceholder")}
              className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-white/50"
            />
          </div>
        </div>


        <div className="shrink-0 bg-[#f7f7f7]/90 dark:bg-[#1c1c1e]/90 px-4 pt-2 pb-8 flex items-center justify-around">
          <button
            onClick={onOpenBookmarks}
            aria-label={t("mobileTabs.bookmarksBtn")}
            className="size-12 flex items-center justify-center text-foreground/60 active:opacity-40"
          >
            <BookOpen className="size-[22px]" />
          </button>
          <button
            onClick={onNewTab}
            aria-label={t("mobileTabs.newTabBtn")}
            className="size-12 flex items-center justify-center text-foreground/60 active:opacity-40"
          >
            <Plus className="size-[24px]" />
          </button>
          <button
            onClick={onReload}
            aria-label={t("mobileTabs.reloadBtn")}
            className="size-12 flex items-center justify-center text-foreground/60 active:opacity-40"
          >
            <RotateCw className="size-[20px]" />
          </button>
          <button
            onClick={onMenu}
            aria-label={t("mobileTabs.moreBtn")}
            className="size-12 flex items-center justify-center text-foreground/60 active:opacity-40"
          >
            <MoreHorizontal className="size-[22px]" />
          </button>
        </div>
      </div>
    </div>
  )
}

function MobileBottomChrome({
  url,
  tabs,
  activeTabId,
  onSelectTab,
  onShowTabs,
  onNavigate,
  onNewTab,
  bookmarks,
  globalHistory,
  searchBookmarks: enableSearchBookmarks,
  searchHistory: enableSearchHistory,
}: {
  url: string
  tabs: Tab[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onShowTabs: () => void
  onNavigate: (url: string) => void
  onNewTab: () => void
  bookmarks: BookmarkTree
  globalHistory: HistoryEntry[]
  searchBookmarks: boolean
  searchHistory: boolean
}) {
  const domain = getDisplayHost(url)
  const isEmpty = !url || url === "about:newtab"

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const flatBks = useMemo(() => flatBookmarks(bookmarks), [bookmarks])
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = draft.trim().toLowerCase()
    if (!q) return []
    const results: Suggestion[] = []
    if (enableSearchBookmarks) {
      for (const b of flatBks) {
        if (b.url.toLowerCase().includes(q) || b.title.toLowerCase().includes(q)) {
          results.push({ type: "bookmark", url: b.url, title: b.title })
          if (results.length >= 5) break
        }
      }
    }
    if (enableSearchHistory) {
      const seen = new Set(results.map((r) => r.url))
      for (const h of globalHistory) {
        if (!seen.has(h.url) && (h.url.toLowerCase().includes(q) || (h.title ?? "").toLowerCase().includes(q))) {
          results.push({ type: "history", url: h.url, title: h.title })
          if (results.length >= 8) break
        }
      }
    }
    return results
  }, [draft, enableSearchBookmarks, enableSearchHistory, flatBks, globalHistory])

  const startEditing = () => {
    setDraft(isEmpty ? "" : url)
    setEditing(true)
    setTimeout(() => { inputRef.current?.select(); inputRef.current?.focus() }, 30)
  }
  const commitEdit = (target = draft.trim()) => {
    setEditing(false)
    setDraft("")
    if (target) {
      onNavigate(target.startsWith("about:") ? target : normalizeNwepUrl(target))
    }
  }
  const cancelEdit = () => { setEditing(false); setDraft("") }

  const H_THRESHOLD = 50
  const V_THRESHOLD = 50
  const DAMP = 0.35
  const MAX_X = 60
  const MAX_Y = 36

  const pillStartX = useRef(0)
  const pillStartY = useRef(0)
  const pillDidSwipe = useRef(false)
  const pillAxis = useRef<"h" | "v" | null>(null)
  const pillDown = useRef(false)

  const [pillDragX, setPillDragX] = useState(0)
  const [pillDragY, setPillDragY] = useState(0)
  const [pillReleasing, setPillReleasing] = useState(false)

  const handlePillPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editing) return
    pillStartX.current = e.clientX
    pillStartY.current = e.clientY
    pillDidSwipe.current = false
    pillAxis.current = null
    pillDown.current = true
    setPillReleasing(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePillPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pillDown.current) return
    const dx = e.clientX - pillStartX.current
    const dy = e.clientY - pillStartY.current
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (!pillAxis.current && (adx > 4 || ady > 4)) {
      pillAxis.current = adx >= ady ? "h" : "v"
    }
    if (pillAxis.current === "h") {
      setPillDragX(Math.sign(dx) * Math.min(adx * DAMP, MAX_X))
      setPillDragY(0)
    } else if (pillAxis.current === "v" && dy < 0) {
      setPillDragY(Math.max(-MAX_Y, dy * DAMP))
      setPillDragX(0)
    }
  }
  const handlePillPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pillDown.current) return
    pillDown.current = false
    const dx = e.clientX - pillStartX.current
    const dy = e.clientY - pillStartY.current
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    setPillReleasing(true)
    setPillDragX(0)
    setPillDragY(0)
    setTimeout(() => setPillReleasing(false), 350)

    if (ady > adx && dy < -V_THRESHOLD) {
      pillDidSwipe.current = true
      onShowTabs()
    } else if (adx > ady && adx >= H_THRESHOLD) {
      pillDidSwipe.current = true
      const idx = tabs.findIndex((tab) => tab.id === activeTabId)
      if (dx < 0) {
        if (idx >= tabs.length - 1) {
          onNewTab()
        } else {
          onSelectTab(tabs[idx + 1].id)
        }
      } else {
        if (idx > 0) {
          onSelectTab(tabs[idx - 1].id)
        }
      }
    }
  }

  return (
    <div
      className={cn(
        "shrink-0 pt-9",
        "bg-gradient-to-t from-[#f2f2f7] via-[#f2f2f7]/90 to-transparent",
        "dark:from-[#1c1c1e] dark:via-[#1c1c1e]/90 dark:to-transparent",
      )}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}
    >
      <div className="mx-4 flex items-center gap-2">

        <div className="relative flex-1">

          {editing && suggestions.length > 0 && (
            <div className="absolute bottom-full mb-2 inset-x-0 max-h-[50vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#2c2c2e] shadow-[0_8px_32px_rgba(0,0,0,0.18)] divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onPointerDown={(e) => e.preventDefault()} // prevent input blur before click
                  onClick={() => commitEdit(s.url)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-start active:bg-black/5 dark:active:bg-white/5"
                >
                  {s.type === "bookmark"
                    ? <Bookmark className="size-4 text-[#0a84ff] shrink-0" />
                    : <Clock className="size-4 text-foreground/40 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] text-foreground truncate">{s.title || getDisplayHost(s.url)}</p>
                    <p className="text-[12px] text-foreground/40 truncate">{getDisplayHost(s.url)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}


          <div
            className={cn(
              "flex items-center h-[48px] rounded-2xl overflow-hidden",
              "bg-white/95 dark:bg-[#2c2c2e]/95",
              "shadow-[0_12px_40px_rgba(0,0,0,0.06),0_3px_10px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)]",
              "dark:shadow-[0_12px_40px_rgba(0,0,0,0.28),0_3px_10px_rgba(0,0,0,0.20),0_0_0_0.5px_rgba(255,255,255,0.05)]",
              !editing && "select-none touch-none",
            )}
            style={!editing ? {
              transform: `translateX(${pillDragX}px) translateY(${pillDragY}px)`,
              transition: pillReleasing ? "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
            } : undefined}
            onPointerDown={handlePillPointerDown}
            onPointerMove={handlePillPointerMove}
            onPointerUp={handlePillPointerUp}
            onPointerCancel={(e) => { pillDown.current = false; handlePillPointerUp(e) }}
          >
            {editing ? (
              <form className="flex-1 flex items-center px-4 gap-2 h-full" onSubmit={(e) => { e.preventDefault(); commitEdit() }}>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={cancelEdit}
                  onKeyDown={(e) => e.key === "Escape" && cancelEdit()}
                  placeholder={t("urlBar.mobilePlaceholder")}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 bg-transparent outline-none text-[15px] text-foreground placeholder:text-foreground/30 min-w-0"
                />
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={cancelEdit}
                  className="shrink-0 size-5 flex items-center justify-center rounded-full bg-foreground/15"
                >
                  <X className="size-3 text-foreground/60" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => { if (!pillDidSwipe.current) startEditing() }}
                className="flex-1 h-full flex items-center justify-center px-4"
              >
                <span className={cn(
                  "text-[15px] leading-none tracking-[-0.01em] truncate max-w-[240px]",
                  isEmpty ? "text-foreground/30" : "text-foreground font-medium",
                )}>
                  {isEmpty ? t("urlBar.mobilePlaceholder") : domain}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}


interface PullRefreshCtx {
  onPullY: (y: number) => void
  onPullEnd: () => void
}
const PullRefreshContext = createContext<PullRefreshCtx | null>(null)

function PullToRefresh({ onRefresh, enabled, children }: {
  onRefresh: () => void
  enabled: boolean
  children: React.ReactNode
}) {
  const THRESHOLD = 80
  const [pullY, setPullY] = useState(0)
  const [releasing, setReleasing] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const pullYRef = useRef(0)

  const progress = Math.min(pullY / THRESHOLD, 1)

  const onPullY = useCallback((y: number) => {
    pullYRef.current = y
    setReleasing(false)
    setPullY(y)
  }, [])

  const onPullEnd = useCallback(() => {
    const y = pullYRef.current
    setReleasing(true)
    if (y >= THRESHOLD) {
      setTriggered(true)
      onRefresh()
      setTimeout(() => { setPullY(0); pullYRef.current = 0; setTriggered(false); setReleasing(false) }, 900)
    } else {
      setPullY(0)
      pullYRef.current = 0
      setTimeout(() => setReleasing(false), 300)
    }
  }, [onRefresh])

  const ctx = useMemo<PullRefreshCtx>(() => ({ onPullY, onPullEnd }), [onPullY, onPullEnd])

  if (!enabled) return <>{children}</>

  const draggedY = triggered ? 12 : Math.min(pullY * 0.5, 50)
  const spinnerTransY = draggedY - 44  // starts hidden above (-44px), moves into view
  const spinnerOpacity = triggered ? 1 : progress
  const spinnerVisible = pullY > 0 || triggered

  return (
    <PullRefreshContext.Provider value={ctx}>
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">

        {spinnerVisible && (
          <div
            className="absolute top-0 inset-x-0 flex justify-center pointer-events-none z-10"
            style={{
              opacity: spinnerOpacity,
              transform: `translateY(${spinnerTransY}px)`,
              transition: releasing ? "opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" : "none",
            }}
          >
            <div className="size-9 rounded-full bg-white dark:bg-[#2c2c2e] shadow-lg flex items-center justify-center">
              <RotateCw
                className={cn("size-4 text-foreground/50", triggered && "animate-spin")}
                style={!triggered ? { transform: `rotate(${progress * 270}deg)` } : undefined}
              />
            </div>
          </div>
        )}


        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>
      </div>
    </PullRefreshContext.Provider>
  )
}


function MobileOptionsSheet({
  canPrint,
  canFind,
  canReload,
  canGoBack,
  canGoForward,
  isLoading,
  isCurrentlyBookmarked,
  onClose,
  onReload,
  onBack,
  onForward,
  onFind,
  onPrint,
  onToggleBookmark,
  onOpenSettings,
}: {
  canPrint: boolean
  canFind: boolean
  canReload: boolean
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  isCurrentlyBookmarked: boolean
  onClose: () => void
  onReload: () => void
  onBack: () => void
  onForward: () => void
  onFind: () => void
  onPrint: () => void
  onToggleBookmark: () => void
  onOpenSettings: () => void
}) {
  const [sheetDragY, setSheetDragY] = useState(0)
  const [sheetReleasing, setSheetReleasing] = useState(false)
  const sheetDragStartY = useRef(0)
  const sheetIsDragging = useRef(false)

  const handleDragStart = (e: React.PointerEvent) => {
    sheetDragStartY.current = e.clientY
    sheetIsDragging.current = true
    setSheetReleasing(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handleDragMove = (e: React.PointerEvent) => {
    if (!sheetIsDragging.current) return
    setSheetDragY(Math.max(0, e.clientY - sheetDragStartY.current))
  }
  const handleDragEnd = (e: React.PointerEvent) => {
    if (!sheetIsDragging.current) return
    sheetIsDragging.current = false
    const dy = e.clientY - sheetDragStartY.current
    setSheetReleasing(true)
    if (dy > 100) {
      setSheetDragY(600)
      setTimeout(() => { onClose(); setSheetDragY(0); setSheetReleasing(false) }, 250)
    } else {
      setSheetDragY(0)
      setTimeout(() => setSheetReleasing(false), 300)
    }
  }

  const items: { icon: React.ComponentType<{ className?: string }>; label: string; action: () => void; enabled: boolean; alwaysShow?: boolean; destructive?: boolean }[] = [
    { icon: ChevronLeft, label: t("mobileOptions.back"),        action: onBack,           enabled: canGoBack,    alwaysShow: true },
    { icon: ChevronRight,label: t("mobileOptions.forward"),     action: onForward,        enabled: canGoForward, alwaysShow: true },
    { icon: isLoading ? X : RotateCw, label: isLoading ? t("mobileOptions.stop") : t("mobileOptions.reload"), action: onReload, enabled: canReload },
    { icon: Search,      label: t("mobileOptions.findInPage"),  action: onFind,           enabled: canFind },
    { icon: Printer,     label: t("mobileOptions.print"),       action: onPrint,          enabled: canPrint },
    { icon: isCurrentlyBookmarked ? BookmarkX : BookmarkPlus,
                         label: isCurrentlyBookmarked ? t("mobileOptions.removeBookmark") : t("mobileOptions.addBookmark"),
                                                               action: onToggleBookmark, enabled: true,  destructive: isCurrentlyBookmarked },
    { icon: Settings,    label: t("mobileOptions.settings"),    action: onOpenSettings,   enabled: true },
  ]

  return (
    <>

      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />


      <div
        className={cn(
          "fixed bottom-0 inset-x-0 z-50 rounded-t-2xl overflow-hidden",
          "bg-[#f2f2f7] dark:bg-[#1c1c1e]",
          "animate-in slide-in-from-bottom duration-250",
        )}
        style={{
          transform: `translateY(${sheetDragY}px)`,
          transition: sheetReleasing ? "transform 0.25s ease" : "none",
        }}
      >

        <div
          className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="w-9 h-[4px] rounded-full bg-foreground/20" />
        </div>


        <div className="mx-4 mt-2 mb-3 rounded-xl overflow-hidden bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.05] divide-y divide-black/[0.06] dark:divide-white/[0.05]">
          {items.filter((i) => i.enabled || i.alwaysShow).map(({ icon: Icon, label, action, enabled, alwaysShow: _, destructive }) => (
            <button
              key={label}
              onClick={() => { if (enabled) { action(); onClose() } }}
              disabled={!enabled}
              className={cn(
                "flex items-center gap-3.5 w-full px-4 py-3.5 text-start transition-colors",
                enabled && "active:bg-black/5 dark:active:bg-white/5",
                !enabled && "opacity-30",
                destructive && "text-[#ff3b30] dark:text-[#ff453a]",
              )}
            >
              <Icon className={cn("size-[18px] shrink-0", destructive ? "text-current" : "text-foreground/50")} />
              <span className="text-[16px]">{label}</span>
            </button>
          ))}
        </div>


        <div className="mx-4 mb-8">
          <button
            onClick={onClose}
            className={cn(
              "w-full py-3.5 rounded-xl text-[16px] font-semibold text-foreground",
              "bg-white dark:bg-[#2c2c2e] active:opacity-70 transition-opacity",
              "border border-black/[0.06] dark:border-white/[0.05]",
            )}
          >
            {t("mobileOptions.cancelBtn")}
          </button>
        </div>
      </div>
    </>
  )
}


function MobileBookmarksSheet({
  open,
  onOpenChange,
  bookmarks,
  globalHistory,
  onNavigate,
  onTreeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookmarks: BookmarkTree
  globalHistory: HistoryEntry[]
  onNavigate: (url: string) => void
  onTreeChange: (tree: BookmarkTree) => void
}) {
  const [tab, setTab] = useState<"bookmarks" | "history">("bookmarks")
  const [search, setSearch] = useState("")

  const [editingBookmark, setEditingBookmark] = useState<{ id: string; url: string; title: string } | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editUrl, setEditUrl] = useState("")
  const editTitleRef = useRef<HTMLInputElement>(null)

  const [sheetDragY, setSheetDragY] = useState(0)
  const [sheetReleasing, setSheetReleasing] = useState(false)
  const sheetDragStartY = useRef(0)
  const sheetIsDragging = useRef(false)

  const handleDragStart = (e: React.PointerEvent) => {
    sheetDragStartY.current = e.clientY
    sheetIsDragging.current = true
    setSheetReleasing(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handleDragMove = (e: React.PointerEvent) => {
    if (!sheetIsDragging.current) return
    setSheetDragY(Math.max(0, e.clientY - sheetDragStartY.current))
  }
  const handleDragEnd = (e: React.PointerEvent) => {
    if (!sheetIsDragging.current) return
    sheetIsDragging.current = false
    const dy = e.clientY - sheetDragStartY.current
    setSheetReleasing(true)
    if (dy > 100) {
      setSheetDragY(0)
      setSheetReleasing(false)
      onOpenChange(false)
    } else {
      setSheetDragY(0)
      setTimeout(() => setSheetReleasing(false), 300)
    }
  }

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const startPress = (b: { id: string; url: string; title: string }) => {
    didLongPress.current = false
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setEditingBookmark(b)
      setEditTitle(b.title)
      setEditUrl(b.url)
      setTimeout(() => editTitleRef.current?.focus(), 80)
    }, 500)
  }
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  const saveEdit = () => {
    if (!editingBookmark) return
    onTreeChange(updateNode(bookmarks, editingBookmark.id, {
      title: editTitle.trim() || getDisplayHost(editUrl),
      url: editUrl.trim(),
    }))
    setEditingBookmark(null)
  }

  const deleteBookmark = () => {
    if (!editingBookmark) return
    onTreeChange(removeNode(bookmarks, editingBookmark.id))
    setEditingBookmark(null)
  }

  const allBookmarks = flatBookmarks(bookmarks)
  const filteredBks = search.trim()
    ? allBookmarks.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()) || b.url.toLowerCase().includes(search.toLowerCase()))
    : allBookmarks
  const filteredHistory = search.trim()
    ? globalHistory.filter((h) => (h.title ?? "").toLowerCase().includes(search.toLowerCase()) || h.url.toLowerCase().includes(search.toLowerCase()))
    : globalHistory
  const historyGroups = groupHistory(filteredHistory)

  const handleSelect = (url: string) => { onNavigate(url); onOpenChange(false) }

  const tileColor = (url: string) => getTabAccentColor(url)
  const tileLetter = (url: string) => (getDisplayHost(url)[0] ?? "?").toUpperCase()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          "rounded-t-[20px] p-0 flex flex-col gap-0 bg-[#f5f5f7] dark:bg-[#242426]",
          editingBookmark ? "h-auto" : "h-[76vh]",
        )}
        style={{
          transform: `translateY(${sheetDragY}px)`,
          transition: sheetReleasing ? "transform 0.25s ease" : "none",
        }}
      >

        <div
          className="shrink-0 flex justify-center pt-3 pb-0 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="w-9 h-[4px] rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        {editingBookmark ? (
          <div className="px-4 pt-4 pb-10 animate-in slide-in-from-bottom duration-200">

            <div className="flex items-center gap-3 mb-5">
              <div
                className="size-11 rounded-xl flex items-center justify-center text-[20px] font-bold text-white shrink-0"
                style={{ backgroundColor: tileColor(editingBookmark.url) }}
              >
                {tileLetter(editingBookmark.url)}
              </div>
              <p className="text-[17px] font-semibold text-foreground">{t("mobileBookmarks.editBookmark")}</p>
            </div>


            <div className="bg-white dark:bg-[#3a3a3c] rounded-2xl overflow-hidden divide-y divide-black/[0.06] dark:divide-white/[0.06] mb-4">
              <div className="flex items-center px-4 py-3 gap-3">
                <span className="text-[13px] text-foreground/40 w-10 shrink-0">{t("mobileBookmarks.titleLabel")}</span>
                <input
                  ref={editTitleRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t("mobileBookmarks.titleLabel")}
                  className="flex-1 bg-transparent outline-none text-[15px] text-foreground placeholder:text-foreground/30"
                />
              </div>
              <div className="flex items-center px-4 py-3 gap-3">
                <span className="text-[13px] text-foreground/40 w-10 shrink-0">{t("mobileBookmarks.urlLabel")}</span>
                <input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="web://…"
                  className="flex-1 bg-transparent outline-none text-[15px] text-foreground placeholder:text-foreground/30"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>


            <div className="flex flex-col gap-2">
              <button
                onClick={saveEdit}
                className="w-full py-3.5 rounded-2xl text-[16px] font-semibold text-white bg-[#0a84ff] active:opacity-80 transition-opacity"
              >
                {t("mobileBookmarks.save")}
              </button>
              <button
                onClick={deleteBookmark}
                className="w-full py-3.5 rounded-2xl text-[16px] font-semibold text-[#ff3b30] dark:text-[#ff453a] bg-white dark:bg-[#3a3a3c] active:opacity-80 transition-opacity"
              >
                {t("mobileBookmarks.deleteBookmark")}
              </button>
              <button
                onClick={() => setEditingBookmark(null)}
                className="w-full py-3.5 rounded-2xl text-[16px] font-semibold text-foreground bg-white dark:bg-[#3a3a3c] active:opacity-80 transition-opacity"
              >
                {t("mobileBookmarks.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <>

            <div className="shrink-0 flex justify-end px-4 pt-1 pb-0">
              <button
                onClick={() => onOpenChange(false)}
                className="size-8 flex items-center justify-center rounded-full bg-black/8 dark:bg-white/10 text-foreground/60"
              >
                <X className="size-4" />
              </button>
            </div>


            <div className="shrink-0 flex gap-3 px-4 pt-2 pb-0">
              <button
                onClick={() => setTab("bookmarks")}
                className={cn(
                  "flex-1 flex flex-col items-start gap-1 px-4 py-3 rounded-2xl transition-colors",
                  tab === "bookmarks" ? "bg-white dark:bg-[#3a3a3c] shadow-sm" : "bg-black/5 dark:bg-white/5",
                )}
              >
                <BookOpen className={cn("size-5", tab === "bookmarks" ? "text-[#0a84ff]" : "text-foreground/40")} />
                <span className={cn("text-[13px] font-semibold", tab === "bookmarks" ? "text-foreground" : "text-foreground/40")}>{t("mobileBookmarks.bookmarksTab")}</span>
              </button>
              <button
                onClick={() => setTab("history")}
                className={cn(
                  "flex-1 flex flex-col items-start gap-1 px-4 py-3 rounded-2xl transition-colors",
                  tab === "history" ? "bg-white dark:bg-[#3a3a3c] shadow-sm" : "bg-black/5 dark:bg-white/5",
                )}
              >
                <Clock className={cn("size-5", tab === "history" ? "text-[#ff9f0a]" : "text-foreground/40")} />
                <span className={cn("text-[13px] font-semibold", tab === "history" ? "text-foreground" : "text-foreground/40")}>{t("mobileBookmarks.historyTab")}</span>
              </button>
            </div>


            <div className="shrink-0 px-4 pt-3 pb-0">
              <div className="flex items-center gap-2 bg-black/[0.07] dark:bg-white/[0.08] rounded-[12px] px-3 py-2.5">
                <Search className="size-4 text-foreground/40 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tab === "bookmarks" ? t("mobileBookmarks.searchBookmarks") : t("mobileBookmarks.searchHistory")}
                  className="flex-1 bg-transparent outline-none text-[15px] text-foreground placeholder:text-foreground/35"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="shrink-0 text-foreground/30">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>


            <div className="flex-1 min-h-0 overflow-y-auto mt-3">
              {tab === "bookmarks" ? (
                filteredBks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-foreground/35">
                    <BookOpen className="size-8" />
                    <span className="text-[14px]">{t("mobileBookmarks.noBookmarks")}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 px-4 pb-6">
                    {filteredBks.map((b) => (
                      <button
                        key={b.id}
                        onPointerDown={() => startPress(b)}
                        onPointerUp={cancelPress}
                        onPointerLeave={cancelPress}
                        onPointerCancel={cancelPress}
                        onClick={() => { if (!didLongPress.current) handleSelect(b.url) }}
                        className="flex flex-col items-start gap-2 p-3 rounded-2xl bg-white dark:bg-[#3a3a3c] active:opacity-70 transition-opacity text-start shadow-sm select-none"
                      >
                        <div
                          className="size-10 rounded-xl flex items-center justify-center text-[18px] font-bold text-white"
                          style={{ backgroundColor: tileColor(b.url) }}
                        >
                          {tileLetter(b.url)}
                        </div>
                        <div className="min-w-0 w-full">
                          <p className="text-[13px] font-medium text-foreground truncate leading-snug">{b.title || getDisplayHost(b.url)}</p>
                          <p className="text-[11px] text-foreground/40 truncate">{getDisplayHost(b.url)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                historyGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-foreground/35">
                    <Clock className="size-8" />
                    <span className="text-[14px]">{t("mobileBookmarks.noHistory")}</span>
                  </div>
                ) : (
                  <div className="pb-6">
                    {historyGroups.map(({ label, items }) => (
                      <div key={label}>
                        <div className="px-5 pt-4 pb-1">
                          <span className="text-[12px] font-semibold uppercase tracking-wider text-foreground/40">{label}</span>
                        </div>
                        <div className="mx-4 rounded-2xl bg-white dark:bg-[#3a3a3c] overflow-hidden shadow-sm divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                          {items.map((h, i) => (
                            <button
                              key={i}
                              onClick={() => handleSelect(h.url)}
                              className="flex items-center gap-3 w-full px-4 py-3 text-start active:bg-black/5 dark:active:bg-white/5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] text-foreground truncate">{h.title || getDisplayHost(h.url)}</p>
                                <p className="text-[11px] text-foreground/40 truncate">{getDisplayHost(h.url)}</p>
                              </div>
                              <ChevronRight className="size-4 text-foreground/20 shrink-0 rtl:scale-x-[-1]" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}


let nextId = 2

function makeTab(url = "about:newtab"): Tab {
  return { id: String(nextId++), title: "", url, history: [], historyIndex: -1 }
}

function extractPageTitle(html: string, fallback: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return m?.[1]?.trim() || fallback
}

const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3.0

export default function App() {
  const [{ tabs, activeTabId }, setTabsState] = useState({
    tabs: [{ id: "1", title: "", url: "about:newtab", history: [], historyIndex: -1 }] as Tab[],
    activeTabId: "1",
  })

  const setTabs = useCallback(
    (fn: (prev: Tab[]) => Tab[]) => setTabsState((s) => ({ ...s, tabs: fn(s.tabs) })),
    [],
  )
  const setActiveTabId = useCallback(
    (id: string) => setTabsState((s) => ({ ...s, activeTabId: id })),
    [],
  )
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState<BrowserSettings>(loadSettings)
  const [zoom, setZoom] = useState(() => loadSettings().defaultZoom)
  const [findOpen, setFindOpen] = useState(false)
  const [bookmarks, setBookmarks] = useState<BookmarkTree>(loadBookmarks)
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingComplete())
  const [tourTip, setTourTip] = useState<null | "address-bar" | "swipe-up" | "bookmarks" | "bookmarks-opened" | "more-options" | "more-options-opened" | "new-tab" | "swipe-to-close">(null)
const [globalHistory, setGlobalHistory] = useState<HistoryEntry[]>(loadGlobalHistory)
  const [tabSwitcherOpen, setTabSwitcherOpen] = useState(false)
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false)
  const [bookmarksSheetOpen, setBookmarksSheetOpen] = useState(false)
  const [currentVersion, setCurrentVersion] = useState("")
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; releaseUrl: string } | null>(null)

  const tourTipRef = useRef(tourTip)
  useEffect(() => { tourTipRef.current = tourTip }, [tourTip])

  const isMobile = useMemo(() => {
    if (settings.developerForceMobileUi === "mobile") return true
    if (settings.developerForceMobileUi === "desktop") return false
    return navigator.maxTouchPoints > 1
  }, [settings.developerForceMobileUi])

  useEffect(() => {
    if (isMobile) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(screen.orientation as any)?.lock?.("portrait").catch(() => {})
    }
  }, [isMobile])

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const version = await invoke<string>("get_app_version")
        setCurrentVersion(version)
        const res = await fetch("https://api.github.com/repos/usenwep/eclipse-browser/releases/latest")
        if (!res.ok) return
        const data = await res.json()
        const latest = (data.tag_name as string | undefined)?.replace(/^v/, "")
        if (latest && latest !== version) {
          setUpdateAvailable({ version: latest, releaseUrl: data.html_url as string })
        }
      } catch {
        // silently fail (no network, rate limit, etc.)
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = useCallback(async () => {
    if (!updateAvailable) return
    if (isMobile) {
      await openUrl(updateAvailable.releaseUrl)
      return
    }
    try {
      const { check } = await import("@tauri-apps/plugin-updater")
      const { relaunch } = await import("@tauri-apps/plugin-process")
      const update = await check()
      if (update) {
        await update.downloadAndInstall()
        await relaunch()
      } else {
        await openUrl(updateAvailable.releaseUrl)
      }
    } catch {
      await openUrl(updateAvailable.releaseUrl)
    }
  }, [updateAvailable, isMobile])

  const contentFrameRef = useRef<ContentFrameHandle>(null)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const canGoBack = activeTab.historyIndex > 0
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1
  const canPrint = activeTab.content != null

  useEffect(() => {
    document.documentElement.style.zoom = String(settings.uiScale)
  }, [settings.uiScale])

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))
  const zoomReset = () => setZoom(1.0)

  const fetchAndLoad = async (url: string, tabId: string) => {
    setIsLoading(true)
    try {
      const result = await invoke<NwepResult>("nwep_fetch", { url })

      const connectionInfo: ConnectionInfo | undefined = result.log.length > 0
        ? {
            clientNodeId: result.connection?.client_node_id,
            serverNodeId: result.connection?.server_node_id,
            serverPubkey: result.connection?.server_pubkey,
            log: result.log,
          }
        : undefined

      if (!result.ok) {
        setTabs((prev) => prev.map((tab) => tab.id === tabId
          ? { ...tab, error: result.error ?? "Unknown error", connectionInfo }
          : tab))
        return
      }

      const title = extractPageTitle(result.body!, getDisplayHost(url))
      setTabs((prev) => prev.map((tab) => tab.id === tabId
        ? { ...tab, content: result.body!, title, connectionInfo }
        : tab))
      if (settings.historyEnabled) {
        setGlobalHistory((prev) => {
          const next = [{ url, title, timestamp: Date.now() }, ...prev.filter((e) => e.url !== url)].slice(0, MAX_HISTORY)
          saveGlobalHistory(next)
          return next
        })
      }
    } catch (err) {
      setTabs((prev) => prev.map((tab) => tab.id === tabId ? { ...tab, error: String(err) } : tab))
    } finally {
      setIsLoading(false)
    }
  }

  const navigate = (url: string) => {
    const tabId = activeTabId
    setFindOpen(false)
    setTabs((prev) => prev.map((tab) => {
      if (tab.id !== tabId) return tab
      const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), url]
      return { ...tab, url, title: url, content: undefined, error: undefined, connectionInfo: undefined, history: newHistory, historyIndex: newHistory.length - 1 }
    }))
    if (!url.startsWith("about:")) fetchAndLoad(url, tabId)
  }

  const goBack = () => {
    const tab = activeTab
    if (tab.historyIndex <= 0) return
    const newIdx = tab.historyIndex - 1
    const url = tab.history[newIdx]
    setFindOpen(false)
    setTabs((prev) => prev.map((tab) =>
      tab.id === activeTabId ? { ...tab, url, title: url, content: undefined, error: undefined, connectionInfo: undefined, historyIndex: newIdx } : tab
    ))
    if (!url.startsWith("about:")) fetchAndLoad(url, activeTabId)
  }

  const goForward = () => {
    const tab = activeTab
    if (tab.historyIndex >= tab.history.length - 1) return
    const newIdx = tab.historyIndex + 1
    const url = tab.history[newIdx]
    setFindOpen(false)
    setTabs((prev) => prev.map((tab) =>
      tab.id === activeTabId ? { ...tab, url, title: url, content: undefined, error: undefined, connectionInfo: undefined, historyIndex: newIdx } : tab
    ))
    if (!url.startsWith("about:")) fetchAndLoad(url, activeTabId)
  }

  const goToHistory = (index: number) => {
    const tab = activeTab
    if (index < 0 || index >= tab.history.length || index === tab.historyIndex) return
    const url = tab.history[index]
    setFindOpen(false)
    setTabs((prev) => prev.map((tab) =>
      tab.id === activeTabId ? { ...tab, url, title: url, content: undefined, error: undefined, historyIndex: index } : tab
    ))
    if (!url.startsWith("about:")) fetchAndLoad(url, activeTabId)
  }

  const persistBookmarks = (tree: BookmarkTree) => {
    saveBookmarks(tree)
    setBookmarks(tree)
  }

  const addBookmark = (url: string, title: string) => {
    if (isBookmarked(bookmarks, url)) return
    persistBookmarks(
      addNode(bookmarks, null, {
        id: genId(),
        type: "bookmark",
        url,
        title: title || getDisplayHost(url),
      })
    )
  }

  const removeBookmarkById = (id: string) => {
    persistBookmarks(removeNode(bookmarks, id))
  }

  const addAllBookmarks = () => {
    let tree = bookmarks
    for (const tab of tabs) {
      if (!tab.url.startsWith("about:") && !isBookmarked(tree, tab.url)) {
        tree = addNode(tree, null, {
          id: genId(),
          type: "bookmark",
          url: tab.url,
          title: tab.title || getDisplayHost(tab.url),
        })
      }
    }
    persistBookmarks(tree)
  }

  const toggleBookmarkForTab = useCallback(() => {
    const tab = tabs.find((tab) => tab.id === activeTabId)
    if (!tab || tab.url.startsWith("about:")) return
    setBookmarks((prev) => {
      const next = isBookmarked(prev, tab.url)
        ? removeByUrl(prev, tab.url)
        : addNode(prev, null, {
            id: genId(),
            type: "bookmark",
            url: tab.url,
            title: tab.title || getDisplayHost(tab.url),
          })
      saveBookmarks(next)
      return next
    })
  }, [tabs, activeTabId])

  const persistSettings = (s: BrowserSettings) => {
    saveSettings(s)
    setSettings(s)
  }

  const clearAllHistory = () => {
    setTabs((prev) => prev.map((tab) => ({ ...tab, history: tab.url.startsWith("about:") ? [] : [tab.url], historyIndex: tab.url.startsWith("about:") ? -1 : 0 })))
    setGlobalHistory([])
    saveGlobalHistory([])
  }

  const clearGlobalHistory = () => {
    setGlobalHistory([])
    saveGlobalHistory([])
  }

  const removeHistoryEntry = (url: string) => {
    setGlobalHistory((prev) => {
      const next = prev.filter((e) => e.url !== url)
      saveGlobalHistory(next)
      return next
    })
  }

  const reorderTabs = (reordered: Tab[]) => setTabsState((s) => ({ ...s, tabs: reordered }))

  const addTab = () => {
    const url = settings.newTabAction === "homepage" && settings.homepage
      ? settings.homepage
      : "about:newtab"
    const tab = makeTab(url)
    setTabsState((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    setFindOpen(false)
    if (!url.startsWith("about:")) fetchAndLoad(url, tab.id)
  }

  const addTabBackground = () => {
    const url = settings.newTabAction === "homepage" && settings.homepage
      ? settings.homepage
      : "about:newtab"
    const tab = makeTab(url)
    setTabsState((s) => ({ tabs: [...s.tabs, tab], activeTabId: s.activeTabId }))
    if (!url.startsWith("about:")) fetchAndLoad(url, tab.id)
  }

  const openInNewTab = (url: string) => {
    const tab = makeTab(url)
    setTabsState((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    setFindOpen(false)
    fetchAndLoad(url, tab.id)
  }

  const savePage = async () => {
    const content = activeTab.content
    if (!content) return
    const defaultName = (activeTab.title || getDisplayHost(activeTab.url) || "page")
      .replace(/[/\\:*?"<>|]/g, "-") + ".html"
    const path = await saveDialog({
      title: "Save Page As",
      defaultPath: defaultName,
      filters: [{ name: "Web Page", extensions: ["html"] }],
    })
    if (path) await writeTextFile(path, content)
  }

  const closeTab = (id: string) => {
    setTabsState((s) => {
      const idx = s.tabs.findIndex((tab) => tab.id === id)
      const next = s.tabs.filter((tab) => tab.id !== id)
      const newActiveId =
        id === s.activeTabId && next.length > 0
          ? next[Math.max(0, idx - 1)].id
          : s.activeTabId
      return { tabs: next, activeTabId: newActiveId }
    })
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn() }
        else if (e.key === "-") { e.preventDefault(); zoomOut() }
        else if (e.key === "0") { e.preventDefault(); zoomReset() }
        else if (e.key === "f") { e.preventDefault(); setFindOpen(true) }
        else if (e.key === "p") { e.preventDefault(); contentFrameRef.current?.print() }
        else if (e.key === "d") { e.preventDefault(); toggleBookmarkForTab() }
      }
      if (e.key === "Escape" && findOpen) setFindOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [findOpen, toggleBookmarkForTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const contentArea = (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#1c1c1e]">
      {activeTab.url === "about:settings" ? (
        <SettingsPage
          settings={settings}
          onChange={persistSettings}
          onClearHistory={clearAllHistory}
          onOpenHistory={() => navigate("about:history")}
          onResetOnboarding={() => { resetOnboarding(); setShowOnboarding(true) }}
          isMobile={isMobile}
          currentVersion={currentVersion}
          updateAvailable={updateAvailable}
          onUpdate={handleUpdate}
        />
      ) : activeTab.url === "about:history" ? (
        <HistoryPage
          entries={globalHistory}
          onNavigate={navigate}
          onRemove={removeHistoryEntry}
          onClearAll={clearGlobalHistory}
          isMobile={isMobile}
        />
      ) : activeTab.url === "about:newtab" && isMobile ? (
        <MobileStartPage bookmarks={bookmarks} onNavigate={navigate} />
      ) : activeTab.error ? (
        <ErrorPage
          error={activeTab.error}
          url={activeTab.url}
          onRetry={() => navigate(activeTab.url)}
        />
      ) : activeTab.content != null ? (
        <ContentFrame ref={contentFrameRef} url={activeTab.url} content={activeTab.content} zoom={zoom} />
      ) : null}
      {findOpen && activeTab.url !== "about:settings" && (
        <FindBar
          onSearch={(term) => contentFrameRef.current?.search(term) ?? { total: 0, current: 0 }}
          onNext={() => contentFrameRef.current?.findNext() ?? { total: 0, current: 0 }}
          onPrev={() => contentFrameRef.current?.findPrev() ?? { total: 0, current: 0 }}
          onClose={() => { contentFrameRef.current?.clearSearch(); setFindOpen(false) }}
        />
      )}
    </div>
  )

  return (
    <div
      className={cn(
        "flex flex-col h-screen w-screen overflow-hidden",
        isMobile
          ? "bg-[#f2f2f7] dark:bg-[#1c1c1e]"
          : "bg-[#e5e5e7] dark:bg-[#38393a] rounded-[10px] ring-1 ring-black/20 dark:ring-black/60 shadow-[0_0_0_0.5px_rgba(0,0,0,0.3),0_20px_40px_rgba(0,0,0,0.25),0_8px_16px_rgba(0,0,0,0.15)]",
      )}
    >
      <ContextMenuOverlay
        onOpenInNewTab={openInNewTab}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        canSave={canPrint}
        pageUrl={activeTab.url}
        onBack={goBack}
        onForward={goForward}
        onReload={() => navigate(activeTab.url)}
        onSavePage={savePage}
      />

      {isMobile ? (
        <>

          <div className="shrink-0" style={{ height: 'env(safe-area-inset-top)' }} />

          <div className="relative h-[2px] shrink-0 bg-transparent overflow-hidden">
            {isLoading && (
              <div className="mobile-loading-bar absolute inset-y-0 w-1/3 bg-[#0a84ff]" />
            )}
          </div>


          <PullToRefresh
            onRefresh={() => navigate(activeTab.url)}
            enabled={!activeTab.url.startsWith("about:")}
          >
            {contentArea}
          </PullToRefresh>


          {updateAvailable && (
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-[#0a84ff]/10 border-t border-[#0a84ff]/20">
              <span className="text-[13px] text-[#0a84ff] leading-tight">
                Update available: v{updateAvailable.version}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleUpdate}
                  className="rounded-md font-medium h-7 px-3 text-[12px] bg-[#0a84ff] text-white active:opacity-70"
                >
                  Update
                </button>
                <button
                  onClick={() => setUpdateAvailable(null)}
                  className="text-[#0a84ff] active:opacity-70"
                  aria-label="Dismiss"
                >
                  <X className="size-[14px]" />
                </button>
              </div>
            </div>
          )}

          <MobileBottomChrome
            url={activeTab.url}
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={(id) => { setActiveTabId(id); if (tourTip === "address-bar") setTourTip("swipe-up") }}
            onShowTabs={() => { setTabSwitcherOpen(true); if (tourTipRef.current === "swipe-up") setTourTip("bookmarks") }}
            onNavigate={navigate}
            onNewTab={() => { addTab(); if (tourTip === "address-bar") setTourTip("swipe-up") }}
            bookmarks={bookmarks}
            globalHistory={globalHistory}
            searchBookmarks={settings.searchBookmarks}
            searchHistory={settings.searchHistory}
          />


          {tabSwitcherOpen && (
            <MobileTabSwitcher
              tabs={tabs}
              activeTabId={activeTabId}
              onSelect={(id) => { setActiveTabId(id); setTabSwitcherOpen(false) }}
              onClose={closeTab}
              onNewTab={() => { addTabBackground(); if (tourTipRef.current === "new-tab") setTourTip("swipe-to-close") }}
              onOpenBookmarks={() => { setBookmarksSheetOpen(true); if (tourTip === "bookmarks") setTourTip("bookmarks-opened") }}
              onMenu={() => { setOptionsSheetOpen(true); if (tourTipRef.current === "more-options") setTourTip("more-options-opened") }}
              onDone={() => { setTabSwitcherOpen(false); if (tourTipRef.current === "more-options" || tourTipRef.current === "new-tab" || tourTipRef.current === "swipe-to-close") setTourTip(null) }}
              onReload={() => navigate(activeTab.url)}
              showSwipeToCloseTip={tourTip === "swipe-to-close"}
              onSwipeToCloseTipDismiss={() => setTourTip(null)}
            />
          )}


          {optionsSheetOpen && (
            <MobileOptionsSheet
              canPrint={canPrint}
              canFind={canPrint}
              canReload={!activeTab.url.startsWith("about:")}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              isLoading={isLoading}
              isCurrentlyBookmarked={!!flatBookmarks(bookmarks).find((b) => b.url === activeTab.url)}
              onClose={() => { setOptionsSheetOpen(false); if (tourTipRef.current === "more-options-opened") setTourTip("new-tab") }}
              onReload={isLoading ? () => setIsLoading(false) : () => navigate(activeTab.url)}
              onBack={() => { goBack(); setOptionsSheetOpen(false); setTabSwitcherOpen(false); if (tourTipRef.current === "more-options-opened") setTourTip("new-tab") }}
              onForward={() => { goForward(); setOptionsSheetOpen(false); setTabSwitcherOpen(false); if (tourTipRef.current === "more-options-opened") setTourTip("new-tab") }}
              onFind={() => { setFindOpen(true); setOptionsSheetOpen(false); setTabSwitcherOpen(false); if (tourTipRef.current === "more-options-opened") setTourTip("new-tab") }}
              onPrint={() => contentFrameRef.current?.print()}
              onToggleBookmark={toggleBookmarkForTab}
              onOpenSettings={() => { navigate("about:settings"); setOptionsSheetOpen(false); setTabSwitcherOpen(false); if (tourTipRef.current === "more-options-opened") setTourTip("new-tab") }}
            />
          )}


          <MobileBookmarksSheet
            open={bookmarksSheetOpen}
            onOpenChange={(open) => { setBookmarksSheetOpen(open); if (!open && tourTipRef.current === "bookmarks-opened") setTourTip("more-options") }}
            bookmarks={bookmarks}
            globalHistory={globalHistory}
            onNavigate={(url) => { navigate(url); setBookmarksSheetOpen(false) }}
            onTreeChange={persistBookmarks}
          />

        </>
      ) : (
        <>

          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={closeTab}
            onNewTab={addTab}
            onReorderTabs={reorderTabs}
          />
          <NavBar
            url={activeTab.url}
            isLoading={isLoading}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            zoom={zoom}
            tabHistory={activeTab.history}
            tabHistoryIndex={activeTab.historyIndex}
            canPrint={canPrint}
            currentTitle={activeTab.title || getDisplayHost(activeTab.url)}
            bookmarks={bookmarks}
            onBack={goBack}
            onForward={goForward}
            onReload={() => navigate(activeTab.url)}
            onStop={() => setIsLoading(false)}
            onNavigate={navigate}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={zoomReset}
            onFind={() => setFindOpen(true)}
            onPrint={() => contentFrameRef.current?.print()}
            onHistoryNavigate={goToHistory}
            onAddBookmark={addBookmark}
            onRemoveBookmark={removeBookmarkById}
            onAddAllBookmarks={addAllBookmarks}
            onTreeChange={persistBookmarks}
            onOpenSettings={() => navigate("about:settings")}
            onOpenHistory={() => navigate("about:history")}
            globalHistory={globalHistory}
            searchBookmarks={settings.searchBookmarks}
            searchHistory={settings.searchHistory}
            connectionInfo={activeTab.connectionInfo}
            updateAvailable={updateAvailable}
            onUpdate={handleUpdate}
          />
          {contentArea}
        </>
      )}
{showOnboarding && isMobile && (
        <OnboardingOverlay
          onComplete={(wantsTour) => { markOnboardingComplete(); setShowOnboarding(false); if (wantsTour) setTourTip("address-bar") }}
        />
      )}

      {tourTip === "address-bar" && isMobile && (
        <TourTip
          title={t("tourTips.addressBar.title")}
          body={t("tourTips.addressBar.body")}
          onDismiss={() => setTourTip("swipe-up")}
        />
      )}
      {tourTip === "swipe-up" && isMobile && (
        <TourTip
          title={t("tourTips.seeYourTabs.title")}
          body={t("tourTips.seeYourTabs.body")}
          onDismiss={() => setTourTip(null)}
        />
      )}
      {tourTip === "bookmarks" && isMobile && (
        <TourTip
          title={t("tourTips.bookmarksHistory.title")}
          body={t("tourTips.bookmarksHistory.body")}
          onDismiss={() => setTourTip(null)}
          arrowLeft={36}
        />
      )}
      {tourTip === "more-options" && isMobile && (
        <TourTip
          title={t("tourTips.moreOptions.title")}
          body={t("tourTips.moreOptions.body")}
          onDismiss={() => setTourTip(null)}
          arrowRight={45}
        />
      )}
      {tourTip === "new-tab" && isMobile && (
        <TourTip
          title={t("tourTips.newTab.title")}
          body={t("tourTips.newTab.body")}
          onDismiss={() => setTourTip(null)}
          arrowLeft={134}
        />
      )}
    </div>
  )
}
