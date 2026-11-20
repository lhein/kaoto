import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { filesStore } from '../../services/files/files.store';
import { TEST_FILES } from '../../test/files';
import { resetTestIndexedDB } from '../../test/indexed-db';
import {
  LocationDisplay,
  renderComponent,
  renderWithNavigation,
  storedPaths,
  storeExplorerTestFiles,
} from './explorer-test-utils';
import { toFolderId } from './model/build-tree';

describe('Explorer: creating inline', () => {
  beforeEach(storeExplorerTestFiles);

  /** Serves the catalog index, the templates manifest and a Camel route template */
  const serveCatalog = (template: Response | undefined = new Response('- route:\n    id: route-__KAOTO_ID__\n')) => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: URL) => {
        const { pathname } = url;
        if (pathname === '/camel-catalog/index.json') {
          return Promise.resolve(new Response(JSON.stringify({ starterTemplates: 'starter-templates/index-1.json' })));
        }
        if (pathname === '/camel-catalog/starter-templates/index-1.json') {
          const catalogs = { 'camel-route-yaml': { file: 'camel-route-yaml-hash.yaml' } };
          return Promise.resolve(new Response(JSON.stringify({ catalogs })));
        }
        if (pathname.endsWith('/camel-route-yaml-hash.yaml') && template) return Promise.resolve(template);
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const nameInput = () => screen.getByTestId('explorer-new-input');

  it('creates an empty file at the root with one click, a name and Enter', async () => {
    const user = userEvent.setup();
    renderWithNavigation(<LocationDisplay />);
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByRole('button', { name: 'New file' }));
    expect(nameInput()).toHaveFocus();
    expect(nameInput()).toHaveValue('');
    expect(nameInput()).not.toHaveAttribute('data-invalid');
    await user.keyboard('notes.txt{Enter}');

    await waitFor(async () => {
      expect(await storedPaths()).toContain('notes.txt');
    });
    const created = (await filesStore.getFiles()).find(({ path }) => path === 'notes.txt')!;
    expect(created.content).toBe('');
    expect(screen.queryByTestId('explorer-new-input')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(`explorer-file-${created.id}`)).toHaveFocus();
    });
    // A document does not open
    expect(screen.getByTestId('location').textContent).toBe('/workspace');
  });

  it('creates a folder that stays after a reload, even while it is empty', async () => {
    const user = userEvent.setup();
    const { unmount } = renderComponent();
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.keyboard('schemas{Enter}');

    await waitFor(async () => {
      expect(await filesStore.getFolders()).toContain('schemas');
    });
    await waitFor(() => {
      expect(screen.getByTestId('explorer-folder-schemas')).toHaveFocus();
    });

    unmount();
    renderComponent();
    expect(await screen.findByTestId('explorer-folder-schemas')).toBeInTheDocument();
  });

  it('creates the entry in the focused folder and expands it', async () => {
    const user = userEvent.setup();
    renderComponent();
    const folder = await screen.findByTestId('explorer-folder-resources');
    folder.focus();

    await user.click(screen.getByRole('button', { name: 'New folder' }));

    expect(folder).toHaveAttribute('aria-expanded', 'true');
    expect(folder).toContainElement(nameInput());
    await user.keyboard('xslt{Enter}');
    await waitFor(async () => {
      expect(await filesStore.getFolders()).toContain('resources/xslt');
    });
  });

  it('creates the entry in the folder of the focused file', async () => {
    const user = userEvent.setup();
    renderComponent();
    const folderNode = await screen.findByTestId('explorer-folder-integrations');
    await user.click(folderNode.querySelector('.cds--tree-parent-node__toggle')!);
    screen.getByTestId('explorer-file-main-flow').focus();

    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.keyboard('readme.md{Enter}');

    await waitFor(async () => {
      expect(await storedPaths()).toContain('integrations/readme.md');
    });
  });

  it('creates the entry in the folder of the open file when no tree item had the focus', async () => {
    const user = userEvent.setup();
    renderWithNavigation(undefined, '/workspace/file/rest-api');
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.keyboard('notes.txt{Enter}');

    await waitFor(async () => {
      expect(await storedPaths()).toContain('integrations/routes/notes.txt');
    });
  });

  it('forgets the focused folder once another file opens, also after coming back to the first one', async () => {
    const OpenFileButtons = () => {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => void navigate('/workspace/file/main-flow')}>Open main-flow</button>
          <button onClick={() => void navigate('/workspace/file/rest-api')}>Open rest-api</button>
        </>
      );
    };
    const user = userEvent.setup();
    renderWithNavigation(<OpenFileButtons />, '/workspace/file/rest-api');
    (await screen.findByTestId('explorer-folder-resources')).focus();
    await user.click(screen.getByRole('button', { name: 'Open main-flow' }));
    await user.click(screen.getByRole('button', { name: 'Open rest-api' }));

    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.keyboard('notes.txt{Enter}');

    await waitFor(async () => {
      expect(await storedPaths()).toContain('integrations/routes/notes.txt');
    });
    expect(await storedPaths()).not.toContain('resources/notes.txt');
  });

  it('starts a known file type from its template and opens it', async () => {
    serveCatalog();
    const user = userEvent.setup();
    renderWithNavigation(<LocationDisplay />);
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.keyboard('orders.camel.yaml{Enter}');

    await waitFor(async () => {
      expect(await storedPaths()).toContain('orders.camel.yaml');
    });
    const created = (await filesStore.getFiles()).find(({ path }) => path === 'orders.camel.yaml')!;
    expect(created.content).toMatch(/^- route:\n {4}id: route-\d+\n$/);
    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(`/workspace/file/${created.id}`);
    });
  });

  it('keeps the field open with the error when the template cannot be loaded', async () => {
    serveCatalog(new Response(null, { status: 500 }));
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.keyboard('orders.camel.yaml{Enter}');

    expect(await screen.findByText(/Could not load/)).toBeInTheDocument();
    expect(nameInput()).toHaveFocus();
    expect(await storedPaths()).not.toContain('orders.camel.yaml');
  });

  it.each([
    ['New file', 'a taken file name', 'integrations', 'A file or folder with that name already exists'],
    ['New folder', 'the name of a file', 'main-flow.camel.yaml', 'A file or folder with that name already exists'],
    ['New file', 'a name with a slash', 'a/b.txt', 'A file name cannot contain / or \\'],
    ['New folder', 'an empty name', '', 'Enter a folder name'],
  ])('%s shows an error for %s and keeps the field open on Enter', async (button, _, typed, error) => {
    const user = userEvent.setup();
    renderComponent();
    const folderNode = await screen.findByTestId('explorer-folder-integrations');
    if (typed === 'main-flow.camel.yaml') folderNode.focus();

    await user.click(screen.getByRole('button', { name: button }));
    if (typed) await user.keyboard(typed);
    await user.keyboard('{Enter}');

    expect(screen.getByText(error)).toBeInTheDocument();
    expect(nameInput()).toHaveFocus();
  });

  it('keeps creating a file when Escape is pressed while its template loads', async () => {
    let sendTemplate: (template: Response) => void = () => undefined;
    serveCatalog(undefined);
    const servedFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((url) =>
      String(url).endsWith('/camel-route-yaml-hash.yaml')
        ? new Promise<Response>((resolve) => {
            sendTemplate = resolve;
          })
        : servedFetch(url),
    );
    const user = userEvent.setup();
    renderWithNavigation(<LocationDisplay />);
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.keyboard('orders.camel.yaml{Enter}');
    await user.keyboard('{Escape}');
    expect(nameInput()).toBeInTheDocument();
    sendTemplate(new Response('- route:\n    id: route-__KAOTO_ID__\n'));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toMatch(/^\/workspace\/file\//);
    });
    expect(await storedPaths()).toContain('orders.camel.yaml');
  });

  it('creates the entry in the folder of a file opened outside the tree after a folder had the focus', async () => {
    const OpenRestApi = () => {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => void navigate('/workspace/file/rest-api')}>
          open rest-api
        </button>
      );
    };
    const user = userEvent.setup();
    renderWithNavigation(<OpenRestApi />);
    (await screen.findByTestId('explorer-folder-resources')).focus();

    await user.click(screen.getByRole('button', { name: 'open rest-api' }));
    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.keyboard('notes.txt{Enter}');

    await waitFor(async () => {
      expect(await storedPaths()).toContain('integrations/routes/notes.txt');
    });
  });

  it('creates a top-level folder after a click on the free space of the tree, also right after creating a folder', async () => {
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-folder-integrations');
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.keyboard('routes{Enter}');
    await waitFor(() => {
      expect(screen.getByTestId('explorer-folder-routes')).toHaveFocus();
    });

    await user.click(screen.getByTestId('explorer-tree'));
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.keyboard('other{Enter}');

    await waitFor(async () => {
      expect(await filesStore.getFolders()).toContain('other');
    });
    expect(await filesStore.getFolders()).not.toContain('routes/other');
  });

  it('creates a top-level file after a click on the free space of the tree while a file in a folder is open', async () => {
    const user = userEvent.setup();
    renderWithNavigation(undefined, '/workspace/file/rest-api');
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByTestId('explorer-tree'));
    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.keyboard('notes.txt{Enter}');

    await waitFor(async () => {
      expect(await storedPaths()).toContain('notes.txt');
    });
  });

  it('creates the entry when the field loses the focus with a name that can be used', async () => {
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.keyboard('schemas');
    await user.click(screen.getByRole('searchbox'));

    expect(await screen.findByTestId('explorer-folder-schemas')).toBeInTheDocument();
    // Leaving the field keeps the focus where the user put it
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('creates the entry at the root once the folder that had the focus was renamed away', async () => {
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-folder-resources');
    // Renaming by leaving the field keeps the old folder as the last focused tree item
    await user.click(screen.getByTestId(`explorer-rename-${toFolderId('resources')}`));
    await user.clear(screen.getByRole('textbox', { name: 'Rename folder' }));
    await user.keyboard('assets');
    await user.click(screen.getByRole('searchbox'));
    await screen.findByTestId('explorer-folder-assets');

    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.keyboard('schemas{Enter}');

    await waitFor(async () => {
      expect(await filesStore.getFolders()).toContain('schemas');
    });
  });

  it('cancels on Escape and gives the focus back to the button', async () => {
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.keyboard('draft{Escape}');

    expect(screen.queryByTestId('explorer-new-input')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New folder' })).toHaveFocus();
    expect(await filesStore.getFolders()).not.toContain('draft');
  });

  it('cancels when the field loses the focus while it is empty', async () => {
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-folder-integrations');

    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.click(screen.getByRole('searchbox'));

    expect(screen.queryByTestId('explorer-new-input')).not.toBeInTheDocument();
    expect(await storedPaths()).toHaveLength(TEST_FILES.length);
  });

  it('clears the search so that the new entry shows', async () => {
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-folder-integrations');
    await user.type(screen.getByRole('searchbox'), 'kafka');

    await user.click(screen.getByRole('button', { name: 'New file' }));

    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(nameInput()).toBeVisible();
  });

  it('creates a folder in an empty workspace', async () => {
    resetTestIndexedDB();
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-empty');

    await user.click(screen.getByRole('button', { name: 'New folder' }));
    await user.keyboard('routes{Enter}');

    expect(await screen.findByTestId('explorer-folder-routes')).toBeInTheDocument();
    expect(screen.queryByTestId('explorer-empty')).not.toBeInTheDocument();
  });

  it('edits the name with Backspace and Delete instead of asking to delete a tree item', async () => {
    const user = userEvent.setup();
    renderComponent();
    (await screen.findByTestId('explorer-folder-resources')).focus();

    await user.click(screen.getByRole('button', { name: 'New file' }));
    await user.keyboard('ab{Backspace}{ArrowLeft}{Delete}');

    expect(nameInput()).toHaveValue('');
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
  });
});
