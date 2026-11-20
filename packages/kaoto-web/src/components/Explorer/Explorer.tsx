// Note: once the REST editor is migrated to kaoto-web, this component should be
// reviewed together with the shared canvas/editor layout (tracked on the parent
// issue) — the file-tree navigation and filtering logic may be consolidated.
import './Explorer.scss';

import { Search } from '@carbon/react';
import { FunctionComponent, useRef } from 'react';

import { usePanelResizer } from '../../hooks/usePanelResizer';
import { CreateFileModal } from '../CreateFileModal/CreateFileModal';
import { ExplorerContext } from './ExplorerContext';
import { ExplorerDeleteDialog } from './ExplorerDeleteDialog';
import { ExplorerToolbar } from './ExplorerToolbar';
import { ExplorerTree } from './ExplorerTree';
import { useExplorer } from './useExplorer';
import { useExplorerFocus } from './useExplorerFocus';

const MIN_WIDTH = 160;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 240;

/**
 * The panel with the files and folders of the workspace. It lays out its parts and holds no state of its own:
 * `useExplorer` is the controller, the store and the tree functions in `model/` are the model.
 */
export const Explorer: FunctionComponent = () => {
  const explorer = useExplorer();
  const { mode } = explorer;
  const treeRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const { width, handleResizerMouseDown } = usePanelResizer({
    initialWidth: DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  });
  useExplorerFocus(explorer.focusRequest, treeRef, addButtonRef);

  return (
    <ExplorerContext.Provider value={explorer}>
      <aside
        className="cs--explorer"
        data-testid="explorer"
        aria-label="Project explorer"
        style={{ inlineSize: `${width}px` }}
      >
        <ExplorerToolbar addButtonRef={addButtonRef} />

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

        <button
          className="cs--explorer__resizer"
          aria-label="Resize explorer panel"
          onMouseDown={handleResizerMouseDown}
        />

        <ExplorerTree treeRef={treeRef} />

        {mode.kind === 'createDialog' && <CreateFileModal onClose={explorer.closeCreateDialog} />}
        {mode.kind === 'deleting' && (
          <ExplorerDeleteDialog
            path={mode.path}
            isFolder={mode.node.kind === 'folder'}
            onDelete={() => explorer.deleteNode(mode.node)}
            onClose={explorer.closeDelete}
          />
        )}
      </aside>
    </ExplorerContext.Provider>
  );
};
