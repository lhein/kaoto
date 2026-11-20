import { StoredFile } from '../../../services/files/stored-file';
import { toFolderId, toFolderPath } from '../build-tree';
import { ExplorerFile } from '../explorer-file';

/**
 * Operations on the Explorer tree that need no React: where a new entry goes, which node stands for it, and which
 * folders open for it. The Explorer component calls them and keeps the state.
 */

/** The id of the tree node that holds the name field of a new file or folder */
export const NEW_ENTRY_ID = 'new-entry:';

/** Stands for the root in the last focused tree item, after a click on the free space of the tree */
export const ROOT_TARGET = 'root:';

/** Where a new file or folder is being created */
export interface NewEntryPlacement {
  kind: 'file' | 'folder';
  /** The folder it is created in, empty for the root */
  folderPath: string;
}

/** Whether the tree node id is the id of a folder */
export const isFolderId = (id: string): boolean => toFolderId(toFolderPath(id)) === id;

/** Puts the node of the new entry into its folder: a folder first among the folders, a file first among the files */
export function insertNewEntry(nodes: ExplorerFile[], entry: NewEntryPlacement): ExplorerFile[] {
  const node: ExplorerFile = { id: NEW_ENTRY_ID, name: '', type: entry.kind === 'folder' ? 'folder' : 'document' };
  const insert = (siblings: ExplorerFile[]) => {
    const index = entry.kind === 'folder' ? 0 : siblings.findIndex((sibling) => !sibling.children);
    const at = index === -1 ? siblings.length : index;
    return [...siblings.slice(0, at), node, ...siblings.slice(at)];
  };
  if (!entry.folderPath) return insert(nodes);

  const folderId = toFolderId(entry.folderPath);
  return nodes.map((candidate) => {
    if (!candidate.children) return candidate;
    if (candidate.id === folderId) return { ...candidate, children: insert(candidate.children) };
    if (entry.folderPath.startsWith(`${toFolderPath(candidate.id)}/`)) {
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
  files: StoredFile[];
  folders: string[];
}

const folderOf = (path: string): string => path.slice(0, Math.max(path.lastIndexOf('/'), 0));

/** The folder a new entry goes into: the last focused tree item's, else the open file's, else the root */
export function targetFolderPath({ lastFocused, selectedId, files, folders }: TargetFolderInput): string {
  if (lastFocused === ROOT_TARGET) return '';
  if (lastFocused && isFolderId(lastFocused)) {
    const folderPath = toFolderPath(lastFocused);
    // Every folder is stored, so a folder that was renamed or deleted since is gone from the list
    if (folders.includes(folderPath)) return folderPath;
  }
  const file = files.find(({ id }) => id === lastFocused) ?? files.find(({ id }) => id === selectedId);
  return file ? folderOf(file.path) : '';
}
