import { FeatureFlags, TreeView } from '@carbon/react';
import { act, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { storeTestFiles, withFiles } from '../../test/files';
import { resetTestIndexedDB } from '../../test/indexed-db';
import { createExplorerController, withExplorer } from './explorer-controller.mock';
import { ExplorerNode } from './ExplorerNode';
import { ExplorerFile } from './model/explorer-file';
import { ExplorerStore } from './model/explorer-store';
import { fileNode, folderNode } from './model/explorer-test-nodes';
import { NEW_ENTRY_ID } from './model/explorer-tree';

const routeFile = fileNode('main-flow', 'integrations/main-flow.camel.yaml');
const schemaFile = fileNode('schema', 'integrations/schema.xsd');
const ordersFolder = folderNode('integrations/orders', [routeFile]);
const integrationsFolder = folderNode('integrations', [ordersFolder, schemaFile]);

const opener = document.createElement('button');

const expandAll = (store: ExplorerStore) => {
  store.getState().toggleFolder(integrationsFolder.id, true);
  store.getState().toggleFolder(ordersFolder.id, true);
};

describe('ExplorerNode', () => {
  beforeEach(async () => {
    resetTestIndexedDB();
    await storeTestFiles();
  });

  /**
   * Renders the node in a tree, like the Explorer does; the name fields read the stored files.
   *
   * @param prepare puts the store into the state under test before the node renders
   */
  const renderNode = (node: ExplorerFile, prepare: (store: ExplorerStore) => void = () => {}) => {
    const controller = createExplorerController();
    prepare(controller.store);
    render(
      withFiles(
        withExplorer(
          controller,
          <FeatureFlags enableTreeviewControllable>
            <TreeView label="Project files" hideLabel>
              <ExplorerNode node={node} />
            </TreeView>
          </FeatureFlags>,
        ),
      ),
    );
    return controller;
  };

  describe('a file', () => {
    it('shows its name', () => {
      renderNode(routeFile);

      expect(screen.getByRole('treeitem', { name: /main-flow\.camel\.yaml/ })).toBeInTheDocument();
    });

    it('opens a file that has an editor when it is selected', async () => {
      const user = userEvent.setup();
      const { rowActions } = renderNode(routeFile);

      await user.click(screen.getByText('main-flow.camel.yaml'));

      expect(rowActions.openFile).toHaveBeenCalledWith('main-flow');
    });

    it('does not open a file without an editor', async () => {
      const user = userEvent.setup();
      const { rowActions } = renderNode(schemaFile);

      await user.click(screen.getByText('schema.xsd'));

      expect(rowActions.openFile).not.toHaveBeenCalled();
    });

    it('highlights what the search found in its name, ignoring case', () => {
      renderNode(routeFile, (store) => {
        store.getState().setSearchText('FLOW');
      });

      expect(screen.getByText('flow', { selector: 'mark' })).toBeInTheDocument();
    });
  });

  describe('keys', () => {
    // The key labelled "delete" on a Mac keyboard sends Backspace
    it.each(['{Delete}', '{Backspace}'])('asks to delete the focused row on %s', async (key) => {
      const user = userEvent.setup();
      const { rowActions } = renderNode(routeFile);
      screen.getByTestId('explorer-file-main-flow').focus();

      await user.keyboard(key);

      expect(rowActions.requestDelete).toHaveBeenCalledWith(routeFile);
    });

    it('starts renaming the focused row on F2', async () => {
      const user = userEvent.setup();
      const { rowActions } = renderNode(routeFile);
      screen.getByTestId('explorer-file-main-flow').focus();

      await user.keyboard('{F2}');

      expect(rowActions.startRename).toHaveBeenCalledWith(routeFile);
    });

    it('ignores other keys', async () => {
      const user = userEvent.setup();
      const { rowActions } = renderNode(routeFile);
      screen.getByTestId('explorer-file-main-flow').focus();

      await user.keyboard('x');

      expect(rowActions.requestDelete).not.toHaveBeenCalled();
      expect(rowActions.startRename).not.toHaveBeenCalled();
    });

    it('asks to delete only the focused row, not the folders around it', async () => {
      const user = userEvent.setup();
      const { rowActions } = renderNode(integrationsFolder, expandAll);
      screen.getByTestId('explorer-file-main-flow').focus();

      await user.keyboard('{Delete}');

      expect(rowActions.requestDelete).toHaveBeenCalledTimes(1);
      expect(rowActions.requestDelete).toHaveBeenCalledWith(routeFile);
    });

    it('asks to delete a focused folder', async () => {
      const user = userEvent.setup();
      const { rowActions } = renderNode(integrationsFolder);
      screen.getByTestId('explorer-folder-integrations').focus();

      await user.keyboard('{Delete}');

      expect(rowActions.requestDelete).toHaveBeenCalledWith(integrationsFolder);
    });
  });

  describe('a folder', () => {
    it('is collapsed until it is expanded', () => {
      renderNode(integrationsFolder);

      expect(screen.getByTestId('explorer-folder-integrations')).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows its rows, also the folders in it, when it is expanded', () => {
      renderNode(integrationsFolder, expandAll);

      const folder = screen.getByTestId('explorer-folder-integrations');
      expect(folder).toHaveAttribute('aria-expanded', 'true');
      expect(within(folder).getByTestId('explorer-folder-integrations/orders')).toBeInTheDocument();
      expect(within(folder).getByTestId('explorer-file-main-flow')).toBeInTheDocument();
      expect(within(folder).getByTestId('explorer-file-schema')).toBeInTheDocument();
    });

    it('opens when the store says so, without the tree rendering it again', () => {
      const { store } = renderNode(integrationsFolder);

      act(() => {
        store.getState().toggleFolder(integrationsFolder.id, true);
      });

      expect(screen.getByTestId('explorer-folder-integrations')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('explorer-folder-integrations/orders')).toHaveAttribute('aria-expanded', 'false');
    });

    it('is expanded while there is a search, so that what was found shows', () => {
      renderNode(integrationsFolder, (store) => {
        store.getState().setSearchText('flow');
      });

      expect(screen.getByTestId('explorer-folder-integrations')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('explorer-folder-integrations/orders')).toHaveAttribute('aria-expanded', 'true');
    });

    it('reports that it was expanded', async () => {
      const user = userEvent.setup();
      const { rowActions } = renderNode(integrationsFolder);
      const toggle = screen
        .getByTestId('explorer-folder-integrations')
        .querySelector('.cds--tree-parent-node__toggle')!;

      await user.click(toggle);

      expect(rowActions.toggleFolder).toHaveBeenCalledWith(integrationsFolder.id, true);
    });
  });

  describe('name fields', () => {
    it('shows the rename field in place of the name of the file that is renamed', async () => {
      renderNode(routeFile, (store) => {
        store.getState().startRename(routeFile);
      });

      expect(await screen.findByRole('textbox', { name: 'Rename file' })).toHaveValue('main-flow.camel.yaml');
    });

    it('shows the rename field in place of the name of the folder that is renamed', () => {
      renderNode(integrationsFolder, (store) => {
        store.getState().startRename(integrationsFolder);
      });

      expect(screen.getByRole('textbox', { name: 'Rename folder' })).toHaveValue('integrations');
    });

    it('leaves the other rows as they are while a folder is renamed', () => {
      renderNode(integrationsFolder, (store) => {
        expandAll(store);
        store.getState().startRename(ordersFolder);
      });

      expect(screen.getByRole('textbox', { name: 'Rename folder' })).toHaveValue('orders');
      expect(screen.getByText('integrations')).toBeInTheDocument();
    });

    it.each([
      ['file', 'New file name'],
      ['folder', 'New folder name'],
    ] as const)('shows the name field of a new %s', (kind, label) => {
      renderNode(fileNode(NEW_ENTRY_ID, ''), (store) => {
        store.getState().startCreate({ kind, folderPath: '' }, opener);
      });

      expect(screen.getByTestId('explorer-new-entry')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: label })).toBeInTheDocument();
    });

    it('shows nothing for the node of a new entry once creating is over', () => {
      renderNode(fileNode(NEW_ENTRY_ID, ''));

      expect(screen.queryByTestId('explorer-new-entry')).not.toBeInTheDocument();
    });
  });
});
