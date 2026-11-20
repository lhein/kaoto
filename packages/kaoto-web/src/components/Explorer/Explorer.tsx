// Note: once the REST editor is migrated to kaoto-web, this component should be
// reviewed together with the shared canvas/editor layout (tracked on the parent
// issue) — the file-tree navigation and filtering logic may be consolidated.
import './Explorer.scss';

import { FunctionComponent, useMemo, useRef } from 'react';

import { usePanelResizer } from '../../hooks/usePanelResizer';
import { ExplorerContext, ExplorerRowContext } from './ExplorerContext';
import { ExplorerDialogs } from './ExplorerDialogs';
import { ExplorerSearch } from './ExplorerSearch';
import { ExplorerToolbar } from './ExplorerToolbar';
import { ExplorerTree } from './ExplorerTree';
import { useExplorer } from './useExplorer';
import { useExplorerFocus } from './useExplorerFocus';

const MIN_WIDTH = 160;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 240;

/**
 * The panel with the files and folders of the workspace. It lays out its parts and holds no state of its own:
 * `useExplorer` is the controller, the store and the tree functions in `model/` are the model. The parts subscribe to
 * the state they show, so this component renders for a new width, new files or another open file only.
 */
export const Explorer: FunctionComponent = () => {
  const explorer = useExplorer();
  const { store, rowActions } = explorer;
  const rowContext = useMemo(() => ({ store, rowActions }), [store, rowActions]);
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
      <ExplorerRowContext.Provider value={rowContext}>
        <aside
          className="cs--explorer"
          data-testid="explorer"
          aria-label="Project explorer"
          style={{ inlineSize: `${width}px` }}
        >
          <ExplorerToolbar addButtonRef={addButtonRef} />
          <ExplorerSearch />
          <button
            className="cs--explorer__resizer"
            aria-label="Resize explorer panel"
            onMouseDown={handleResizerMouseDown}
          />
          <ExplorerTree treeRef={treeRef} />
          <ExplorerDialogs />
        </aside>
      </ExplorerRowContext.Provider>
    </ExplorerContext.Provider>
  );
};
