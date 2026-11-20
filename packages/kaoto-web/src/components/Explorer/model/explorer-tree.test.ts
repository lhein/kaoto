import { toFolderId } from './build-tree';
import { ExplorerFile } from './explorer-file';
import { childrenOf, fileNode, folderNode } from './explorer-test-nodes';
import {
  expandWithParents,
  findNode,
  getNodeKey,
  insertNewEntry,
  NEW_ENTRY_ID,
  ROOT_TARGET,
  targetFolderPath,
} from './explorer-tree';

const ids = (nodes: ExplorerFile[]): string[] => nodes.map((node) => node.id);

describe('insertNewEntry', () => {
  const tree = [
    folderNode('routes', [
      folderNode('routes/orders', [fileNode('c', 'routes/orders/c.camel.yaml')]),
      fileNode('b', 'routes/b.camel.yaml'),
    ]),
    folderNode('tests'),
    fileNode('a', 'a.camel.yaml'),
  ];

  it('puts a new folder of the root before the other folders', () => {
    const nodes = insertNewEntry(tree, { kind: 'folder', folderPath: '' });

    expect(ids(nodes)).toEqual([NEW_ENTRY_ID, toFolderId('routes'), toFolderId('tests'), 'a']);
    expect(nodes[0].type).toBe('folder');
  });

  it('puts a new file of the root after the folders and before the other files', () => {
    const nodes = insertNewEntry(tree, { kind: 'file', folderPath: '' });

    expect(ids(nodes)).toEqual([toFolderId('routes'), toFolderId('tests'), NEW_ENTRY_ID, 'a']);
    expect(nodes[2].type).toBe('document');
  });

  it('puts a new file last in a folder that holds no files', () => {
    const nodes = insertNewEntry([folderNode('routes'), folderNode('tests')], { kind: 'file', folderPath: '' });

    expect(ids(nodes)).toEqual([toFolderId('routes'), toFolderId('tests'), NEW_ENTRY_ID]);
  });

  it('puts a new file into its folder', () => {
    const nodes = insertNewEntry(tree, { kind: 'file', folderPath: 'routes' });

    expect(ids(childrenOf(nodes[0]))).toEqual([toFolderId('routes/orders'), NEW_ENTRY_ID, 'b']);
  });

  it('puts a new entry into a folder of a folder', () => {
    const nodes = insertNewEntry(tree, { kind: 'folder', folderPath: 'routes/orders' });

    expect(ids(childrenOf(childrenOf(nodes[0])[0]))).toEqual([NEW_ENTRY_ID, 'c']);
  });

  it('leaves the other folders and the given tree as they are', () => {
    const nodes = insertNewEntry(tree, { kind: 'file', folderPath: 'routes' });

    expect(nodes[1]).toBe(tree[1]);
    expect(nodes[2]).toBe(tree[2]);
    expect(ids(childrenOf(tree[0]))).toEqual([toFolderId('routes/orders'), 'b']);
  });

  it('adds nothing when the folder is not in the tree', () => {
    const nodes = insertNewEntry(tree, { kind: 'file', folderPath: 'gone' });

    expect(nodes).toEqual(tree);
  });
});

describe('expandWithParents', () => {
  it('expands the folder and the folders around it', () => {
    const expanded = expandWithParents({}, 'routes/orders/eu');

    expect(expanded).toEqual({
      [toFolderId('routes')]: true,
      [toFolderId('routes/orders')]: true,
      [toFolderId('routes/orders/eu')]: true,
    });
  });

  it('keeps the state of the other folders and expands a collapsed one', () => {
    const before = { [toFolderId('tests')]: true, [toFolderId('docs')]: false, [toFolderId('routes')]: false };

    const expanded = expandWithParents(before, 'routes');

    expect(expanded).toEqual({
      [toFolderId('tests')]: true,
      [toFolderId('docs')]: false,
      [toFolderId('routes')]: true,
    });
  });

  it('changes nothing for the root', () => {
    const before = { [toFolderId('tests')]: true };

    expect(expandWithParents(before, '')).toEqual(before);
  });
});

describe('findNode', () => {
  const tree = [folderNode('routes', [folderNode('routes/orders', [fileNode('c', 'routes/orders/c.camel.yaml')])])];

  it.each([
    ['a folder', toFolderId('routes/orders'), 'routes/orders'],
    ['a file in a folder of a folder', 'c', 'routes/orders/c.camel.yaml'],
  ])('finds %s', (_, id, path) => {
    expect(findNode(tree, id)?.path).toBe(path);
  });

  it.each([
    ['an unknown id', 'gone'],
    ['no id', undefined],
  ])('finds nothing for %s', (_, id) => {
    expect(findNode(tree, id)).toBeUndefined();
  });
});

describe('targetFolderPath', () => {
  const tree = [
    folderNode('routes', [
      folderNode('routes/orders', [fileNode('c', 'routes/orders/c.camel.yaml')]),
      fileNode('b', 'routes/b.camel.yaml'),
    ]),
    folderNode('tests'),
    fileNode('a', 'a.camel.yaml'),
  ];

  it.each([
    ['the root after a click on the free space', ROOT_TARGET, 'c', ''],
    ['the last focused folder', toFolderId('tests'), 'c', 'tests'],
    ['the folder of the last focused file', 'b', 'c', 'routes'],
    ['the root for a last focused file of the root', 'a', 'c', ''],
    ['the folder of the open file when nothing was focused', undefined, 'c', 'routes/orders'],
    ['the root when nothing was focused and no file is open', undefined, undefined, ''],
    ['the folder of the open file when the last focused folder is gone', toFolderId('deleted'), 'b', 'routes'],
    ['the folder of the open file when the last focused file is gone', 'deleted', 'b', 'routes'],
    ['the root when the open file is not among the files', undefined, 'unknown', ''],
  ])('is %s', (_, lastFocused, selectedId, expected) => {
    expect(targetFolderPath({ lastFocused, selectedId, tree })).toBe(expected);
  });
});

describe('getNodeKey', () => {
  it('is the id of a stored node', () => {
    expect(getNodeKey(fileNode('a', 'a.camel.yaml'), 3)).toBe('a');
  });

  it('changes with every start of a new entry', () => {
    const newEntry = fileNode(NEW_ENTRY_ID, '');

    expect(getNodeKey(newEntry, 1)).not.toBe(getNodeKey(newEntry, 2));
  });
});
