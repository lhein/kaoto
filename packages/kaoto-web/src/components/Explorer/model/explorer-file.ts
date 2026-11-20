import { FileType } from '../../../services/files/stored-file';

interface ExplorerEntry {
  /** The id of the tree node: the id of a stored file, or `toFolderId` of a folder path */
  id: string;
  name: string;
  /** `/`-separated, e.g. `routes/orders.camel.yaml` for a file and `routes` for a folder */
  path: string;
}

/** A stored file in the Explorer tree */
export interface ExplorerFileNode extends ExplorerEntry {
  kind: 'file';
  type: FileType;
}

/** A folder in the Explorer tree, with the files and folders in it */
export interface ExplorerFolderNode extends ExplorerEntry {
  kind: 'folder';
  type: 'folder';
  children: ExplorerFile[];
}

/** A node of the Explorer tree. Its `kind` tells a file from a folder, so nothing has to derive it from the id. */
export type ExplorerFile = ExplorerFileNode | ExplorerFolderNode;
