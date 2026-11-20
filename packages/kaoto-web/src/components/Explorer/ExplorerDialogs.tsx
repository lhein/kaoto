import { FunctionComponent } from 'react';

import { CreateFileModal } from '../CreateFileModal/CreateFileModal';
import { useExplorerContext, useExplorerState } from './ExplorerContext';
import { ExplorerDeleteDialog } from './ExplorerDeleteDialog';

/** The dialog of the mode the Explorer is in: Create new file, or the delete confirmation */
export const ExplorerDialogs: FunctionComponent = () => {
  const { actions } = useExplorerContext();
  const mode = useExplorerState((state) => state.mode);

  if (mode.kind === 'createDialog') return <CreateFileModal onClose={actions.closeCreateDialog} />;
  if (mode.kind === 'deleting') {
    return (
      <ExplorerDeleteDialog
        path={mode.path}
        isFolder={mode.node.kind === 'folder'}
        onDelete={() => actions.deleteNode(mode.node)}
        onClose={actions.closeDelete}
      />
    );
  }
  return null;
};
