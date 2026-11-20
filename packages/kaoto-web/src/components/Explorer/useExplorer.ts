import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useFiles } from '../../hooks/useFiles';
import { getFileType } from '../../services/files/stored-file';
import { buildTree, toFolderId } from './model/build-tree';
import { ExplorerFile } from './model/explorer-file';
import { createExplorerStore } from './model/explorer-store';
import { findNode, NewEntryPlacement, targetFolderPath } from './model/explorer-tree';
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
 * and holds what happens beyond the state when the user creates, renames or deletes an entry.
 *
 * It does not read the state of the store itself: the components subscribe to the part they show, so a change in the
 * store renders only them. What it returns changes with the files, the open file and a focus request.
 */
export const useExplorer = () => {
  const { fileId: selectedId } = useParams();
  const navigate = useNavigate();
  const { files, folders, loading, error, reload, deleteFile, deleteFolder } = useFiles();

  const [store] = useState(createExplorerStore);
  /*
   * React state, not store state: the files are React state as well, and a request has to be rendered together with
   * the files it refers to. The store renders on its own, before a renamed or new node is in the tree.
   */
  const [focusRequest, setFocusRequest] = useState<FocusRequest>();

  const tree = useMemo(() => buildTree(files, folders), [files, folders]);

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

  /** What a row of the tree does. The functions keep their identity, so that a row only renders for its own state. */
  const rowActions = useMemo(() => {
    const actions = store.getState();
    return {
      toggleFolder: actions.toggleFolder,
      startRename: actions.startRename,
      openFile,

      /**
       * Asks to delete a node. The confirmation names its full path, so that the user can tell entries of the same
       * name in different folders apart.
       */
      requestDelete: (node: ExplorerFile) => {
        actions.requestDelete(node, node.path);
      },

      /** Ends creating: the new node, or the button that started it, gets the focus, and a new file with an editor opens */
      finishCreate: (byKeyboard: boolean, created: CreatedEntry | undefined) => {
        const { mode } = store.getState();
        actions.endMode('creating');
        if (byKeyboard && created) {
          setFocusRequest({ target: 'node', nodeId: created.id });
        } else if (byKeyboard && mode.kind === 'creating') {
          setFocusRequest({ target: 'opener', opener: mode.opener });
        }
        if (created?.kind === 'file' && isOpenable(getFileType(created.path))) openFile(created.id);
      },

      /**
       * Ends renaming; `renamedFolderPath` is the new path of a folder that was renamed. A renamed folder and its
       * subfolders stay expanded: their node ids follow the paths.
       */
      finishRename: (byKeyboard: boolean, renamedFolderPath?: string) => {
        const { mode } = store.getState();
        const renamed = mode.kind === 'renaming' ? mode.node : undefined;
        if (renamed?.kind === 'folder' && renamedFolderPath !== undefined) {
          actions.folderRenamed(renamed.path, renamedFolderPath);
        }
        actions.endMode('renaming');
        const nodeId = renamedFolderPath === undefined ? renamed?.id : toFolderId(renamedFolderPath);
        if (byKeyboard && nodeId !== undefined) setFocusRequest({ target: 'node', nodeId });
      },

      /**
       * A folder was renamed in the storage. While its rename field is still the open one, `finishRename` moves the
       * expansion state: the store renders at once, and moving it here would unmount the field before it reports that
       * it is done. When another field has replaced it, the field does not report any more, so the state moves now.
       */
      folderRenamed: (fromPath: string, toPath: string) => {
        const { mode } = store.getState();
        if (mode.kind === 'renaming' && mode.node.kind === 'folder' && mode.node.path === fromPath) return;
        actions.folderRenamed(fromPath, toPath);
      },
    };
  }, [store, openFile]);

  /** What the parts around the rows do: the toolbar, the search, the tree and the dialogs */
  const actions = useMemo(() => {
    const storeActions = store.getState();
    return {
      setSearchText: storeActions.setSearchText,
      setLastFocusedNode: storeActions.setLastFocusedNode,
      openCreateDialog: storeActions.openCreateDialog,
      reload,

      /** Starts creating in the last focused tree item's folder, else the open file's, else the root */
      startCreate: (kind: NewEntryPlacement['kind'], opener: HTMLElement) => {
        const folderPath = targetFolderPath({ lastFocused: store.getState().lastFocusedNodeId, selectedId, tree });
        storeActions.startCreate({ kind, folderPath }, opener);
      },

      closeCreateDialog: () => {
        const { mode } = store.getState();
        storeActions.endMode('createDialog');
        if (mode.kind === 'createDialog') setFocusRequest({ target: 'opener', opener: mode.opener });
      },

      closeDelete: () => {
        const { mode } = store.getState();
        storeActions.endMode('deleting');
        if (mode.kind === 'deleting') setFocusRequest({ target: 'node', nodeId: mode.node.id });
      },

      /** Deletes the node from the storage, and leaves the editor when the open file is deleted with it */
      deleteNode: async (node: ExplorerFile) => {
        const openPath = findNode(tree, selectedId)?.path;
        let deletesOpenFile;
        if (node.kind === 'folder') {
          await deleteFolder(node.path);
          deletesOpenFile = !!openPath?.startsWith(`${node.path}/`);
        } else {
          await deleteFile(node.id);
          deletesOpenFile = node.id === selectedId;
        }
        if (deletesOpenFile) void navigate('/workspace');
      },
    };
  }, [store, reload, selectedId, tree, deleteFile, deleteFolder, navigate]);

  return useMemo(
    () => ({
      store,
      rowActions,
      actions,
      selectedId,
      loading,
      error,
      /** The whole tree of the stored files and folders, before the search */
      tree,
      focusRequest,
    }),
    [store, rowActions, actions, selectedId, loading, error, tree, focusRequest],
  );
};
