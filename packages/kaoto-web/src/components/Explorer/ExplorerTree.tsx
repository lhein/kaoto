import { FeatureFlags, Link, SkeletonText, TreeView } from '@carbon/react';
import { FunctionComponent, RefObject } from 'react';

import { ErrorState } from '../ErrorState/ErrorState';
import { useExplorerContext } from './ExplorerContext';
import { ExplorerNode } from './ExplorerNode';
import { getNodeKey, NEW_ENTRY_ID, ROOT_TARGET } from './model/explorer-tree';

interface ExplorerTreeProps {
  /** The element around the tree, to find the tree item that gets the focus */
  treeRef: RefObject<HTMLDivElement | null>;
}

/** The files and folders of the Explorer, or what stands in for them: loading, an error, or the empty workspace */
export const ExplorerTree: FunctionComponent<ExplorerTreeProps> = ({ treeRef }) => {
  const explorer = useExplorerContext();
  const { loading, error, isEmpty, newEntry, selectedId } = explorer;
  const isReady = !loading && !error;

  return (
    /* A click on the free space below the items makes the root the folder of the next new file or folder */
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
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
      {isReady && isEmpty && !newEntry && (
        <div className="cs--explorer__empty" data-testid="explorer-empty">
          {/* A link to the eye, but it opens the Create new file modal rather than going anywhere */}
          <Link
            as="button"
            type="button"
            className="cs--explorer__create-first"
            onClick={(event: React.MouseEvent<HTMLElement>) => {
              explorer.openCreateDialog(event.currentTarget);
            }}
          >
            Create your first file…
          </Link>
        </div>
      )}
      {isReady && (!isEmpty || newEntry) && (
        /* enableTreeviewControllable makes `selected` and `active` fully controlled —
           without it, Carbon TreeView only uses `selected` as an initial value and
           won't react to URL changes (e.g. browser back/forward). */
        <FeatureFlags enableTreeviewControllable>
          <TreeView label="Project files" hideLabel selected={selectedId ? [selectedId] : []} active={selectedId}>
            {explorer.nodes.map((node) => (
              <ExplorerNode key={getNodeKey(node, newEntry?.key)} node={node} />
            ))}
          </TreeView>
        </FeatureFlags>
      )}
    </div>
  );
};
