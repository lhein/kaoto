import { FeatureFlags, Link, SkeletonText, TreeView } from '@carbon/react';
import { FunctionComponent, memo, RefObject, useMemo } from 'react';

import { ErrorState } from '../ErrorState/ErrorState';
import { useExplorerContext, useExplorerState } from './ExplorerContext';
import { ExplorerNode } from './ExplorerNode';
import { getNodeKey, insertNewEntry, NEW_ENTRY_ID, ROOT_TARGET } from './model/explorer-tree';
import { filterFiles } from './model/filterFiles';

interface ExplorerTreeProps {
  /** The element around the tree, to find the tree item that gets the focus */
  treeRef: RefObject<HTMLDivElement | null>;
}

/** The files and folders of the Explorer, or what stands in for them: loading, an error, or the empty workspace */
export const ExplorerTree: FunctionComponent<ExplorerTreeProps> = memo(({ treeRef }) => {
  const { tree, loading, error, selectedId, actions } = useExplorerContext();
  const query = useExplorerState((state) => state.searchText.toLowerCase());
  const newEntryKind = useExplorerState((state) => (state.mode.kind === 'creating' ? state.mode.entryKind : undefined));
  const newEntryFolder = useExplorerState((state) => (state.mode.kind === 'creating' ? state.mode.folderPath : ''));
  const newEntryKey = useExplorerState((state) => (state.mode.kind === 'creating' ? state.mode.key : undefined));

  /** The tree to show: filtered by the search, with the node of a new entry */
  const nodes = useMemo(() => {
    const filtered = filterFiles(tree, query);
    return newEntryKind ? insertNewEntry(filtered, { kind: newEntryKind, folderPath: newEntryFolder }) : filtered;
  }, [tree, query, newEntryKind, newEntryFolder]);

  const isReady = !loading && !error;
  const isEmpty = tree.length === 0;

  return (
    /* A click on the free space below the items makes the root the folder of the next new file or folder */
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="cs--explorer__tree"
      ref={treeRef}
      data-testid="explorer-tree"
      onMouseDown={(event) => {
        if (!(event.target as HTMLElement).closest('[role="treeitem"]')) {
          actions.setLastFocusedNode(ROOT_TARGET);
        }
      }}
      onFocus={(event) => {
        const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
        if (item?.id && item.id !== NEW_ENTRY_ID) actions.setLastFocusedNode(item.id);
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
          onRetry={actions.reload}
        />
      )}
      {isReady && isEmpty && !newEntryKind && (
        <div className="cs--explorer__empty" data-testid="explorer-empty">
          {/* A link to the eye, but it opens the Create new file modal rather than going anywhere */}
          <Link
            as="button"
            type="button"
            className="cs--explorer__create-first"
            onClick={(event: React.MouseEvent<HTMLElement>) => {
              actions.openCreateDialog(event.currentTarget);
            }}
          >
            Create your first file…
          </Link>
        </div>
      )}
      {isReady && (!isEmpty || newEntryKind) && (
        /* enableTreeviewControllable makes `selected` and `active` fully controlled —
           without it, Carbon TreeView only uses `selected` as an initial value and
           won't react to URL changes (e.g. browser back/forward). */
        <FeatureFlags enableTreeviewControllable>
          <TreeView label="Project files" hideLabel selected={selectedId ? [selectedId] : []} active={selectedId}>
            {nodes.map((node) => (
              <ExplorerNode key={getNodeKey(node, newEntryKey)} node={node} />
            ))}
          </TreeView>
        </FeatureFlags>
      )}
    </div>
  );
});
ExplorerTree.displayName = 'ExplorerTree';
