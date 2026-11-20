// Note: once the REST editor is migrated to kaoto-web, this component should be
// reviewed together with the shared canvas/editor layout (tracked on the parent
// issue) — the file-tree navigation and filtering logic may be consolidated.
import './Explorer.scss';

import {
  Add,
  Document,
  DocumentAdd,
  DocumentConfiguration,
  Folder,
  FolderAdd,
  FolderOpen,
  TestTool,
} from '@carbon/icons-react';
import { FeatureFlags, IconButton, Link, Search, SkeletonText, TreeNode, TreeView } from '@carbon/react';
import { ComponentProps, FunctionComponent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from 'react';

import { usePanelResizer } from '../../hooks/usePanelResizer';
import { StoredFile } from '../../services/files/stored-file';
import { CreateFileModal } from '../CreateFileModal/CreateFileModal';
import { DeleteConfirmModal } from '../DeleteConfirmModal/DeleteConfirmModal';
import { ErrorState } from '../ErrorState/ErrorState';
import { toFolderId, toFolderPath } from './build-tree';
import { EntryLabel } from './EntryLabel';
import { ExplorerFile } from './explorer-file';
import { NEW_ENTRY_ID, NewEntryPlacement, ROOT_TARGET } from './model/explorer-tree';
import { CreatedEntry, NewEntryField } from './NewEntryField';
import { RenameField } from './RenameField';
import { RenameFolderField } from './RenameFolderField';
import { isOpenable, useExplorer } from './useExplorer';

const MIN_WIDTH = 160;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 240;

interface RenderOptions {
  query: string;
  selectedId: string | undefined;
  expandedFolders: Record<string, boolean>;
  handleToggle: (folderId: string) => ComponentProps<typeof TreeNode>['onToggle'];
  openIntegration: (fileId: string) => void;
  requestDelete: (node: ExplorerFile) => void;
  /** Starts renaming the file or folder with the tree node id */
  requestRename: (nodeId: string) => void;
  /** The file being renamed */
  renaming: StoredFile | undefined;
  /** The path of the folder being renamed */
  renamingFolder: string | undefined;
  finishRename: (byKeyboard: boolean, renamedNodeId?: string) => void;
  /** Moves the expansion state along with a folder renamed in storage */
  moveExpanded: (fromPath: string, toPath: string) => void;
  /** The file or folder being created */
  newEntry: NewEntry | undefined;
  finishCreate: (byKeyboard: boolean, created: CreatedEntry | undefined) => void;
}

interface NewEntry {
  entryKind: NewEntryPlacement['kind'];
  /** The folder it is created in, empty for the root */
  folderPath: string;
  /** Changes with every start, so that a new start mounts a new field */
  key: number;
}

/** The key labelled "delete" on a Mac keyboard sends Backspace */
const DELETE_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace']);

/** Delete or Backspace on a tree item asks to delete it, F2 renames it */
function handleEntryKeys(node: ExplorerFile, opts: RenderOptions) {
  return (event: ReactKeyboardEvent) => {
    if (DELETE_KEYS.has(event.key)) {
      // The key event bubbles through the folders around the item
      event.stopPropagation();
      opts.requestDelete(node);
    } else if (event.key === 'F2') {
      event.stopPropagation();
      event.preventDefault();
      opts.requestRename(node.id);
    }
  };
}

function renderEntryLabel(node: ExplorerFile, opts: RenderOptions): React.ReactNode {
  if (opts.renaming?.id === node.id) {
    return <RenameField file={opts.renaming} onDone={opts.finishRename} />;
  }
  if (opts.renamingFolder !== undefined && node.children && toFolderPath(node.id) === opts.renamingFolder) {
    return (
      <RenameFolderField
        folderPath={opts.renamingFolder}
        onDone={(byKeyboard, renamedPath) => {
          opts.finishRename(byKeyboard, renamedPath === undefined ? undefined : toFolderId(renamedPath));
        }}
        onRenamed={opts.moveExpanded}
      />
    );
  }
  return (
    <EntryLabel node={node} query={opts.query} requestDelete={opts.requestDelete} requestRename={opts.requestRename} />
  );
}

function getFileIcon(type: ExplorerFile['type']) {
  if (type === 'integration') return DocumentConfiguration;
  if (type === 'integration-test') return TestTool;
  return Document;
}

function renderNodes(nodes: ExplorerFile[], opts: RenderOptions): React.ReactNode[] {
  return nodes.map((node) => {
    if (node.id === NEW_ENTRY_ID && opts.newEntry) {
      return (
        <TreeNode
          key={`${NEW_ENTRY_ID}${opts.newEntry.key}`}
          id={NEW_ENTRY_ID}
          label={
            <NewEntryField
              kind={opts.newEntry.entryKind}
              folderPath={opts.newEntry.folderPath}
              onDone={opts.finishCreate}
            />
          }
          renderIcon={opts.newEntry.entryKind === 'folder' ? Folder : Document}
          data-testid="explorer-new-entry"
        />
      );
    }
    const isExpanded = opts.query ? true : !!opts.expandedFolders[node.id];
    if (node.children) {
      return (
        <TreeNode
          key={node.id}
          id={node.id}
          label={renderEntryLabel(node, opts)}
          renderIcon={isExpanded ? FolderOpen : Folder}
          isExpanded={isExpanded}
          onToggle={opts.handleToggle(node.id)}
          onKeyDown={handleEntryKeys(node, opts)}
          aria-keyshortcuts="F2 Delete Backspace"
          data-testid={`explorer-folder-${toFolderPath(node.id)}`}
        >
          {renderNodes(node.children, opts)}
        </TreeNode>
      );
    }
    return (
      <TreeNode
        key={node.id}
        id={node.id}
        label={renderEntryLabel(node, opts)}
        renderIcon={getFileIcon(node.type)}
        data-testid={`explorer-file-${node.id}`}
        onKeyDown={handleEntryKeys(node, opts)}
        aria-keyshortcuts="F2 Delete Backspace"
        onSelect={() => {
          if (isOpenable(node.type)) opts.openIntegration(node.id);
        }}
      />
    );
  });
}

export const Explorer: FunctionComponent = () => {
  const explorer = useExplorer();
  const { mode, focusRequest, selectedId, loading, error } = explorer;
  const treeRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const { width, handleResizerMouseDown } = usePanelResizer({
    initialWidth: DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  });

  /*
   * A field or dialog that closes unmounts, so the focus goes back by hand: to the tree node, or to the first node or
   * the toolbar when that node is gone; to the element that opened it, or to the toolbar when that one is gone, as the
   * empty-state link is once a file exists.
   */
  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === 'opener') {
      (focusRequest.opener.isConnected ? focusRequest.opener : addButtonRef.current)?.focus();
      return;
    }
    const items = [...(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
    const target = items.find((item) => item.id === focusRequest.nodeId) ?? items[0] ?? addButtonRef.current;
    target?.focus();
  }, [focusRequest]);

  // With enableTreeviewControllable, Carbon calls onToggle(isExpanded) rather than (event, node).
  const handleToggle = (folderId: string) =>
    ((newIsExpanded: boolean) => {
      explorer.toggleFolder(folderId, newIsExpanded);
    }) as ComponentProps<typeof TreeNode>['onToggle'];

  const openCreateDialog = (event: React.MouseEvent<HTMLElement>) => {
    explorer.openCreateDialog(event.currentTarget);
  };

  return (
    <aside
      className="cs--explorer"
      data-testid="explorer"
      aria-label="Project explorer"
      style={{ inlineSize: `${width}px` }}
    >
      {/* Section 1 — Toolbar */}
      <div className="cs--explorer__toolbar">
        <h2 className="cs--explorer__heading">Explorer</h2>
        <div className="cs--explorer__toolbar-actions">
          <IconButton
            label="Create a file"
            kind="ghost"
            size="sm"
            align="bottom-start"
            data-testid="explorer-add"
            ref={addButtonRef}
            onClick={openCreateDialog}
          >
            <Add />
          </IconButton>
          <IconButton
            label="New file"
            kind="ghost"
            size="sm"
            align="bottom"
            data-testid="explorer-new-file"
            onClick={(event: React.MouseEvent<HTMLElement>) => {
              explorer.startCreate('file', event.currentTarget);
            }}
          >
            <DocumentAdd />
          </IconButton>
          <IconButton
            label="New folder"
            kind="ghost"
            size="sm"
            align="bottom"
            data-testid="explorer-new-folder"
            onClick={(event: React.MouseEvent<HTMLElement>) => {
              explorer.startCreate('folder', event.currentTarget);
            }}
          >
            <FolderAdd />
          </IconButton>
        </div>
      </div>

      {/* Section 2 — Search */}
      <div className="cs--explorer__search">
        <Search
          size="sm"
          labelText="Search files"
          placeholder="Search files…"
          value={explorer.searchText}
          onChange={(event) => {
            explorer.setSearchText(event.target.value);
          }}
          data-testid="explorer-search"
        />
      </div>

      {/* Resize handle */}
      <button
        className="cs--explorer__resizer"
        aria-label="Resize explorer panel"
        onMouseDown={handleResizerMouseDown}
      />

      {/* Section 3 — File tree */}
      {/* A click on the free space below the items makes the root the folder of the next new file or folder */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="cs--explorer__tree"
        ref={treeRef}
        data-testid="explorer-tree"
        onMouseDown={(event) => {
          if (!(event.target as HTMLElement).closest('[role="treeitem"]')) {
            explorer.setLastFocusedNode(ROOT_TARGET);
          }
        }}
        onFocus={(event) => {
          const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
          if (item?.id && item.id !== NEW_ENTRY_ID) explorer.setLastFocusedNode(item.id);
        }}
      >
        {loading && (
          <div data-testid="explorer-loading">
            <SkeletonText paragraph lineCount={4} />
          </div>
        )}
        {error && (
          <ErrorState
            title="Could not load the files"
            message={`Kaoto keeps the files in the browser storage, and the browser storage may be blocked, for example in a private window. (${error.message})`}
            onRetry={explorer.reload}
          />
        )}
        {!loading && !error && explorer.isEmpty && !explorer.newEntry && (
          <div className="cs--explorer__empty" data-testid="explorer-empty">
            {/* A link to the eye, but it opens the Create new file modal rather than going anywhere */}
            <Link as="button" type="button" className="cs--explorer__create-first" onClick={openCreateDialog}>
              Create your first file…
            </Link>
          </div>
        )}
        {!loading && !error && (!explorer.isEmpty || explorer.newEntry) && (
          /* enableTreeviewControllable makes `selected` and `active` fully controlled —
             without it, Carbon TreeView only uses `selected` as an initial value and
             won't react to URL changes (e.g. browser back/forward). */
          <FeatureFlags enableTreeviewControllable>
            <TreeView label="Project files" hideLabel selected={selectedId ? [selectedId] : []} active={selectedId}>
              {renderNodes(explorer.nodes, {
                query: explorer.query,
                selectedId,
                expandedFolders: explorer.expandedFolders,
                handleToggle,
                openIntegration: explorer.openFile,
                requestDelete: explorer.requestDelete,
                requestRename: explorer.startRename,
                renaming: explorer.renaming,
                renamingFolder: explorer.renamingFolder,
                finishRename: explorer.finishRename,
                moveExpanded: explorer.folderRenamed,
                newEntry: explorer.newEntry,
                finishCreate: explorer.finishCreate,
              })}
            </TreeView>
          </FeatureFlags>
        )}
      </div>
      {mode.kind === 'createDialog' && <CreateFileModal onClose={explorer.closeCreateDialog} />}
      {mode.kind === 'deleting' && (
        <DeleteConfirmModal
          heading={mode.node.children ? 'Delete folder?' : 'Delete file?'}
          onDelete={() => explorer.deleteNode(mode.node)}
          onClose={explorer.closeDelete}
        >
          {mode.node.children ? (
            <>
              Are you sure you want to delete the folder <strong>{mode.path}</strong> and all its contents?
            </>
          ) : (
            <>
              Are you sure you want to delete <strong>{mode.path}</strong>?
            </>
          )}
        </DeleteConfirmModal>
      )}
    </aside>
  );
};
