import { FunctionComponent } from 'react';

import { DeleteConfirmModal } from '../DeleteConfirmModal/DeleteConfirmModal';

interface ExplorerDeleteDialogProps {
  /** The full path of the file or folder, so that entries of the same name in different folders can be told apart */
  path: string;
  isFolder: boolean;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

/** Asks before a file, or a folder with all it holds, is deleted */
export const ExplorerDeleteDialog: FunctionComponent<ExplorerDeleteDialogProps> = ({
  path,
  isFolder,
  onDelete,
  onClose,
}) => (
  <DeleteConfirmModal heading={isFolder ? 'Delete folder?' : 'Delete file?'} onDelete={onDelete} onClose={onClose}>
    {isFolder ? (
      <>
        Are you sure you want to delete the folder <strong>{path}</strong> and all its contents?
      </>
    ) : (
      <>
        Are you sure you want to delete <strong>{path}</strong>?
      </>
    )}
  </DeleteConfirmModal>
);
