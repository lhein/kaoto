import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { toFolderId } from './build-tree';
import { createExplorerController, withExplorer } from './explorer-controller.mock';
import { ExplorerFile } from './explorer-file';
import { ExplorerController } from './ExplorerContext';
import { ExplorerTree } from './ExplorerTree';
import { ROOT_TARGET } from './model/explorer-tree';

const nodes: ExplorerFile[] = [
  { id: toFolderId('routes'), name: 'routes', type: 'folder', children: [] },
  { id: 'a', name: 'a.camel.yaml', type: 'integration' },
];

describe('ExplorerTree', () => {
  const treeRef = createRef<HTMLDivElement>();

  const renderTree = (overrides: Partial<ExplorerController> = {}) => {
    const controller = createExplorerController({ nodes, ...overrides });
    render(withExplorer(controller, <ExplorerTree treeRef={treeRef} />));
    return controller;
  };

  it('shows a placeholder while the files are loading', () => {
    renderTree({ loading: true });

    expect(screen.getByTestId('explorer-loading')).toBeInTheDocument();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('shows why the files could not be loaded and loads them again on Retry', async () => {
    const user = userEvent.setup();
    const controller = renderTree({ error: new Error('The storage is blocked') });

    expect(screen.getByText(/The storage is blocked/)).toBeInTheDocument();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(controller.reload).toHaveBeenCalledTimes(1);
  });

  it('offers to create the first file in an empty workspace', async () => {
    const user = userEvent.setup();
    const controller = renderTree({ isEmpty: true, nodes: [] });
    const link = screen.getByRole('button', { name: 'Create your first file…' });

    await user.click(link);

    expect(controller.openCreateDialog).toHaveBeenCalledWith(link);
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('shows the tree instead of the empty state while the first entry is being named', () => {
    const newEntry = {
      kind: 'creating',
      entryKind: 'file',
      folderPath: '',
      key: 1,
      opener: document.createElement('button'),
    } as const;
    renderTree({ isEmpty: true, nodes: [], newEntry });

    expect(screen.queryByTestId('explorer-empty')).not.toBeInTheDocument();
    expect(screen.getByRole('tree', { name: 'Project files' })).toBeInTheDocument();
  });

  it('shows the files and folders and marks the open file', () => {
    renderTree({ selectedId: 'a' });

    expect(screen.getByTestId('explorer-folder-routes')).toBeInTheDocument();
    expect(screen.getByTestId('explorer-file-a')).toHaveAttribute('aria-selected', 'true');
    expect(treeRef.current).toBe(screen.getByTestId('explorer-tree'));
  });

  it('remembers the tree item that gets the focus', () => {
    const controller = renderTree();

    screen.getByTestId('explorer-file-a').focus();

    expect(controller.setLastFocusedNode).toHaveBeenCalledWith('a');
  });

  it('takes a click on the free space of the tree as the root', () => {
    const controller = renderTree();

    fireEvent.mouseDown(screen.getByTestId('explorer-tree'));

    expect(controller.setLastFocusedNode).toHaveBeenCalledWith(ROOT_TARGET);
  });

  it('does not take a click on a tree item as the root', () => {
    const controller = renderTree();

    fireEvent.mouseDown(screen.getByTestId('explorer-file-a'));

    expect(controller.setLastFocusedNode).not.toHaveBeenCalledWith(ROOT_TARGET);
  });
});
