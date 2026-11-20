import { toFolderId } from './build-tree';
import { createExplorerStore } from './explorer-store';
import { fileNode } from './explorer-test-nodes';

const opener = document.createElement('button');
const node = fileNode('a', 'routes/a.camel.yaml');

describe('createExplorerStore', () => {
  it('starts idle, without a search and with every folder collapsed', () => {
    const { mode, searchText, expandedFolders, lastFocusedNodeId } = createExplorerStore().getState();

    expect(mode).toEqual({ kind: 'idle' });
    expect(searchText).toBe('');
    expect(expandedFolders).toEqual({});
    expect(lastFocusedNodeId).toBeUndefined();
  });

  it('keeps the state of two Explorers apart', () => {
    const first = createExplorerStore();
    const second = createExplorerStore();

    first.getState().setSearchText('orders');

    expect(second.getState().searchText).toBe('');
  });

  it('expands and collapses a folder and leaves the others as they are', () => {
    const store = createExplorerStore();

    store.getState().toggleFolder(toFolderId('routes'), true);
    store.getState().toggleFolder(toFolderId('tests'), true);
    store.getState().toggleFolder(toFolderId('routes'), false);

    expect(store.getState().expandedFolders).toEqual({ [toFolderId('routes')]: false, [toFolderId('tests')]: true });
  });

  it('remembers and forgets the last focused tree item', () => {
    const store = createExplorerStore();

    store.getState().setLastFocusedNode('a');
    expect(store.getState().lastFocusedNodeId).toBe('a');

    store.getState().setLastFocusedNode(undefined);
    expect(store.getState().lastFocusedNodeId).toBeUndefined();
  });

  describe('creating in the tree', () => {
    it('clears the search and opens the folder with the folders around it', () => {
      const store = createExplorerStore();
      store.getState().setSearchText('orders');

      store.getState().startCreate({ kind: 'file', folderPath: 'routes/orders' }, opener);

      const { mode, searchText, expandedFolders } = store.getState();
      expect(mode).toEqual({ kind: 'creating', entryKind: 'file', folderPath: 'routes/orders', key: 1, opener });
      expect(searchText).toBe('');
      expect(expandedFolders).toEqual({ [toFolderId('routes')]: true, [toFolderId('routes/orders')]: true });
    });

    it('gives every start a new key, so that a new name field is mounted', () => {
      const store = createExplorerStore();

      store.getState().startCreate({ kind: 'file', folderPath: '' }, opener);
      store.getState().endMode('creating');
      store.getState().startCreate({ kind: 'folder', folderPath: '' }, opener);

      expect(store.getState().mode).toMatchObject({ kind: 'creating', entryKind: 'folder', key: 2 });
    });
  });

  describe('modes', () => {
    it('replaces the mode before when another one starts', () => {
      const store = createExplorerStore();
      store.getState().startRename(node);

      store.getState().requestDelete(node, 'routes/a.camel.yaml');

      expect(store.getState().mode).toEqual({ kind: 'deleting', node, path: 'routes/a.camel.yaml' });
    });

    it.each([
      [
        'createDialog',
        (store: ReturnType<typeof createExplorerStore>) => {
          store.getState().openCreateDialog(opener);
        },
      ],
      [
        'renaming',
        (store: ReturnType<typeof createExplorerStore>) => {
          store.getState().startRename(node);
        },
      ],
      [
        'deleting',
        (store: ReturnType<typeof createExplorerStore>) => {
          store.getState().requestDelete(node, 'a');
        },
      ],
    ] as const)('ends the %s mode', (kind, start) => {
      const store = createExplorerStore();
      start(store);
      expect(store.getState().mode.kind).toBe(kind);

      store.getState().endMode(kind);

      expect(store.getState().mode).toEqual({ kind: 'idle' });
    });

    it('leaves the mode alone when a field of another mode reports late', () => {
      const store = createExplorerStore();
      store.getState().startRename(node);
      store.getState().requestDelete(node, 'a');

      store.getState().endMode('renaming');

      expect(store.getState().mode.kind).toBe('deleting');
    });
  });

  it('keeps a renamed folder and its subfolders expanded under their new ids', () => {
    const store = createExplorerStore();
    store.getState().toggleFolder(toFolderId('routes'), true);
    store.getState().toggleFolder(toFolderId('routes/orders'), true);
    store.getState().toggleFolder(toFolderId('tests'), true);

    store.getState().folderRenamed('routes', 'flows');

    expect(store.getState().expandedFolders).toEqual({
      [toFolderId('flows')]: true,
      [toFolderId('flows/orders')]: true,
      [toFolderId('tests')]: true,
    });
  });
});
