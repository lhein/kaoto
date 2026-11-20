import { act, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { withFiles } from '../../test/files';
import { resetTestIndexedDB } from '../../test/indexed-db';
import { createExplorerController, withExplorer } from './explorer-controller.mock';
import { ExplorerController } from './ExplorerContext';
import { ExplorerTree } from './ExplorerTree';
import { ExplorerFile } from './model/explorer-file';
import { fileNode, folderNode } from './model/explorer-test-nodes';
import { ROOT_TARGET } from './model/explorer-tree';

const tree: ExplorerFile[] = [
  folderNode('routes', [fileNode('b', 'routes/orders.camel.yaml')]),
  fileNode('a', 'a.camel.yaml'),
];

const opener = document.createElement('button');

describe('ExplorerTree', () => {
  const treeRef = createRef<HTMLDivElement>();

  /* The name field of a new entry reads the stored files */
  beforeEach(resetTestIndexedDB);

  const renderTree = (overrides: Partial<ExplorerController> = {}) => {
    const controller = createExplorerController({ tree, ...overrides });
    render(withFiles(withExplorer(controller, <ExplorerTree treeRef={treeRef} />)));
    return controller;
  };

  it('shows a placeholder while the files are loading', () => {
    renderTree({ loading: true });

    expect(screen.getByTestId('explorer-loading')).toBeInTheDocument();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('shows why the files could not be loaded and loads them again on Retry', async () => {
    const user = userEvent.setup();
    const { actions } = renderTree({ error: new Error('The storage is blocked') });

    expect(screen.getByText(/The storage is blocked/)).toBeInTheDocument();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(actions.reload).toHaveBeenCalledTimes(1);
  });

  it('offers to create the first file in an empty workspace', async () => {
    const user = userEvent.setup();
    const { actions } = renderTree({ tree: [] });
    const link = screen.getByRole('button', { name: 'Create your first file…' });

    await user.click(link);

    expect(actions.openCreateDialog).toHaveBeenCalledWith(link);
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('shows the tree instead of the empty state while the first entry is being named', () => {
    const { store } = renderTree({ tree: [] });

    act(() => {
      store.getState().startCreate({ kind: 'file', folderPath: '' }, opener);
    });

    expect(screen.queryByTestId('explorer-empty')).not.toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Project files' })).toBeInTheDocument();
    expect(screen.getByTestId('explorer-new-entry')).toBeInTheDocument();
  });

  it('shows the files and folders and marks the open file', () => {
    renderTree({ selectedId: 'a' });

    expect(screen.getByTestId('explorer-folder-routes')).toBeInTheDocument();
    expect(screen.getByTestId('explorer-file-a')).toHaveAttribute('aria-selected', 'true');
    expect(treeRef.current).toBe(screen.getByTestId('explorer-tree'));
  });

  it('shows only what the search finds, in its folders', () => {
    const { store } = renderTree();

    act(() => {
      store.getState().setSearchText('Orders');
    });

    expect(screen.getByTestId('explorer-file-b')).toBeInTheDocument();
    expect(screen.queryByTestId('explorer-file-a')).not.toBeInTheDocument();
  });

  it('puts the name field of a new entry into its folder', () => {
    const { store } = renderTree();

    act(() => {
      store.getState().startCreate({ kind: 'file', folderPath: 'routes' }, opener);
    });

    const folder = screen.getByTestId('explorer-folder-routes');
    expect(folder).toContainElement(screen.getByTestId('explorer-new-entry'));
  });

  it('remembers the tree item that gets the focus', () => {
    const { actions } = renderTree();

    screen.getByTestId('explorer-file-a').focus();

    expect(actions.setLastFocusedNode).toHaveBeenCalledWith('a');
  });

  it('takes a click on the free space of the tree as the root', () => {
    const { actions } = renderTree();

    fireEvent.mouseDown(screen.getByTestId('explorer-tree'));

    expect(actions.setLastFocusedNode).toHaveBeenCalledWith(ROOT_TARGET);
  });

  it('does not take a click on a tree item as the root', () => {
    const { actions } = renderTree();

    fireEvent.mouseDown(screen.getByTestId('explorer-file-a'));

    expect(actions.setLastFocusedNode).not.toHaveBeenCalledWith(ROOT_TARGET);
  });
});
