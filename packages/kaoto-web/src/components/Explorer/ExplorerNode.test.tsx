import { FeatureFlags, TreeView } from '@carbon/react';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { storeTestFiles, TEST_FILES, withFiles } from '../../test/files';
import { resetTestIndexedDB } from '../../test/indexed-db';
import { toFolderId } from './build-tree';
import { createExplorerController, withExplorer } from './explorer-controller.mock';
import { ExplorerFile } from './explorer-file';
import { ExplorerController } from './ExplorerContext';
import { ExplorerNode } from './ExplorerNode';
import { NEW_ENTRY_ID } from './model/explorer-tree';

const routeFile: ExplorerFile = { id: 'main-flow', name: 'main-flow.camel.yaml', type: 'integration' };
const schemaFile: ExplorerFile = { id: 'schema', name: 'schema.xsd', type: 'document' };
const ordersFolder: ExplorerFile = {
  id: toFolderId('integrations/orders'),
  name: 'orders',
  type: 'folder',
  children: [routeFile],
};
const integrationsFolder: ExplorerFile = {
  id: toFolderId('integrations'),
  name: 'integrations',
  type: 'folder',
  children: [ordersFolder, schemaFile],
};

const ALL_EXPANDED = { [integrationsFolder.id]: true, [ordersFolder.id]: true };

describe('ExplorerNode', () => {
  beforeEach(async () => {
    resetTestIndexedDB();
    await storeTestFiles();
  });

  /** Renders the node in a tree, like the Explorer does; the name fields read the stored files */
  const renderNode = (node: ExplorerFile, overrides: Partial<ExplorerController> = {}) => {
    const controller = createExplorerController(overrides);
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
      const controller = renderNode(routeFile);

      await user.click(screen.getByText('main-flow.camel.yaml'));

      expect(controller.openFile).toHaveBeenCalledWith('main-flow');
    });

    it('does not open a file without an editor', async () => {
      const user = userEvent.setup();
      const controller = renderNode(schemaFile);

      await user.click(screen.getByText('schema.xsd'));

      expect(controller.openFile).not.toHaveBeenCalled();
    });

    it('highlights what the search found in its name', () => {
      renderNode(routeFile, { query: 'flow' });

      expect(screen.getByText('flow', { selector: 'mark' })).toBeInTheDocument();
    });
  });

  describe('keys', () => {
    // The key labelled "delete" on a Mac keyboard sends Backspace
    it.each(['{Delete}', '{Backspace}'])('asks to delete the focused row on %s', async (key) => {
      const user = userEvent.setup();
      const controller = renderNode(routeFile);
      screen.getByTestId('explorer-file-main-flow').focus();

      await user.keyboard(key);

      expect(controller.requestDelete).toHaveBeenCalledWith(routeFile);
    });

    it('starts renaming the focused row on F2', async () => {
      const user = userEvent.setup();
      const controller = renderNode(routeFile);
      screen.getByTestId('explorer-file-main-flow').focus();

      await user.keyboard('{F2}');

      expect(controller.startRename).toHaveBeenCalledWith('main-flow');
    });

    it('ignores other keys', async () => {
      const user = userEvent.setup();
      const controller = renderNode(routeFile);
      screen.getByTestId('explorer-file-main-flow').focus();

      await user.keyboard('x');

      expect(controller.requestDelete).not.toHaveBeenCalled();
      expect(controller.startRename).not.toHaveBeenCalled();
    });

    it('asks to delete only the focused row, not the folders around it', async () => {
      const user = userEvent.setup();
      const controller = renderNode(integrationsFolder, { expandedFolders: ALL_EXPANDED });
      screen.getByTestId('explorer-file-main-flow').focus();

      await user.keyboard('{Delete}');

      expect(controller.requestDelete).toHaveBeenCalledTimes(1);
      expect(controller.requestDelete).toHaveBeenCalledWith(routeFile);
    });

    it('asks to delete a focused folder', async () => {
      const user = userEvent.setup();
      const controller = renderNode(integrationsFolder);
      screen.getByTestId('explorer-folder-integrations').focus();

      await user.keyboard('{Delete}');

      expect(controller.requestDelete).toHaveBeenCalledWith(integrationsFolder);
    });
  });

  describe('a folder', () => {
    it('is collapsed until it is expanded', () => {
      renderNode(integrationsFolder);

      expect(screen.getByTestId('explorer-folder-integrations')).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows its rows, also the folders in it, when it is expanded', () => {
      renderNode(integrationsFolder, { expandedFolders: ALL_EXPANDED });

      const folder = screen.getByTestId('explorer-folder-integrations');
      expect(folder).toHaveAttribute('aria-expanded', 'true');
      expect(within(folder).getByTestId('explorer-folder-integrations/orders')).toBeInTheDocument();
      expect(within(folder).getByTestId('explorer-file-main-flow')).toBeInTheDocument();
      expect(within(folder).getByTestId('explorer-file-schema')).toBeInTheDocument();
    });

    it('is expanded while there is a search, so that what was found shows', () => {
      renderNode(integrationsFolder, { query: 'flow' });

      expect(screen.getByTestId('explorer-folder-integrations')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('explorer-folder-integrations/orders')).toHaveAttribute('aria-expanded', 'true');
    });

    it('reports that it was expanded', async () => {
      const user = userEvent.setup();
      const controller = renderNode(integrationsFolder);
      const toggle = screen
        .getByTestId('explorer-folder-integrations')
        .querySelector('.cds--tree-parent-node__toggle')!;

      await user.click(toggle);

      expect(controller.toggleFolder).toHaveBeenCalledWith(integrationsFolder.id, true);
    });
  });

  describe('name fields', () => {
    it('shows the rename field in place of the name of the file that is renamed', () => {
      const renaming = { ...TEST_FILES.find((file) => file.id === 'main-flow')!, createdAt: 0, updatedAt: 0 };
      renderNode(routeFile, { renaming });

      expect(screen.getByRole('textbox', { name: 'Rename file' })).toHaveValue('main-flow.camel.yaml');
    });

    it('shows the rename field in place of the name of the folder that is renamed', () => {
      renderNode(integrationsFolder, { renamingFolder: 'integrations' });

      expect(screen.getByRole('textbox', { name: 'Rename folder' })).toHaveValue('integrations');
    });

    it('leaves the other rows as they are while a folder is renamed', () => {
      renderNode(integrationsFolder, { renamingFolder: 'integrations/orders', expandedFolders: ALL_EXPANDED });

      expect(screen.getByRole('textbox', { name: 'Rename folder' })).toHaveValue('orders');
      expect(screen.getByText('integrations')).toBeInTheDocument();
    });

    it.each([
      ['file', 'New file name'],
      ['folder', 'New folder name'],
    ] as const)('shows the name field of a new %s', (entryKind, label) => {
      const newEntryNode: ExplorerFile = { id: NEW_ENTRY_ID, name: '', type: 'document' };
      renderNode(newEntryNode, {
        newEntry: { kind: 'creating', entryKind, folderPath: '', key: 1, opener: document.createElement('button') },
      });

      expect(screen.getByTestId('explorer-new-entry')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: label })).toBeInTheDocument();
    });
  });
});
