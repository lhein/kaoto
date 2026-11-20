import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useStore } from 'zustand';

import { useFiles } from '../../hooks/useFiles';
import { getFileType } from '../../services/files/stored-file';
import { buildTree, toFolderId } from './model/build-tree';
import { ExplorerFile } from './model/explorer-file';
import { createExplorerStore } from './model/explorer-store';
import { insertNewEntry, NewEntryPlacement, targetFolderPath } from './model/explorer-tree';
import { filterFiles } from './model/filterFiles';
import { CreatedEntry } from './NewEntryField';

/** The files that open in an editor when they are selected or created */
const OPENABLE_TYPES: ReadonlySet<ExplorerFile['type']> = new Set(['integration', 'integration-test']);

export const isOpenable = (type: ExplorerFile['type']): boolean => OPENABLE_TYPES.has(type);

/**
 * Where the focus goes once a field or dialog closes: it unmounts, so the focus goes back by hand. Every request is a
 * new object, so that asking for the same target twice focuses twice.
 */
export type FocusRequest =
  /** The tree node; the first node or the toolbar when it is gone */
  | { target: 'node'; nodeId: string }
  /** The element that opened the field or dialog; the toolbar when it is gone */
  | { target: 'opener'; opener: HTMLElement };

/**
 * The controller of the Explorer: it owns the store with the state of the panel, reads the files and the open file,
 * and holds what happens beyond the state when the user creates, renames or deletes an entry. The Explorer component
 * renders what this hook returns.
 */
export const useExplorer = () => {
  const { fileId: selectedId } = useParams();
  const navigate = useNavigate();
  const { files, folders, loading, error, reload, deleteFile, deleteFolder } = useFiles();

  const [store] = useState(createExplorerStore);
  const searchText = useStore(store, (state) => state.searchText);
  const expandedFolders = useStore(store, (state) => state.expandedFolders);
  const mode = useStore(store, (state) => state.mode);
  /*
   * React state, not store state: the files are React state as well, and a request has to be rendered together with
   * the files it refers to. The store renders on its own, before a renamed or new node is in the tree.
   */
  const [focusRequest, setFocusRequest] = useState<FocusRequest>();
  /* The actions never change, so they can be read once */
  const actions = store.getState();

  const query = searchText.toLowerCase();
  const tree = useMemo(() => buildTree(files, folders), [files, folders]);
  const filtered = useMemo(() => filterFiles(tree, query), [tree, query]);
  const newEntry = mode.kind === 'creating' ? mode : undefined;
  const nodes = useMemo(
    () =>
      newEntry ? insertNewEntry(filtered, { kind: newEntry.entryKind, folderPath: newEntry.folderPath }) : filtered,
    [filtered, newEntry],
  );

  /*
   * The last focused tree item is forgotten whenever another file opens, also from outside the tree and when coming
   * back to the file it was remembered with: the open file decides the folder of a new entry then.
   */
  useEffect(() => {
    store.getState().setLastFocusedNode(undefined);
  }, [selectedId, store]);

  const openFile = useCallback(
    (fileId: string) => {
      void navigate(`/workspace/file/${fileId}`);
    },
    [navigate],
  );

  /** Starts creating in the last focused tree item's folder, else the open file's, else the root */
  const startCreate = (kind: NewEntryPlacement['kind'], opener: HTMLElement) => {
    const folderPath = targetFolderPath({ lastFocused: store.getState().lastFocusedNodeId, selectedId, tree });
    actions.startCreate({ kind, folderPath }, opener);
  };

  /** Ends creating: the new node, or the button that started it, gets the focus, and a new file with an editor opens */
  const finishCreate = (byKeyboard: boolean, created: CreatedEntry | undefined) => {
    const { mode: current } = store.getState();
    actions.endMode('creating');
    if (byKeyboard && created) {
      setFocusRequest({ target: 'node', nodeId: created.id });
    } else if (byKeyboard && current.kind === 'creating') {
      setFocusRequest({ target: 'opener', opener: current.opener });
    }
    if (created?.kind === 'file' && isOpenable(getFileType(created.path))) openFile(created.id);
  };

  /**
   * Ends renaming; `renamedFolderPath` is the new path of a folder that was renamed. A renamed folder and its
   * subfolders stay expanded: their node ids follow the paths.
   */
  const finishRename = (byKeyboard: boolean, renamedFolderPath?: string) => {
    const { mode: current } = store.getState();
    const renamed = current.kind === 'renaming' ? current.node : undefined;
    if (renamed?.kind === 'folder' && renamedFolderPath !== undefined) {
      actions.folderRenamed(renamed.path, renamedFolderPath);
    }
    actions.endMode('renaming');
    const nodeId = renamedFolderPath === undefined ? renamed?.id : toFolderId(renamedFolderPath);
    if (byKeyboard && nodeId !== undefined) setFocusRequest({ target: 'node', nodeId });
  };

  /**
   * A folder was renamed in the storage. While its rename field is still the open one, `finishRename` moves the
   * expansion state: the store renders at once, and moving it here would unmount the field before it reports that it
   * is done. When another field has replaced it, the field does not report any more, so the state moves now.
   */
  const folderRenamed = (fromPath: string, toPath: string) => {
    const { mode: current } = store.getState();
    if (current.kind === 'renaming' && current.node.kind === 'folder' && current.node.path === fromPath) return;
    actions.folderRenamed(fromPath, toPath);
  };

  const closeCreateDialog = () => {
    const { mode: current } = store.getState();
    actions.endMode('createDialog');
    if (current.kind === 'createDialog') setFocusRequest({ target: 'opener', opener: current.opener });
  };

  const closeDelete = () => {
    const { mode: current } = store.getState();
    actions.endMode('deleting');
    if (current.kind === 'deleting') setFocusRequest({ target: 'node', nodeId: current.node.id });
  };

  /**
   * Asks to delete a node. The confirmation names its full path, so that the user can tell entries of the same name
   * in different folders apart.
   */
  const requestDelete = (node: ExplorerFile) => {
    actions.requestDelete(node, node.path);
  };

  /** Deletes the node from the storage, and leaves the editor when the open file is deleted with it */
  const deleteNode = async (node: ExplorerFile) => {
    const openPath = files.find((file) => file.id === selectedId)?.path;
    let deletesOpenFile;
    if (node.kind === 'folder') {
      await deleteFolder(node.path);
      deletesOpenFile = !!openPath?.startsWith(`${node.path}/`);
    } else {
      await deleteFile(node.id);
      deletesOpenFile = node.id === selectedId;
    }
    if (deletesOpenFile) void navigate('/workspace');
  };

  const renamed = mode.kind === 'renaming' ? mode.node : undefined;

  return {
    store,
    selectedId,
    loading,
    error,
    reload,
    /** Whether there are files or folders at all, before the search */
    isEmpty: tree.length === 0,
    /** The tree to show: filtered by the search, with the node of a new entry */
    nodes,
    searchText,
    query,
    expandedFolders,
    mode,
    focusRequest,
    newEntry,
    /** The file being renamed */
    renaming: renamed?.kind === 'file' ? files.find((file) => file.id === renamed.id) : undefined,
    /** The path of the folder being renamed */
    renamingFolder: renamed?.kind === 'folder' ? renamed.path : undefined,
    setSearchText: actions.setSearchText,
    toggleFolder: actions.toggleFolder,
    setLastFocusedNode: actions.setLastFocusedNode,
    openCreateDialog: actions.openCreateDialog,
    closeCreateDialog,
    startCreate,
    finishCreate,
    startRename: actions.startRename,
    finishRename,
    folderRenamed,
    requestDelete,
    closeDelete,
    deleteNode,
    openFile,
  };
};
