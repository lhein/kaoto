import { ReactNode } from 'react';
import { vi } from 'vitest';

import { ExplorerContext, ExplorerController } from './ExplorerContext';

/** A controller with an idle Explorer and spies for its actions, for the tests of the components */
export const createExplorerController = (overrides: Partial<ExplorerController> = {}): ExplorerController =>
  ({
    selectedId: undefined,
    loading: false,
    error: undefined,
    reload: vi.fn(),
    isEmpty: false,
    nodes: [],
    searchText: '',
    query: '',
    expandedFolders: {},
    mode: { kind: 'idle' },
    focusRequest: undefined,
    newEntry: undefined,
    renaming: undefined,
    renamingFolder: undefined,
    setSearchText: vi.fn(),
    toggleFolder: vi.fn(),
    setLastFocusedNode: vi.fn(),
    openCreateDialog: vi.fn(),
    closeCreateDialog: vi.fn(),
    startCreate: vi.fn(),
    finishCreate: vi.fn(),
    startRename: vi.fn(),
    finishRename: vi.fn(),
    folderRenamed: vi.fn(),
    requestDelete: vi.fn(),
    closeDelete: vi.fn(),
    deleteNode: vi.fn(),
    openFile: vi.fn(),
    ...overrides,
  }) as ExplorerController;

/** Hands the controller to the components under test, like the Explorer does */
export const withExplorer = (controller: ExplorerController, children: ReactNode) => (
  <ExplorerContext.Provider value={controller}>{children}</ExplorerContext.Provider>
);
