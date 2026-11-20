import { ReactNode } from 'react';
import { vi } from 'vitest';

import { ExplorerContext, ExplorerController, ExplorerRowContext } from './ExplorerContext';
import { createExplorerStore } from './model/explorer-store';

/**
 * A controller for the tests of the components: a real store, to put the Explorer into the state under test, and
 * spies in place of what the controller does.
 */
export const createExplorerController = (overrides: Partial<ExplorerController> = {}): ExplorerController => ({
  store: createExplorerStore(),
  rowActions: {
    toggleFolder: vi.fn(),
    startRename: vi.fn(),
    openFile: vi.fn(),
    requestDelete: vi.fn(),
    finishCreate: vi.fn(),
    finishRename: vi.fn(),
    folderRenamed: vi.fn(),
  },
  actions: {
    setSearchText: vi.fn(),
    setLastFocusedNode: vi.fn(),
    openCreateDialog: vi.fn(),
    reload: vi.fn(),
    startCreate: vi.fn(),
    closeCreateDialog: vi.fn(),
    closeDelete: vi.fn(),
    deleteNode: vi.fn(),
  },
  selectedId: undefined,
  loading: false,
  error: undefined,
  tree: [],
  focusRequest: undefined,
  ...overrides,
});

/** Hands the controller to the components under test, like the Explorer does */
export const withExplorer = (controller: ExplorerController, children: ReactNode) => (
  <ExplorerContext.Provider value={controller}>
    <ExplorerRowContext.Provider value={controller}>{children}</ExplorerRowContext.Provider>
  </ExplorerContext.Provider>
);
