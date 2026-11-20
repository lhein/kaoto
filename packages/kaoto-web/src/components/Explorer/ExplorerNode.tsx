import { Document, DocumentConfiguration, Folder, FolderOpen, TestTool } from '@carbon/icons-react';
import { TreeNode } from '@carbon/react';
import { ComponentProps, FunctionComponent, KeyboardEvent as ReactKeyboardEvent, memo, ReactNode } from 'react';

import { useFiles } from '../../hooks/useFiles';
import { EntryLabel } from './EntryLabel';
import { useExplorerRowContext, useExplorerRowState } from './ExplorerContext';
import { ExplorerFile, ExplorerFileNode } from './model/explorer-file';
import { getNodeKey, NEW_ENTRY_ID } from './model/explorer-tree';
import { NewEntryField } from './NewEntryField';
import { RenameField } from './RenameField';
import { RenameFolderField } from './RenameFolderField';
import { isOpenable } from './useExplorer';

type TreeNodeProps = ComponentProps<typeof TreeNode>;

interface ExplorerNodeProps {
  node: ExplorerFile;
}

/** The key labelled "delete" on a Mac keyboard sends Backspace */
const DELETE_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace']);

const KEY_SHORTCUTS = 'F2 Delete Backspace';

function getFileIcon(type: ExplorerFile['type']) {
  if (type === 'integration') return DocumentConfiguration;
  if (type === 'integration-test') return TestTool;
  return Document;
}

/** The rename field of a file, which works on the stored file */
const RenameFileField: FunctionComponent<{ node: ExplorerFileNode; onDone: (byKeyboard: boolean) => void }> = ({
  node,
  onDone,
}) => {
  const file = useFiles().files.find((candidate) => candidate.id === node.id);
  return file ? <RenameField file={file} onDone={onDone} /> : null;
};

/** The name field of a new file or folder, in place of a row */
const NewEntryNode: FunctionComponent = () => {
  const { rowActions } = useExplorerRowContext();
  const entryKind = useExplorerRowState((state) => (state.mode.kind === 'creating' ? state.mode.entryKind : undefined));
  const folderPath = useExplorerRowState((state) => (state.mode.kind === 'creating' ? state.mode.folderPath : ''));
  if (!entryKind) return null;

  return (
    <TreeNode
      id={NEW_ENTRY_ID}
      label={<NewEntryField kind={entryKind} folderPath={folderPath} onDone={rowActions.finishCreate} />}
      renderIcon={entryKind === 'folder' ? Folder : Document}
      data-testid="explorer-new-entry"
    />
  );
};

/**
 * One row of the Explorer tree: a file, or a folder with its rows.
 *
 * A row subscribes to its own part of the state: whether it is expanded and whether it is being renamed. So opening a
 * folder or starting to rename renders that row and not the others.
 */
const ExplorerEntryNode: FunctionComponent<ExplorerNodeProps> = ({ node }) => {
  const { rowActions } = useExplorerRowContext();
  const query = useExplorerRowState((state) => state.searchText.toLowerCase());
  const isExpandedByUser = useExplorerRowState((state) => !!state.expandedFolders[node.id]);
  const isRenaming = useExplorerRowState((state) => state.mode.kind === 'renaming' && state.mode.node.id === node.id);
  const newEntryKey = useExplorerRowState((state) => (state.mode.kind === 'creating' ? state.mode.key : undefined));

  /** Delete or Backspace on the row asks to delete it, F2 renames it */
  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (DELETE_KEYS.has(event.key)) {
      // The key event bubbles through the folders around the row
      event.stopPropagation();
      rowActions.requestDelete(node);
    } else if (event.key === 'F2') {
      event.stopPropagation();
      event.preventDefault();
      rowActions.startRename(node);
    }
  };

  let label: ReactNode;
  if (!isRenaming) {
    label = (
      <EntryLabel
        node={node}
        query={query}
        requestDelete={rowActions.requestDelete}
        requestRename={rowActions.startRename}
      />
    );
  } else if (node.kind === 'folder') {
    label = (
      <RenameFolderField folderPath={node.path} onDone={rowActions.finishRename} onRenamed={rowActions.folderRenamed} />
    );
  } else {
    label = <RenameFileField node={node} onDone={rowActions.finishRename} />;
  }

  if (node.kind === 'folder') {
    // A search shows what it found, also in collapsed folders
    const isExpanded = query ? true : isExpandedByUser;
    return (
      <TreeNode
        id={node.id}
        label={label}
        renderIcon={isExpanded ? FolderOpen : Folder}
        isExpanded={isExpanded}
        // With enableTreeviewControllable, Carbon calls onToggle(isExpanded) rather than (event, node).
        onToggle={
          ((expanded: boolean) => {
            rowActions.toggleFolder(node.id, expanded);
          }) as TreeNodeProps['onToggle']
        }
        onKeyDown={handleKeyDown}
        aria-keyshortcuts={KEY_SHORTCUTS}
        data-testid={`explorer-folder-${node.path}`}
      >
        {node.children.map((child) => (
          <ExplorerNode key={getNodeKey(child, newEntryKey)} node={child} />
        ))}
      </TreeNode>
    );
  }

  return (
    <TreeNode
      id={node.id}
      label={label}
      renderIcon={getFileIcon(node.type)}
      data-testid={`explorer-file-${node.id}`}
      onKeyDown={handleKeyDown}
      aria-keyshortcuts={KEY_SHORTCUTS}
      onSelect={() => {
        if (isOpenable(node.type)) rowActions.openFile(node.id);
      }}
    />
  );
};

/** A row of the Explorer tree. It renders again only for a new node or for its own part of the state. */
export const ExplorerNode: FunctionComponent<ExplorerNodeProps> = memo(({ node }) =>
  node.id === NEW_ENTRY_ID ? <NewEntryNode /> : <ExplorerEntryNode node={node} />,
);
ExplorerNode.displayName = 'ExplorerNode';
