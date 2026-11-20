import { Add, DocumentAdd, FolderAdd } from '@carbon/icons-react';
import { IconButton } from '@carbon/react';
import { FunctionComponent, MouseEvent, RefObject } from 'react';

import { useExplorerContext } from './ExplorerContext';

interface ExplorerToolbarProps {
  /** The Create a file button, which takes the focus when the element that should get it is gone */
  addButtonRef: RefObject<HTMLButtonElement | null>;
}

/** The heading of the Explorer with the buttons to create files and folders */
export const ExplorerToolbar: FunctionComponent<ExplorerToolbarProps> = ({ addButtonRef }) => {
  const explorer = useExplorerContext();

  return (
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
          onClick={(event: MouseEvent<HTMLElement>) => {
            explorer.openCreateDialog(event.currentTarget);
          }}
        >
          <Add />
        </IconButton>
        <IconButton
          label="New file"
          kind="ghost"
          size="sm"
          align="bottom"
          data-testid="explorer-new-file"
          onClick={(event: MouseEvent<HTMLElement>) => {
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
          onClick={(event: MouseEvent<HTMLElement>) => {
            explorer.startCreate('folder', event.currentTarget);
          }}
        >
          <FolderAdd />
        </IconButton>
      </div>
    </div>
  );
};
