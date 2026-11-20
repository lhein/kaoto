import { Document, DocumentConfiguration, Folder, FolderOpen, TestTool } from '@carbon/icons-react';
import { TreeNode } from '@carbon/react';
import { ComponentProps, FunctionComponent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';

import { EntryLabel } from './EntryLabel';
import { useExplorerContext } from './ExplorerContext';
import { ExplorerFile } from './model/explorer-file';
import { getNodeKey, NEW_ENTRY_ID } from './model/explorer-tree';
import { NewEntryField } from './NewEntryField';
import { RenameField } from './RenameField';
import { RenameFolderField } from './RenameFolderField';
import { isOpenable } from './useExplorer';

type TreeNodeProps = ComponentProps<typeof TreeNode>;

/** The props that the tree around the node passes on to it, like its depth and the selection */
type PassedByTree = Omit<TreeNodeProps, 'id' | 'label' | 'children'>;

interface ExplorerNodeProps extends PassedByTree {
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

/**
 * One row of the Explorer tree: a file, a folder with its rows, or the name field of a new entry.
 *
 * Carbon's tree hands props to its nodes, like the depth and the selection, so they are passed on to the `TreeNode`.
 */
export const ExplorerNode: FunctionComponent<ExplorerNodeProps> = ({ node, ...passedByTree }) => {
  const explorer = useExplorerContext();
  const { newEntry } = explorer;

  if (node.id === NEW_ENTRY_ID && newEntry) {
    return (
      <TreeNode
        {...passedByTree}
        id={NEW_ENTRY_ID}
        label={
          <NewEntryField kind={newEntry.entryKind} folderPath={newEntry.folderPath} onDone={explorer.finishCreate} />
        }
        renderIcon={newEntry.entryKind === 'folder' ? Folder : Document}
        data-testid="explorer-new-entry"
      />
    );
  }

  /** Delete or Backspace on the row asks to delete it, F2 renames it */
  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (DELETE_KEYS.has(event.key)) {
      // The key event bubbles through the folders around the row
      event.stopPropagation();
      explorer.requestDelete(node);
    } else if (event.key === 'F2') {
      event.stopPropagation();
      event.preventDefault();
      explorer.startRename(node);
    }
  };

  let label: ReactNode;
  if (explorer.renaming?.id === node.id) {
    label = <RenameField file={explorer.renaming} onDone={explorer.finishRename} />;
  } else if (explorer.renamingFolder !== undefined && node.kind === 'folder' && node.path === explorer.renamingFolder) {
    label = (
      <RenameFolderField
        folderPath={explorer.renamingFolder}
        onDone={(byKeyboard, renamedPath) => {
          explorer.finishRename(byKeyboard, renamedPath);
        }}
        onRenamed={explorer.folderRenamed}
      />
    );
  } else {
    label = (
      <EntryLabel
        node={node}
        query={explorer.query}
        requestDelete={explorer.requestDelete}
        requestRename={explorer.startRename}
      />
    );
  }

  if (node.kind === 'folder') {
    // A search shows what it found, also in collapsed folders
    const isExpanded = explorer.query ? true : !!explorer.expandedFolders[node.id];
    return (
      <TreeNode
        {...passedByTree}
        id={node.id}
        label={label}
        renderIcon={isExpanded ? FolderOpen : Folder}
        isExpanded={isExpanded}
        // With enableTreeviewControllable, Carbon calls onToggle(isExpanded) rather than (event, node).
        onToggle={
          ((expanded: boolean) => {
            explorer.toggleFolder(node.id, expanded);
          }) as TreeNodeProps['onToggle']
        }
        onKeyDown={handleKeyDown}
        aria-keyshortcuts={KEY_SHORTCUTS}
        data-testid={`explorer-folder-${node.path}`}
      >
        {node.children.map((child) => (
          <ExplorerNode key={getNodeKey(child, newEntry?.key)} node={child} />
        ))}
      </TreeNode>
    );
  }

  return (
    <TreeNode
      {...passedByTree}
      id={node.id}
      label={label}
      renderIcon={getFileIcon(node.type)}
      data-testid={`explorer-file-${node.id}`}
      onKeyDown={handleKeyDown}
      aria-keyshortcuts={KEY_SHORTCUTS}
      onSelect={() => {
        if (isOpenable(node.type)) explorer.openFile(node.id);
      }}
    />
  );
};
