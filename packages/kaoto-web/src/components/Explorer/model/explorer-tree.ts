import { toFolderId } from './build-tree';
import { ExplorerFile } from './explorer-file';

/**
 * Operations on the Explorer tree that need no React: where a new entry goes, which node stands for it, and which
 * folders open for it. The Explorer component calls them and keeps the state.
 */

/** The id of the tree node that holds the name field of a new file or folder */
export const NEW_ENTRY_ID = 'new-entry:';

/** Stands for the root in the last focused tree item, after a click on the free space of the tree */
export const ROOT_TARGET = 'root:';

/** The key of a tree row: the node id, and for the new entry also its start, so that every start mounts a new field */
export const getNodeKey = (node: ExplorerFile, newEntryKey: number | undefined): string =>
  node.id === NEW_ENTRY_ID ? `${NEW_ENTRY_ID}${newEntryKey ?? ''}` : node.id;

/** Where a new file or folder is being created */
export interface NewEntryPlacement {
  kind: 'file' | 'folder';
  /** The folder it is created in, empty for the root */
  folderPath: string;
}

/** The node that stands for the new entry while it is named: it has no path yet */
const newEntryNode = (kind: NewEntryPlacement['kind']): ExplorerFile =>
  kind === 'folder'
    ? { kind, id: NEW_ENTRY_ID, name: '', path: '', type: 'folder', children: [] }
    : { kind, id: NEW_ENTRY_ID, name: '', path: '', type: 'document' };

/** Puts the node of the new entry into its folder: a folder first among the folders, a file first among the files */
export function insertNewEntry(nodes: ExplorerFile[], entry: NewEntryPlacement): ExplorerFile[] {
  const node = newEntryNode(entry.kind);
  const insert = (siblings: ExplorerFile[]) => {
    const index = entry.kind === 'folder' ? 0 : siblings.findIndex((sibling) => sibling.kind === 'file');
    const at = index === -1 ? siblings.length : index;
    return [...siblings.slice(0, at), node, ...siblings.slice(at)];
  };
  if (!entry.folderPath) return insert(nodes);

  return nodes.map((candidate) => {
    if (candidate.kind !== 'folder') return candidate;
    if (candidate.path === entry.folderPath) return { ...candidate, children: insert(candidate.children) };
    if (entry.folderPath.startsWith(`${candidate.path}/`)) {
      return { ...candidate, children: insertNewEntry(candidate.children, entry) };
    }
    return candidate;
  });
}

/** The folder paths from the outermost folder down to the folder itself */
const folderAndParents = (folderPath: string): string[] =>
  folderPath ? folderPath.split('/').map((_, index, segments) => segments.slice(0, index + 1).join('/')) : [];

/** The expansion state with the folder and all the folders around it expanded; the root needs none */
export const expandWithParents = (
  expandedFolders: Record<string, boolean>,
  folderPath: string,
): Record<string, boolean> => ({
  ...expandedFolders,
  ...Object.fromEntries(folderAndParents(folderPath).map((path) => [toFolderId(path), true])),
});

interface TargetFolderInput {
  /** The id of the tree item that had the focus last, or `ROOT_TARGET` */
  lastFocused: string | undefined;
  /** The id of the open file */
  selectedId: string | undefined;
  /** The whole tree, without a search filter */
  tree: ExplorerFile[];
}

/** The node with the id, wherever it is in the tree */
export function findNode(nodes: ExplorerFile[], id: string | undefined): ExplorerFile | undefined {
  if (id === undefined) return undefined;
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = node.kind === 'folder' ? findNode(node.children, id) : undefined;
    if (found) return found;
  }
  return undefined;
}

const folderOf = (path: string): string => path.slice(0, Math.max(path.lastIndexOf('/'), 0));

/**
 * The folder a new entry goes into: the last focused tree item's, else the open file's, else the root. A tree item that
 * was renamed or deleted since it had the focus is not in the tree any more and does not count.
 */
export function targetFolderPath({ lastFocused, selectedId, tree }: TargetFolderInput): string {
  if (lastFocused === ROOT_TARGET) return '';
  const node = findNode(tree, lastFocused) ?? findNode(tree, selectedId);
  if (!node) return '';
  return node.kind === 'folder' ? node.path : folderOf(node.path);
}
