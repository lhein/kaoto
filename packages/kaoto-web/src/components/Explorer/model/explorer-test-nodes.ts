import { getFileType } from '../../../services/files/stored-file';
import { toFolderId } from './build-tree';
import { ExplorerFile, ExplorerFileNode, ExplorerFolderNode } from './explorer-file';

/** Tree nodes for the tests, built from a path like `buildTree` builds them */

const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

export const fileNode = (id: string, path: string): ExplorerFileNode => ({
  kind: 'file',
  id,
  name: nameOf(path),
  path,
  type: getFileType(path),
});

export const folderNode = (path: string, children: ExplorerFile[] = []): ExplorerFolderNode => ({
  kind: 'folder',
  id: toFolderId(path),
  name: nameOf(path),
  path,
  type: 'folder',
  children,
});

/** The nodes in a folder; none for a file or a missing node */
export const childrenOf = (node: ExplorerFile | undefined): ExplorerFile[] =>
  node?.kind === 'folder' ? node.children : [];
