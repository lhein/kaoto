import { createContext, useContext } from 'react';
import { useStore } from 'zustand';

import { ExplorerActions, ExplorerState } from './model/explorer-store';
import type { useExplorer } from './useExplorer';

/** What the controller of the Explorer hands to its components */
export type ExplorerController = ReturnType<typeof useExplorer>;

export const ExplorerContext = createContext<ExplorerController | undefined>(undefined);

/** The controller of the Explorer the component is rendered in */
export const useExplorerContext = (): ExplorerController => {
  const explorer = useContext(ExplorerContext);
  if (!explorer) throw new Error('useExplorerContext must be used within an Explorer');
  return explorer;
};

/** What a row of the tree needs: the store to subscribe to, and what it does. It never changes for an Explorer. */
export type ExplorerRowContextValue = Pick<ExplorerController, 'store' | 'rowActions'>;

export const ExplorerRowContext = createContext<ExplorerRowContextValue | undefined>(undefined);

export const useExplorerRowContext = (): ExplorerRowContextValue => {
  const row = useContext(ExplorerRowContext);
  if (!row) throw new Error('useExplorerRowContext must be used within an Explorer');
  return row;
};

type StoreState = ExplorerState & ExplorerActions;

/** Subscribes to a part of the state of the Explorer: the component renders when that part changes, not otherwise */
export const useExplorerState = <T>(selector: (state: StoreState) => T): T =>
  useStore(useExplorerContext().store, selector);

/** The same for a row, which reads the store from its own context, so that it does not render with the controller */
export const useExplorerRowState = <T>(selector: (state: StoreState) => T): T =>
  useStore(useExplorerRowContext().store, selector);
