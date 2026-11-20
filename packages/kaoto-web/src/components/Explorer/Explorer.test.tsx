import { act, fireEvent, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { storeTestFiles } from '../../test/files';
import { resetTestIndexedDB } from '../../test/indexed-db';
import { LocationDisplay, renderComponent, renderWithNavigation, storeExplorerTestFiles } from './explorer-test-utils';

describe('Explorer', () => {
  beforeEach(storeExplorerTestFiles);

  it('shows a loading placeholder until the files are loaded', async () => {
    renderComponent();

    expect(screen.getByTestId('explorer-loading')).toBeInTheDocument();
    expect(await screen.findByTestId('explorer-folder-integrations')).toBeInTheDocument();
    expect(screen.queryByTestId('explorer-loading')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no files', async () => {
    resetTestIndexedDB();

    renderComponent();

    expect(await screen.findByTestId('explorer-empty')).toHaveTextContent('Create your first file…');
    expect(screen.getByRole('button', { name: 'Create your first file…' })).toBeInTheDocument();
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('shows an error when the files cannot be loaded', async () => {
    // Drops the connection that storing the test files opened
    resetTestIndexedDB();
    // @ts-expect-error simulating a browser without IndexedDB
    globalThis.indexedDB = undefined;

    renderComponent();

    expect(await screen.findByText('Could not load the files')).toBeInTheDocument();
    expect(screen.getByText(/browser storage may be blocked/)).toBeInTheDocument();
    expect(screen.queryByTestId('explorer-loading')).not.toBeInTheDocument();
  });

  it('loads the files again on retry', async () => {
    // Drops the connection that storing the test files opened
    resetTestIndexedDB();
    // @ts-expect-error simulating a browser without IndexedDB
    globalThis.indexedDB = undefined;
    const user = userEvent.setup();
    renderComponent();
    await screen.findByText('Could not load the files');

    resetTestIndexedDB();
    await storeTestFiles();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByTestId('explorer-folder-integrations')).toBeInTheDocument();
  });

  it('shows the nested folders of the stored paths', async () => {
    const user = userEvent.setup();
    renderComponent();

    for (const folderId of ['integrations', 'integrations/routes', 'integrations/routes/async']) {
      const folderNode = await screen.findByTestId(`explorer-folder-${folderId}`);
      await user.click(folderNode.querySelector('.cds--tree-parent-node__toggle')!);
    }

    expect(screen.getByTestId('explorer-file-kafka-consumer')).toHaveTextContent('kafka-consumer.camel.yaml');
  });

  it.each(['order-test', 'timer-source', 'orders-pipe', 'legacy-route'])(
    'opens %s (non-camel.yaml canvas resource) on click',
    async (id) => {
      const user = userEvent.setup();
      renderWithNavigation(<LocationDisplay />);

      const folderNode = await screen.findByTestId('explorer-folder-integrations');
      await user.click(folderNode.querySelector('.cds--tree-parent-node__toggle')!);
      await user.click(screen.getByTestId(`explorer-file-${id}`));

      expect(screen.getByTestId('location')).toHaveTextContent(`/workspace/file/${id}`);
    },
  );

  it('renders the sidebar structure', async () => {
    renderComponent();
    expect(screen.getByTestId('explorer')).toBeInTheDocument();
    // There is no routes section above the Explorer: a file can hold dozens of routes
    expect(screen.queryByTestId('route-selector-area')).not.toBeInTheDocument();
    expect(await screen.findByTestId('explorer-folder-integrations')).toBeInTheDocument();
    expect(screen.getByTestId('explorer-folder-resources')).toBeInTheDocument();
  });

  it.each([
    ['the toolbar', 'Create a file'],
    ['the empty state', 'Create your first file…'],
  ])('opens the Create New File modal from %s and closes it on Cancel', async (_label, buttonName) => {
    resetTestIndexedDB();
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-empty');

    await user.click(screen.getByRole('button', { name: buttonName }));
    expect(screen.getByRole('heading', { name: 'Create new file' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('create-file-modal')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: buttonName })).toHaveFocus();
  });

  it('returns the focus to the toolbar button when the Create New File modal is closed with Escape', async () => {
    resetTestIndexedDB();
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-empty');

    screen.getByRole('button', { name: 'Create a file' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Create new file' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('create-file-modal')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a file' })).toHaveFocus();
  });

  it('focuses the toolbar button after a file is created from the empty state', async () => {
    resetTestIndexedDB();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: URL) => {
        const { pathname } = url;
        if (pathname === '/camel-catalog/index.json') {
          return Promise.resolve(new Response(JSON.stringify({ starterTemplates: 'starter-templates/index-1.json' })));
        }
        if (pathname === '/camel-catalog/starter-templates/index-1.json') {
          return Promise.resolve(
            new Response(JSON.stringify({ catalogs: { 'camel-route-yaml': { file: 'camel-route-yaml-hash.yaml' } } })),
          );
        }
        return Promise.resolve(new Response('- route:\n    id: route-1\n'));
      }),
    );
    try {
      const user = userEvent.setup();
      renderWithNavigation();
      await screen.findByTestId('explorer-empty');

      await user.click(screen.getByRole('button', { name: 'Create your first file…' }));
      await user.click(screen.getByRole('radio', { name: /^Camel Route YAML/ }));
      await user.type(screen.getByLabelText('File name'), 'orders');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      expect(await screen.findByRole('treeitem', { name: /orders\.camel\.yaml/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Create your first file…' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create a file' })).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('filters the tree and auto-expands matching folders on search', async () => {
    const user = userEvent.setup();
    renderComponent();
    await screen.findByTestId('explorer-folder-integrations');

    await user.type(screen.getByRole('searchbox'), 'main');

    expect(screen.getByTestId('explorer-file-main-flow')).toBeInTheDocument();
    expect(screen.queryByTestId('explorer-file-error-handler')).not.toBeInTheDocument();
    expect(screen.getByTestId('explorer-folder-integrations')).toHaveAttribute('aria-expanded', 'true');
  });

  it('navigates to the integration route on file click and keeps the folder expanded', async () => {
    const user = userEvent.setup();
    renderWithNavigation(<LocationDisplay />);

    const folderNode = await screen.findByTestId('explorer-folder-integrations');
    await user.click(folderNode.querySelector('.cds--tree-parent-node__toggle')!);
    expect(folderNode).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByText('main-flow.camel.yaml'));
    expect(screen.getByTestId('location')).toHaveTextContent('/workspace/file/main-flow');
    expect(screen.getByTestId('explorer-folder-integrations')).toHaveAttribute('aria-expanded', 'true');
  });

  it('highlights the active integration derived from the URL', async () => {
    const user = userEvent.setup();
    renderWithNavigation();

    const folderNode = await screen.findByTestId('explorer-folder-integrations');
    await user.click(folderNode.querySelector('.cds--tree-parent-node__toggle')!);

    await user.click(screen.getByText('main-flow.camel.yaml'));
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByText('error-handler.camel.yaml'));
    expect(screen.getByTestId('explorer-file-error-handler')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveAttribute('aria-selected', 'false');
  });

  it('syncs selection with the URL on browser back/forward navigation', async () => {
    // NavCapture is rendered inside the shared router so navigate(-1) works in context.
    let navigateFn: ReturnType<typeof useNavigate> = () => {};
    const NavCapture = () => {
      navigateFn = useNavigate();
      return null;
    };
    const user = userEvent.setup();
    renderWithNavigation(<NavCapture />);

    // Expand the Integrations folder and click main-flow
    const folderNode = await screen.findByTestId('explorer-folder-integrations');
    await user.click(folderNode.querySelector('.cds--tree-parent-node__toggle')!);
    await user.click(screen.getByText('main-flow.camel.yaml'));
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveAttribute('aria-selected', 'true');

    // Navigate to error-handler — main-flow should deselect
    await user.click(screen.getByText('error-handler.camel.yaml'));
    expect(screen.getByTestId('explorer-file-error-handler')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveAttribute('aria-selected', 'false');

    // Go back — URL returns to main-flow; Explorer must follow
    act(() => {
      void navigateFn(-1);
    });
    expect(screen.getByTestId('explorer-file-main-flow')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('explorer-file-error-handler')).toHaveAttribute('aria-selected', 'false');
  });

  describe('opening files', () => {
    it('does not navigate when a non-integration file is clicked', async () => {
      const user = userEvent.setup();
      renderWithNavigation(<LocationDisplay />);

      const folderNode = await screen.findByTestId('explorer-folder-resources');
      await user.click(folderNode.querySelector('.cds--tree-parent-node__toggle')!);
      await user.click(screen.getByTestId('explorer-file-schema'));

      expect(screen.getByTestId('location')).toHaveTextContent('/workspace');
      expect(screen.getByTestId('location')).not.toHaveTextContent('/file/');
    });
  });

  describe('resizing', () => {
    const drag = (fromX: number, toX: number) => {
      fireEvent.mouseDown(screen.getByRole('button', { name: 'Resize explorer panel' }), { clientX: fromX });
      fireEvent.mouseMove(document, { clientX: toX });
    };

    it('grows the panel following the mouse', () => {
      renderComponent();

      drag(100, 160);

      expect(screen.getByTestId('explorer')).toHaveStyle({ inlineSize: '300px' });
    });

    it('clamps the panel to the minimum and maximum widths', () => {
      renderComponent();

      drag(100, -1000);
      expect(screen.getByTestId('explorer')).toHaveStyle({ inlineSize: '160px' });

      fireEvent.mouseUp(document);
      drag(100, 1000);
      expect(screen.getByTestId('explorer')).toHaveStyle({ inlineSize: '480px' });
    });
  });
});
