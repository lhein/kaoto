import { createContext, useContext } from 'react';

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
