import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { filesStore } from '../../services/files/files.store';
import { TEST_FILES } from '../../test/files';
import { toFolderId } from './build-tree';
import {
  LocationDisplay,
  renderComponent,
  renderWithNavigation,
  storedFile,
  storeExplorerTestFiles,
} from './explorer-test-utils';

describe('Explorer: renaming', () => {
  beforeEach(storeExplorerTestFiles);

  const expandIntegrations = async (user: ReturnType<typeof userEvent.setup>) => {
    const folderNode = await screen.findByTestId('explorer-folder-integrations');
    await user.click(folderNode.querySelector('.cds--tree-parent-node__toggle')!);
  };

  const startRenaming = async (user: ReturnType<typeof userEvent.setup>, id = 'main-flow') => {
    await user.click(screen.getByTestId(`explorer-rename-${id}`));
    return screen.getByRole('textbox', { name: 'Rename file' });
  };

  it('replaces the name with a focused field that selects the name before the extension', async () => {
    const user = userEvent.setup();
    renderWithNavigation(<LocationDisplay />);
    await expandIntegrations(user);

    const input = await startRenaming(user);

    expect(input).toHaveValue('main-flow.camel.yaml');
    expect(input).toHaveFocus();
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe('main-flow'.length);
    expect(screen.getByTestId('location').textContent).toBe('/workspace');
    expect(screen.queryByTestId('explorer-delete-main-flow')).not.toBeInTheDocument();
  });

  it('edits the name with Backspace and Delete instead of asking to delete the file', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    const input = await startRenaming(user);
    await user.keyboard('{Backspace}{Delete}');

    expect(input).toHaveValue('camel.yaml');
    expect(input).toHaveFocus();
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
  });

  it('starts renaming the focused file or folder on F2', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    screen.getByTestId('explorer-file-main-flow').focus();
    await user.keyboard('{F2}');
    expect(screen.getByRole('textbox', { name: 'Rename file' })).toHaveValue('main-flow.camel.yaml');
    await user.keyboard('{Escape}');

    screen.getByTestId('explorer-folder-resources').focus();
    await user.keyboard('{F2}');
    expect(screen.getByRole('textbox', { name: 'Rename folder' })).toHaveValue('resources');
  });

  describe('folders', () => {
    const renameFolder = async (user: ReturnType<typeof userEvent.setup>, folderPath: string, name: string) => {
      await user.click(screen.getByTestId(`explorer-rename-${toFolderId(folderPath)}`));
      const input = screen.getByRole('textbox', { name: 'Rename folder' });
      await user.clear(input);
      await user.keyboard(`${name}{Enter}`);
    };

    it('renames a folder with the button, moves what it holds and focuses it again', async () => {
      const user = userEvent.setup();
      renderComponent();
      await screen.findByTestId('explorer-folder-resources');

      await user.click(screen.getByTestId(`explorer-rename-${toFolderId('resources')}`));
      const input = screen.getByRole('textbox', { name: 'Rename folder' });
      expect(input).toHaveValue('resources');
      expect(input).toHaveFocus();
      await user.clear(input);
      await user.keyboard('assets{Enter}');

      await waitFor(async () => {
        expect((await storedFile('schema'))?.path).toBe('assets/schema.xsd');
      });
      expect((await storedFile('order-template'))?.path).toBe('assets/templates/order-template.json');
      await waitFor(() => {
        expect(screen.getByTestId('explorer-folder-assets')).toHaveFocus();
      });
      expect(screen.queryByTestId('explorer-folder-resources')).not.toBeInTheDocument();
    });

    it('keeps the open file open and a renamed folder expanded', async () => {
      const user = userEvent.setup();
      renderWithNavigation(<LocationDisplay />, '/workspace/file/rest-api');
      await expandIntegrations(user);
      const routes = screen.getByTestId('explorer-folder-integrations/routes');
      await user.click(routes.querySelector('.cds--tree-parent-node__toggle')!);

      await renameFolder(user, 'integrations/routes', 'api');

      await waitFor(() => {
        expect(screen.getByTestId('explorer-folder-integrations/api')).toHaveAttribute('aria-expanded', 'true');
      });
      expect(screen.getByTestId('location').textContent).toBe('/workspace/file/rest-api');
      expect(screen.getByTestId('explorer-file-rest-api')).toHaveAttribute('aria-selected', 'true');
    });

    it('shows an error for a name that is taken and keeps the field open on Enter', async () => {
      const user = userEvent.setup();
      renderComponent();
      await screen.findByTestId('explorer-folder-resources');

      await renameFolder(user, 'resources', 'integrations');

      expect(screen.getByText('A file or folder with that name already exists')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Rename folder' })).toHaveFocus();
      expect((await storedFile('schema'))?.path).toBe('resources/schema.xsd');
    });

    it('cancels on Escape and focuses the folder again', async () => {
      const user = userEvent.setup();
      renderComponent();
      await screen.findByTestId('explorer-folder-resources');

      await user.click(screen.getByTestId(`explorer-rename-${toFolderId('resources')}`));
      await user.keyboard('x{Escape}');

      expect(screen.queryByRole('textbox', { name: 'Rename folder' })).not.toBeInTheDocument();
      expect(screen.getByTestId('explorer-folder-resources')).toHaveFocus();
    });
  });

  it('renames the file in its folder on Enter and focuses its tree item again', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    const input = await startRenaming(user);
    await user.keyboard('orders flow{Enter}');

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Rename file' })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveTextContent('orders flow.camel.yaml');
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveFocus();
    expect(await storedFile('main-flow')).toMatchObject({
      path: 'integrations/orders flow.camel.yaml',
      content: TEST_FILES[0].content,
    });
    expect(input).not.toBeInTheDocument();
  });

  it('keeps the renamed file open', async () => {
    const user = userEvent.setup();
    renderWithNavigation(<LocationDisplay />, '/workspace/file/main-flow');
    await expandIntegrations(user);

    await startRenaming(user);
    await user.keyboard('orders{Enter}');

    await waitFor(async () => {
      expect((await storedFile('main-flow'))?.path).toBe('integrations/orders.camel.yaml');
    });
    expect(screen.getByTestId('location').textContent).toBe('/workspace/file/main-flow');
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveAttribute('aria-selected', 'true');
  });

  it('cancels on Escape and focuses the tree item again', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    await startRenaming(user);
    await user.keyboard('orders{Escape}');

    expect(screen.queryByRole('textbox', { name: 'Rename file' })).not.toBeInTheDocument();
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveTextContent('main-flow.camel.yaml');
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveFocus();
    expect((await storedFile('main-flow'))?.path).toBe(TEST_FILES[0].path);
  });

  it('renames when the field loses the focus and leaves the focus where it went', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    await startRenaming(user);
    await user.keyboard('orders');
    await user.click(screen.getByRole('searchbox'));

    await waitFor(async () => {
      expect((await storedFile('main-flow'))?.path).toBe('integrations/orders.camel.yaml');
    });
    // The field closes once the store resolves, shortly after the path is stored
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Rename file' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it.each([
    ['a taken name', 'error-handler', 'A file or folder with that name already exists'],
    ['the name of a folder', '{Clear}routes', 'A file or folder with that name already exists'],
    ['the name of an empty folder', '{Clear}empty', 'A file or folder with that name already exists'],
    ['an empty name', '{Backspace}', 'Enter a file name'],
    ['a name with a slash', 'routes/orders', 'A file name cannot contain / or \\'],
  ])('shows an error for %s and keeps the field open on Enter', async (_, typed, error) => {
    await filesStore.createFolder('integrations/empty');
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    const input = await startRenaming(user);
    if (typed === '{Backspace}') await user.clear(input);
    else if (typed.startsWith('{Clear}')) {
      await user.clear(input);
      await user.keyboard(typed.slice('{Clear}'.length));
    } else await user.keyboard(typed);
    await user.keyboard('{Enter}');

    expect(screen.getByText(error)).toBeInTheDocument();
    expect(input).toHaveAttribute('data-invalid', 'true');
    expect(input).toHaveFocus();
    expect((await storedFile('main-flow'))?.path).toBe(TEST_FILES[0].path);
  });

  it('cancels when the field loses the focus with a name that cannot be used', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    await startRenaming(user);
    await user.keyboard('error-handler');
    await user.click(screen.getByRole('searchbox'));

    expect(screen.queryByRole('textbox', { name: 'Rename file' })).not.toBeInTheDocument();
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveTextContent('main-flow.camel.yaml');
    expect((await storedFile('main-flow'))?.path).toBe(TEST_FILES[0].path);
  });

  it('closes without writing when the name is unchanged', async () => {
    const rename = vi.spyOn(filesStore, 'renameFile');
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    await startRenaming(user);
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('textbox', { name: 'Rename file' })).not.toBeInTheDocument();
    expect(rename).not.toHaveBeenCalled();
  });

  it('shows the error and keeps the field open when the store fails', async () => {
    vi.spyOn(filesStore, 'renameFile').mockRejectedValueOnce(new Error('The storage is blocked'));
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    const input = await startRenaming(user);
    await user.keyboard('orders{Enter}');

    expect(await screen.findByText('The storage is blocked')).toBeInTheDocument();
    expect(input).toBeInTheDocument();

    await user.keyboard('-flow');
    expect(screen.queryByText('The storage is blocked')).not.toBeInTheDocument();
  });

  it('keeps the field of another file open when the previous rename finishes after it opened', async () => {
    let finishStoring!: () => void;
    const storing = new Promise<void>((resolve) => {
      finishStoring = resolve;
    });
    const renameFile = filesStore.renameFile.bind(filesStore);
    vi.spyOn(filesStore, 'renameFile').mockImplementationOnce(async (...args) => {
      await storing;
      return renameFile(...args);
    });
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    await startRenaming(user);
    await user.keyboard('orders');
    // Clicking the rename button of another file moves the focus away first, which renames the first file
    const other = await startRenaming(user, 'error-handler');
    expect(other).toHaveValue('error-handler.camel.yaml');

    await act(async () => {
      finishStoring();
      await storing;
    });

    await waitFor(async () => {
      expect((await storedFile('main-flow'))?.path).toBe('integrations/orders.camel.yaml');
    });
    expect(screen.getByRole('textbox', { name: 'Rename file' })).toBe(other);
    expect(other).toHaveFocus();
  });

  it('does not rename on Enter or cancel on Escape while an IME composition is active', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandIntegrations(user);

    const input = await startRenaming(user);
    await user.keyboard('ちゅうもん');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true });

    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect((await storedFile('main-flow'))?.path).toBe(TEST_FILES[0].path);

    await user.keyboard('{Enter}');
    await waitFor(async () => {
      expect((await storedFile('main-flow'))?.path).toBe('integrations/ちゅうもん.camel.yaml');
    });
  });

  it('keeps the keys and clicks in the field away from the tree', async () => {
    const user = userEvent.setup();
    renderWithNavigation(<LocationDisplay />);
    await expandIntegrations(user);

    const input = await startRenaming(user);
    await user.click(input);
    await user.keyboard('{Home}{ArrowRight}{ArrowLeft} x {Delete}');

    expect(input).toHaveValue(' x ain-flow.camel.yaml');
    expect(input).toHaveFocus();
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/workspace');
    expect(screen.getByTestId('explorer-folder-integrations')).toHaveAttribute('aria-expanded', 'true');
  });
});
