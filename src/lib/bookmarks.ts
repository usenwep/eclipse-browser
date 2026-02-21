export interface BookmarkNode {
  id: string
  type: "bookmark" | "folder"
  title: string
  url?: string
  children?: BookmarkNode[]
}

export type BookmarkTree = BookmarkNode[]

const STORAGE_KEY = "nwep-bookmarks-v2"

let _seq = Date.now()
export function genId(): string {
  return `bk_${_seq++}`
}

export function loadBookmarks(): BookmarkTree {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function saveBookmarks(tree: BookmarkTree): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree))
}

export function mapTree(
  tree: BookmarkTree,
  fn: (node: BookmarkNode) => BookmarkNode
): BookmarkTree {
  return tree.map((node) => {
    const mapped = fn(node)
    if (mapped.type === "folder" && mapped.children) {
      return { ...mapped, children: mapTree(mapped.children, fn) }
    }
    return mapped
  })
}

export function addNode(
  tree: BookmarkTree,
  parentId: string | null,
  node: BookmarkNode
): BookmarkTree {
  if (parentId === null) return [...tree, node]
  return mapTree(tree, (n) => {
    if (n.id === parentId && n.type === "folder") {
      return { ...n, children: [...(n.children ?? []), node] }
    }
    return n
  })
}

export function updateNode(
  tree: BookmarkTree,
  id: string,
  patch: Partial<BookmarkNode>
): BookmarkTree {
  return mapTree(tree, (n) => (n.id === id ? { ...n, ...patch } : n))
}

export function removeNode(tree: BookmarkTree, id: string): BookmarkTree {
  return tree
    .filter((n) => n.id !== id)
    .map((n) =>
      n.type === "folder" && n.children
        ? { ...n, children: removeNode(n.children, id) }
        : n
    )
}

export function flatBookmarks(
  tree: BookmarkTree
): Array<{ id: string; url: string; title: string }> {
  const result: Array<{ id: string; url: string; title: string }> = []
  function walk(nodes: BookmarkTree) {
    for (const node of nodes) {
      if (node.type === "bookmark" && node.url) {
        result.push({ id: node.id, url: node.url, title: node.title })
      } else if (node.type === "folder" && node.children) {
        walk(node.children)
      }
    }
  }
  walk(tree)
  return result
}

export function isBookmarked(tree: BookmarkTree, url: string): boolean {
  return flatBookmarks(tree).some((b) => b.url === url)
}

export function removeByUrl(tree: BookmarkTree, url: string): BookmarkTree {
  const toRemove = flatBookmarks(tree).filter((b) => b.url === url)
  let result = tree
  for (const b of toRemove) result = removeNode(result, b.id)
  return result
}

export function getNodeAtPath(
  tree: BookmarkTree,
  path: string[]
): BookmarkTree {
  let current = tree
  for (const id of path) {
    const folder = current.find((n) => n.id === id && n.type === "folder")
    if (!folder) return []
    current = folder.children ?? []
  }
  return current
}

export function getFolderTitle(
  tree: BookmarkTree,
  id: string
): string | undefined {
  function walk(nodes: BookmarkTree): string | undefined {
    for (const n of nodes) {
      if (n.id === id) return n.title
      if (n.type === "folder" && n.children) {
        const found = walk(n.children)
        if (found !== undefined) return found
      }
    }
    return undefined
  }
  return walk(tree)
}

export function reorderInParent(
  tree: BookmarkTree,
  parentId: string | null,
  fromIndex: number,
  toIndex: number
): BookmarkTree {
  const reorder = (nodes: BookmarkNode[]): BookmarkNode[] => {
    const arr = [...nodes]
    const [item] = arr.splice(fromIndex, 1)
    arr.splice(toIndex, 0, item)
    return arr
  }
  if (parentId === null) return reorder(tree)
  return mapTree(tree, (node) =>
    node.id === parentId && node.type === "folder" && node.children
      ? { ...node, children: reorder(node.children) }
      : node
  )
}

export function moveNodeIntoFolder(
  tree: BookmarkTree,
  nodeId: string,
  folderId: string | null
): BookmarkTree {
  let extracted: BookmarkNode | null = null
  const without = (nodes: BookmarkTree): BookmarkTree =>
    nodes.reduce<BookmarkTree>((acc, node) => {
      if (node.id === nodeId) { extracted = node; return acc }
      acc.push(
        node.type === "folder" && node.children
          ? { ...node, children: without(node.children) }
          : node
      )
      return acc
    }, [])
  const stripped = without(tree)
  if (!extracted) return tree
  return addNode(stripped, folderId, extracted)
}
