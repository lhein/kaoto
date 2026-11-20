import { createStore } from 'zustand/vanilla';

import { ExplorerFile } from './explorer-file';
import { expandWithParents, NewEntryPlacement } from './explorer-tree';
import { moveExpandedFolders } from './move-expanded-folders';

/**
 * What the Explorer is doing right now. The modes exclude each other: starting one ends the one before, so there is
 * never a rename field next to a delete confirmation.
 */
export type ExplorerMode =
  | { kind: 'idle' }
  /** A name field in the tree for a new file or folder */
  | {
      kind: 'creating';
      entryKind: NewEntryPlacement['kind'];
      /** The folder it is created in, empty for the root */
      folderPath: string;
      /** Changes with every start, so that a new start mounts a new field */
      key: number;
      /** The button that started creating, focused again when creating is cancelled from the keyboard */
      opener: HTMLElement;
    }
  /** The Create new file dialog, with the element that opened it */
  | { kind: 'createDialog'; opener: HTMLElement }
  /** A name field in place of the file or folder with this tree node id */
  | { kind: 'renaming'; nodeId: string }
  /** The delete confirmation, with the path the entry had when it was asked for */
  | { kind: 'deleting'; node: ExplorerFile; path: string };

export interface ExplorerState {
  searchText: string;
  /** Folder node ids; a folder that is missing is collapsed */
  expandedFolders: Record<string, boolean>;
  mode: ExplorerMode;
  /**
   * The tree item that had the focus last, or `ROOT_TARGET`: clicking a toolbar button takes the focus away from it,
   * and a new entry goes into its folder.
   */
  lastFocusedNodeId: string | undefined;
  /** Counts the starts of creating in the tree */
  createCount: number;
}

export interface ExplorerActions {
  setSearchText: (searchText: string) => void;
  toggleFolder: (folderId: string, expanded: boolean) => void;
  /** Remembers the tree item that got the focus; `undefined` forgets it */
  setLastFocusedNode: (nodeId: string | undefined) => void;

  openCreateDialog: (opener: HTMLElement) => void;
  /** Shows the name field of a new entry in the folder: clears the search, which would hide it, and opens the folder */
  startCreate: (entry: NewEntryPlacement, opener: HTMLElement) => void;
  startRename: (nodeId: string) => void;
  requestDelete: (node: ExplorerFile, path: string) => void;
  /**
   * Ends the mode of this kind. A field or dialog that reports late, after another mode started, leaves that mode
   * alone.
   */
  endMode: (kind: ExplorerMode['kind']) => void;

  /** Keeps a renamed folder and its subfolders expanded: their node ids follow the paths */
  folderRenamed: (fromPath: string, toPath: string) => void;
}

export type ExplorerStore = ReturnType<typeof createExplorerStore>;

const IDLE: ExplorerMode = { kind: 'idle' };

/**
 * The state of one Explorer and the only place that changes it. Every Explorer creates its own store, so the state
 * lives as long as the component and nothing has to be reset between two of them.
 */
export const createExplorerStore = () =>
  createStore<ExplorerState & ExplorerActions>()((set) => ({
    searchText: '',
    expandedFolders: {},
    mode: IDLE,
    lastFocusedNodeId: undefined,
    createCount: 0,

    setSearchText: (searchText) => {
      set({ searchText });
    },
    toggleFolder: (folderId, expanded) => {
      set((state) => ({ expandedFolders: { ...state.expandedFolders, [folderId]: expanded } }));
    },
    setLastFocusedNode: (nodeId) => {
      set({ lastFocusedNodeId: nodeId });
    },

    openCreateDialog: (opener) => {
      set({ mode: { kind: 'createDialog', opener } });
    },
    startCreate: (entry, opener) => {
      set((state) => ({
        searchText: '',
        expandedFolders: expandWithParents(state.expandedFolders, entry.folderPath),
        createCount: state.createCount + 1,
        mode: {
          kind: 'creating',
          entryKind: entry.kind,
          folderPath: entry.folderPath,
          key: state.createCount + 1,
          opener,
        },
      }));
    },
    startRename: (nodeId) => {
      set({ mode: { kind: 'renaming', nodeId } });
    },
    requestDelete: (node, path) => {
      set({ mode: { kind: 'deleting', node, path } });
    },
    endMode: (kind) => {
      set((state) => (state.mode.kind === kind ? { mode: IDLE } : {}));
    },

    folderRenamed: (fromPath, toPath) => {
      set((state) => ({ expandedFolders: moveExpandedFolders(state.expandedFolders, fromPath, toPath) }));
    },
  }));
