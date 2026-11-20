import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { filesStore } from '../../services/files/files.store';
import { storeTestFiles, TEST_FILES } from '../../test/files';
import { resetTestIndexedDB } from '../../test/indexed-db';
import {
  LocationDisplay,
  renderComponent,
  renderWithNavigation,
  storedPaths,
  storeExplorerTestFiles,
} from './explorer-test-utils';
import { toFolderId } from './model/build-tree';

describe('Explorer: deleting', () => {
  beforeEach(storeExplorerTestFiles);

  const expandFolder = async (user: ReturnType<typeof userEvent.setup>, folderPath: string) => {
    const folderNode = await screen.findByTestId(`explorer-folder-${folderPath}`);
    await user.click(folderNode.querySelector('.cds--tree-parent-node__toggle')!);
  };

  it('keeps the row buttons out of the names of the tree items and the tab order', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandFolder(user, 'integrations');

    const file = screen.getByRole('treeitem', { name: 'main-flow.camel.yaml' });
    expect(file).toHaveAttribute('aria-keyshortcuts', 'F2 Delete Backspace');
    expect(screen.getByRole('treeitem', { name: /^integrations/ })).toHaveAttribute(
      'aria-keyshortcuts',
      'F2 Delete Backspace',
    );
    const deleteButton = screen.getByTestId('explorer-delete-main-flow');
    const renameButton = screen.getByTestId('explorer-rename-main-flow');
    expect(deleteButton.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(renameButton.parentElement).toBe(deleteButton.parentElement);
    expect(deleteButton).toHaveAttribute('tabindex', '-1');
    expect(renameButton).toHaveAttribute('tabindex', '-1');
    expect(deleteButton).toHaveAttribute('title', 'Delete file');
    expect(renameButton).toHaveAttribute('title', 'Rename file');
    expect(screen.getByTestId(`explorer-delete-${toFolderId('integrations')}`)).toHaveAttribute(
      'title',
      'Delete folder',
    );
    expect(screen.getByTestId(`explorer-rename-${toFolderId('integrations')}`)).toHaveAttribute(
      'title',
      'Rename folder',
    );
  });

  it('deletes a file after confirmation without opening it', async () => {
    const user = userEvent.setup();
    renderWithNavigation(<LocationDisplay />);
    await expandFolder(user, 'integrations');

    await user.click(screen.getByTestId('explorer-delete-main-flow'));

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/workspace$/);
    expect(screen.getByRole('heading', { name: 'Delete file?' })).toBeInTheDocument();
    expect(screen.getByTestId('delete-confirm-modal')).toHaveTextContent(
      'Are you sure you want to delete integrations/main-flow.camel.yaml?',
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByTestId('explorer-file-main-flow')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
    expect(await storedPaths()).not.toContain('integrations/main-flow.camel.yaml');
    expect(await storedPaths()).toHaveLength(TEST_FILES.length - 1);
  });

  it('deletes a folder with its subfolders after confirmation without collapsing it', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandFolder(user, 'integrations');
    const routes = await screen.findByTestId('explorer-folder-integrations/routes');
    await user.click(routes.querySelector('.cds--tree-parent-node__toggle')!);

    await user.click(screen.getByTestId(`explorer-delete-${toFolderId('integrations/routes')}`));

    expect(routes).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Delete folder?' })).toBeInTheDocument();
    expect(screen.getByTestId('delete-confirm-modal')).toHaveTextContent(
      'Are you sure you want to delete the folder integrations/routes and all its contents?',
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByTestId('explorer-folder-integrations/routes')).not.toBeInTheDocument();
    });
    const paths = await storedPaths();
    expect(paths.filter((path) => path.startsWith('integrations/routes/'))).toEqual([]);
    expect(paths).toHaveLength(TEST_FILES.length - 3);
    expect(screen.getByTestId('explorer-file-main-flow')).toBeInTheDocument();
  });

  it('deletes every subfolder and file of a folder and nothing outside it', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandFolder(user, 'integrations');
    await expandFolder(user, 'integrations/routes');
    await expandFolder(user, 'integrations/routes/async');
    const inIntegrations = TEST_FILES.filter((file) => file.path.startsWith('integrations/'));
    const outside = TEST_FILES.filter((file) => !file.path.startsWith('integrations/'));
    // The folder holds files on three levels
    expect(inIntegrations.map((file) => file.path.split('/').length)).toEqual(expect.arrayContaining([2, 3, 4]));

    await user.click(screen.getByTestId(`explorer-delete-${toFolderId('integrations')}`));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByTestId('explorer-folder-integrations')).not.toBeInTheDocument();
    });
    for (const folder of ['integrations/routes', 'integrations/routes/async']) {
      expect(screen.queryByTestId(`explorer-folder-${folder}`)).not.toBeInTheDocument();
    }
    for (const file of inIntegrations) {
      expect(screen.queryByTestId(`explorer-file-${file.id}`)).not.toBeInTheDocument();
    }
    expect(await storedPaths()).toEqual(outside.map((file) => file.path).sort());
    // The stored folders too, or the empty ones would come back on a reload
    const storedFolders = await filesStore.getFolders();
    expect(storedFolders.filter((path) => path === 'integrations' || path.startsWith('integrations/'))).toEqual([]);
    expect(storedFolders).toContain('resources');
    expect(screen.getByTestId('explorer-folder-resources')).toBeInTheDocument();
  });

  it('keeps the file on Cancel and focuses its tree item again', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandFolder(user, 'integrations');

    await user.click(screen.getByTestId('explorer-delete-main-flow'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveFocus();
    expect(await storedPaths()).toHaveLength(TEST_FILES.length);
  });

  it('asks to delete the focused file on Delete, not the folders around it', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandFolder(user, 'integrations');
    screen.getByTestId('explorer-file-main-flow').focus();

    await user.keyboard('{Delete}');

    expect(screen.getByRole('heading', { name: 'Delete file?' })).toBeInTheDocument();
    expect(screen.getByTestId('delete-confirm-modal')).toHaveTextContent('main-flow.camel.yaml');
  });

  // The key labelled "delete" on a Mac keyboard sends Backspace
  it('focuses the first tree item once the focused item is deleted', async () => {
    const user = userEvent.setup();
    renderComponent();
    (await screen.findByTestId('explorer-folder-resources')).focus();

    await user.keyboard('{Delete}');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByTestId('explorer-folder-integrations')).toHaveFocus();
    });
  });

  it('keeps the folder and focuses it once its last file is deleted', async () => {
    resetTestIndexedDB();
    await storeTestFiles([TEST_FILES[0]]);
    const user = userEvent.setup();
    renderComponent();
    await expandFolder(user, 'integrations');

    await user.click(screen.getByTestId('explorer-delete-main-flow'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByTestId('explorer-folder-integrations')).toHaveFocus();
    });
    expect(screen.queryByTestId('explorer-empty')).not.toBeInTheDocument();
  });

  it('shows the empty state and focuses the add button once the last folder is deleted', async () => {
    resetTestIndexedDB();
    await storeTestFiles([TEST_FILES[0]]);
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByTestId(`explorer-delete-${toFolderId('integrations')}`));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByTestId('explorer-add')).toHaveFocus();
    });
    expect(screen.getByTestId('explorer-empty')).toBeInTheDocument();
  });

  it.each([
    ['the open file', '/workspace', 'main-flow'],
    ['the folder of the open file', '/workspace', toFolderId('integrations')],
    ['another file', '/workspace/file/main-flow', 'error-handler'],
    ['another folder', '/workspace/file/main-flow', toFolderId('resources')],
  ])('deleting %s leads to %s', async (_, location, nodeId) => {
    const user = userEvent.setup();
    renderWithNavigation(<LocationDisplay />, '/workspace/file/main-flow');
    await expandFolder(user, 'integrations');

    await user.click(screen.getByTestId(`explorer-delete-${nodeId}`));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // A wrong redirect has happened by the time the node is gone, so waiting for the location cannot pass too early
    await waitFor(() => {
      expect(screen.queryByTestId(`explorer-delete-${nodeId}`)).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(location);
    });
  });

  it('shows the error in the modal and keeps the file when deleting fails', async () => {
    vi.spyOn(filesStore, 'deleteFile').mockRejectedValueOnce(new Error('The storage is blocked'));
    const user = userEvent.setup();
    renderComponent();
    await expandFolder(user, 'integrations');

    await user.click(screen.getByTestId('explorer-delete-main-flow'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('The storage is blocked')).toBeInTheDocument();
    expect(screen.getByTestId('explorer-file-main-flow')).toBeInTheDocument();
    expect(await storedPaths()).toHaveLength(TEST_FILES.length);
  });
});
