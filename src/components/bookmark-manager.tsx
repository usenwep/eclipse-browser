import { useState, useRef, useEffect, KeyboardEvent } from "react"
import {
  Bookmark,
  Folder,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import {
  BookmarkNode,
  BookmarkTree,
  addNode,
  updateNode,
  removeNode,
  getNodeAtPath,
  getFolderTitle,
  genId,
} from "@/lib/bookmarks"

interface BookmarkManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tree: BookmarkTree
  onTreeChange: (tree: BookmarkTree) => void
  onNavigate?: (url: string) => void
}

type AddMode = "none" | "bookmark" | "folder"

export function BookmarkManager({
  open,
  onOpenChange,
  tree,
  onTreeChange,
  onNavigate,
}: BookmarkManagerProps) {
  const [path, setPath] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editUrl, setEditUrl] = useState("")
  const [addMode, setAddMode] = useState<AddMode>("none")
  const [addTitle, setAddTitle] = useState("")
  const [addUrl, setAddUrl] = useState("")
  const addTitleRef = useRef<HTMLInputElement>(null)
  const editTitleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setPath([])
      setEditingId(null)
      setAddMode("none")
      setAddTitle("")
      setAddUrl("")
    }
  }, [open])

  useEffect(() => {
    if (addMode !== "none") {
      setTimeout(() => addTitleRef.current?.focus(), 0)
    }
  }, [addMode])

  useEffect(() => {
    if (editingId) {
      setTimeout(() => editTitleRef.current?.focus(), 0)
    }
  }, [editingId])

  const currentItems = getNodeAtPath(tree, path)
  const parentId = path.length > 0 ? path[path.length - 1] : null

  const enterFolder = (id: string) => {
    setPath((p) => [...p, id])
    setEditingId(null)
    setAddMode("none")
  }

  const navigateBreadcrumb = (index: number) => {
    setPath((p) => p.slice(0, index))
    setEditingId(null)
    setAddMode("none")
  }

  const startEdit = (node: BookmarkNode) => {
    setEditingId(node.id)
    setEditTitle(node.title)
    setEditUrl(node.url ?? "")
    setAddMode("none")
  }

  const commitEdit = () => {
    if (!editingId || !editTitle.trim()) {
      setEditingId(null)
      return
    }
    const patch: Partial<BookmarkNode> = { title: editTitle.trim() }
    if (editUrl.trim()) patch.url = editUrl.trim()
    onTreeChange(updateNode(tree, editingId, patch))
    setEditingId(null)
  }

  const cancelEdit = () => setEditingId(null)

  const handleDelete = (id: string) => {
    onTreeChange(removeNode(tree, id))
    if (editingId === id) setEditingId(null)
  }

  const handleAdd = () => {
    if (!addTitle.trim()) return
    const node: BookmarkNode =
      addMode === "folder"
        ? { id: genId(), type: "folder", title: addTitle.trim(), children: [] }
        : {
            id: genId(),
            type: "bookmark",
            title: addTitle.trim(),
            url: addUrl.trim() || undefined,
          }
    onTreeChange(addNode(tree, parentId, node))
    setAddTitle("")
    setAddUrl("")
    setAddMode("none")
  }

  const handleAddKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleAdd()
    if (e.key === "Escape") {
      setAddMode("none")
      setAddTitle("")
      setAddUrl("")
    }
  }

  const toggleAddMode = (mode: Exclude<AddMode, "none">) => {
    setAddMode((prev) => (prev === mode ? "none" : mode))
    setAddTitle("")
    setAddUrl("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden sm:max-w-md"
        showCloseButton
      >

        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/50 gap-1.5">
          <DialogTitle className="text-sm font-medium">
            {t("bookmarkManager.title")}
          </DialogTitle>
          <div className="flex items-center gap-1 flex-wrap min-h-[1rem]">
            <button
              onClick={() => navigateBreadcrumb(0)}
              className={cn(
                "text-xs transition-colors",
                path.length === 0
                  ? "text-foreground font-medium pointer-events-none"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("nav.bookmarks")}
            </button>
            {path.map((id, i) => (
              <span key={id} className="flex items-center gap-1">
                <ChevronRight className="size-3 text-muted-foreground/40 rtl:scale-x-[-1]" />
                <button
                  onClick={() => navigateBreadcrumb(i + 1)}
                  className={cn(
                    "text-xs transition-colors",
                    i === path.length - 1
                      ? "text-foreground font-medium pointer-events-none"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {getFolderTitle(tree, id) ?? "…"}
                </button>
              </span>
            ))}
          </div>
        </DialogHeader>


        <ScrollArea className="max-h-72">
          <div className="py-1">
            {currentItems.length === 0 && addMode === "none" ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                {path.length === 0
                  ? t("bookmarkManager.noBookmarksRoot")
                  : t("bookmarkManager.emptyFolder")}
              </p>
            ) : (
              currentItems.map((node) => {
                if (editingId === node.id) {
                  return (
                    <div
                      key={node.id}
                      className="flex flex-col gap-1.5 px-3 py-2 border-b border-border/30 bg-accent/30"
                    >
                      <Input
                        ref={editTitleRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit()
                          if (e.key === "Escape") cancelEdit()
                        }}
                        placeholder={t("bookmarkManager.titlePlaceholder")}
                        className="h-7 text-xs"
                      />
                      {node.type === "bookmark" && (
                        <Input
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit()
                            if (e.key === "Escape") cancelEdit()
                          }}
                          placeholder={t("bookmarkManager.urlPlaceholder")}
                          className="h-7 text-xs font-mono"
                        />
                      )}
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={cancelEdit}
                        >
                          <X className="size-3" />
                          {t("bookmarkManager.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={commitEdit}
                          disabled={!editTitle.trim()}
                        >
                          <Check className="size-3" />
                          {t("bookmarkManager.save")}
                        </Button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={node.id}
                    className="group flex items-center gap-2 px-3 py-1.5 hover:bg-accent/40 transition-colors"
                  >
                    {node.type === "folder" ? (
                      <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <button
                      className="flex-1 min-w-0 text-start text-sm truncate"
                      onClick={() => {
                        if (node.type === "folder") {
                          enterFolder(node.id)
                        } else if (node.url && onNavigate) {
                          onNavigate(node.url)
                          onOpenChange(false)
                        }
                      }}
                      title={node.url ?? node.title}
                    >
                      {node.title || node.url}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {node.type === "folder" && (
                        <button
                          onClick={() => enterFolder(node.id)}
                          className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={t("bookmarkManager.openFolder")}
                          title={t("bookmarkManager.openFolder")}
                        >
                          <ChevronRight className="size-3 rtl:scale-x-[-1]" />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(node)}
                        className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={t("bookmarkManager.rename")}
                        title={t("bookmarkManager.rename")}
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(node.id)}
                        className="rounded p-1 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                        aria-label={t("bookmarkManager.delete")}
                        title={t("bookmarkManager.delete")}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>


        {addMode !== "none" && (
          <div className="px-3 py-2.5 border-t border-border/50 flex flex-col gap-1.5 bg-muted/20">
            <Input
              ref={addTitleRef}
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder={addMode === "folder" ? t("bookmarkManager.folderNamePlaceholder") : t("bookmarkManager.titlePlaceholder")}
              className="h-7 text-xs"
            />
            {addMode === "bookmark" && (
              <Input
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                onKeyDown={handleAddKeyDown}
                placeholder={t("bookmarkManager.urlInputPlaceholder")}
                className="h-7 text-xs font-mono"
              />
            )}
            <div className="flex gap-1 justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => {
                  setAddMode("none")
                  setAddTitle("")
                  setAddUrl("")
                }}
              >
                <X className="size-3" />
                {t("bookmarkManager.cancel")}
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={handleAdd}
                disabled={!addTitle.trim()}
              >
                <Plus className="size-3" />
                {addMode === "folder" ? t("bookmarkManager.addFolderBtn") : t("bookmarkManager.addBookmarkBtn")}
              </Button>
            </div>
          </div>
        )}


        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border/50 bg-muted/30">
          <Button
            size="sm"
            variant={addMode === "bookmark" ? "default" : "outline"}
            className="h-7 text-xs gap-1"
            onClick={() => toggleAddMode("bookmark")}
          >
            <Plus className="size-3" />
            {t("bookmarkManager.addBookmarkToolbar")}
          </Button>
          <Button
            size="sm"
            variant={addMode === "folder" ? "default" : "outline"}
            className="h-7 text-xs gap-1"
            onClick={() => toggleAddMode("folder")}
          >
            <Folder className="size-3" />
            {t("bookmarkManager.newFolderToolbar")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
